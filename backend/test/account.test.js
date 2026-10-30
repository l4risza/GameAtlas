import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAccountService } from '../account-service.js';
import { createApp } from '../app.js';

const USER = '00000000-0000-4000-8000-000000000001';
const REVIEW = '00000000-0000-4000-8000-000000000002';
function fixture({ invalidSession, wrongPassword, inactive = false, missingReview, duplicate, dbError, banError, now } = {}) {
    const calls = [];
    const state = { inactive };
    class Query {
        constructor(table) { this.table = table; this.filters = []; this.action = 'select'; }
        select() { return this; } eq(key,value) { this.filters.push([key,value]); return this; }
        single() { return this; } maybeSingle() { return this; }
        insert(row) { this.action = 'insert'; this.row = row; return this; }
        delete() { this.action = 'delete'; return this; }
        then(resolve,reject) {
            calls.push({ table:this.table, action:this.action, row:this.row, filters:this.filters });
            let data = null; let error = dbError;
            if (this.table === 'perfis') data = { id:USER,desativado_em:state.inactive?'2026-10-30':null };
            if (this.table === 'reviews') data = missingReview?null:{id:REVIEW};
            if (duplicate && this.table === 'review_curtidas' && this.action === 'insert') error = {code:'23505'};
            return Promise.resolve({ data,error }).then(resolve,reject);
        }
    }
    function createClientImpl(_url,key,config) {
        calls.push({ client:key, token:config.global?.headers.Authorization });
        return {
            from:table=>new Query(table),
            async rpc(name,args) {
                calls.push({rpc:name,args});
                if(name==='gameatlas_desativar_conta'&&!dbError) state.inactive=true;
                return {data:name==='username_disponivel'?true:name==='total_curtidas_review'?2:{items:[],count:0},error:dbError};
            },
            auth: {
                async getUser(token) { calls.push({getUser:token}); return {data:{user:invalidSession?null:{id:USER,email:'fixture@example.com'}},error:invalidSession?{status:401}:null}; },
                async signInWithPassword(input) { calls.push({password:input.password}); return {data:{user:wrongPassword?null:{id:USER}},error:wrongPassword?{status:400}:null}; },
                admin: {
                    async signOut(token,scope) { calls.push({logout:token,scope}); return {error:null}; },
                    async updateUserById(id,fields) { calls.push({ban:id,fields}); return {data:{user:{id}},error:banError}; },
                },
            },
        };
    }
    return {calls,state,service:createAccountService({url:'https://fixture.supabase.co',publishableKey:'public',secretKey:'private',createClientImpl,now})};
}

test('curtidas exigem sessão e identificador válido antes de escrever', async()=>{
    for(const token of [undefined,'Basic invalid','Bearer a b']) {
        const f=fixture(); await assert.rejects(f.service.likeReview(token,REVIEW,true),{status:401});
        assert.equal(f.calls.some(c=>c.action==='insert'),false);
    }
    await assert.rejects(fixture().service.likeReview('Bearer x','invalid',true),{status:400});
    await assert.rejects(fixture({invalidSession:true}).service.likeReview('Bearer x',REVIEW,true),{status:401});
    await assert.rejects(fixture({inactive:true}).service.likeReview('Bearer x',REVIEW,true),{code:'ACCOUNT_INACTIVE'});
});
test('uma curtida repetida é idempotente e só permite remover a do usuário autenticado',async()=>{
    const f=fixture({duplicate:true});
    assert.deepEqual(await f.service.likeReview('Bearer token',REVIEW,true),{curtida:true,curtidas:2});
    assert.deepEqual(f.calls.find(c=>c.action==='insert').row,{review_id:REVIEW,usuario_id:USER});
    assert.deepEqual(await f.service.likeReview('Bearer token',REVIEW,false),{curtida:false,curtidas:2});
    assert.deepEqual(f.calls.find(c=>c.action==='delete').filters,[['review_id',REVIEW],['usuario_id',USER]]);
    await assert.rejects(fixture({missingReview:true}).service.likeReview('Bearer token',REVIEW,true),{status:404});
});
test('disponibilidade valida formato sem retornar dados da conta',async()=>{
    const f=fixture(); assert.deepEqual(await f.service.usernameAvailable(' Ana_01 '),{disponivel:true});
    assert.deepEqual(f.calls.find(c=>c.rpc).args,{candidato:'Ana_01'});
    for(const value of ['',null,'ab','@ana','ana@email.com',['ana']]) await assert.rejects(f.service.usernameAvailable(value),{status:400});
});
test('consulta do perfil preserva RLS e valida ordem e paginação',async()=>{
    const f=fixture(); await f.service.profileContent('reviews',USER,{ordem:'populares',page:'2',page_size:'10'});
    assert.deepEqual(f.calls.find(c=>c.rpc).args,{alvo:USER,ordenacao:'populares',pagina:2,tamanho:10});
    assert.equal(f.calls.find(c=>c.rpc).rpc,'reviews_do_perfil');
    await f.service.profileContent('listas',USER,{},'Bearer owner-token');
    assert.ok(f.calls.some(c=>c.token==='Bearer owner-token'));
    for(const query of [{ordem:'populares'},{page:'0'},{page_size:'49'},{page:['2']}])
        await assert.rejects(f.service.profileContent('listas',USER,query),{status:400});
    await assert.rejects(f.service.profileContent('reviews','invalid'),{status:400});
});
test('desativação exige senha atual, mantém os dados e encerra as sessões',async()=>{
    const f=fixture(); assert.deepEqual(await f.service.deactivate('Bearer token',{senha:' current-password '}),{desativada:true,sessoes_encerradas:true});
    assert.equal(f.calls.find(c=>c.password).password,' current-password ');
    const steps=f.calls.filter(c=>c.rpc==='gameatlas_desativar_conta'||c.logout||c.ban);
    assert.deepEqual(steps,[{rpc:'gameatlas_desativar_conta',args:{alvo:USER}},{logout:'token',scope:'global'},{ban:USER,fields:{ban_duration:'876000h'}}]);
    assert.equal(f.state.inactive,true);
    assert.equal(f.calls.some(c=>c.action==='delete'),false);
});
test('senha incorreta não desativa a conta e limita tentativas por usuário',async()=>{
    let clock=1000000; const f=fixture({wrongPassword:true,now:()=>clock});
    for(let i=0;i<5;i++) await assert.rejects(f.service.deactivate('Bearer token',{senha:'wrong'}),{status:401});
    await assert.rejects(f.service.deactivate('Bearer token',{senha:'wrong'}),{status:429});
    assert.equal(f.state.inactive,false); assert.equal(f.calls.some(c=>c.rpc),false);
    clock+=600001; await assert.rejects(f.service.deactivate('Bearer token',{senha:'wrong'}),{status:401});
    await assert.rejects(f.service.deactivate('Bearer token',{}),{status:400});
});
test('falha posterior no Auth mantém o bloqueio de dados e não expõe o erro privado',async()=>{
    const f=fixture({banError:{status:503,message:'private-key'}});
    await assert.rejects(f.service.deactivate('Bearer token',{senha:'correct'}),error=>error.status===503&&!error.message.includes('private-key'));
    assert.equal(f.state.inactive,true);
});
test('rotas novas recebem apenas as operações previstas e recusam JSON inválido',async(t)=>{
    const f=fixture(); const server=createApp({rawg:{},accountService:f.service}).listen(0,'127.0.0.1');
    await once(server,'listening'); t.after(()=>new Promise(resolve=>server.close(resolve)));
    const url=`http://127.0.0.1:${server.address().port}/api`;
    assert.equal((await fetch(url+'/usuarios/disponibilidade?username=Ana_01')).status,200);
    const profile=await fetch(url+`/perfis/${USER}/reviews?ordem=populares`);
    assert.equal(profile.status,200); assert.equal(profile.headers.get('cache-control'),'no-store');
    assert.equal((await fetch(url+`/reviews/${REVIEW}/curtida`,{method:'POST'})).status,401);
    assert.equal((await fetch(url+'/conta/desativar',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    assert.equal((await fetch(url+'/conta/desativar')).status,404);
});
