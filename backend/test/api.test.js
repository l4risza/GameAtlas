import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { createIgdbClient,createIgdbService,normalizeGame } from '../igdb-service.js';
const GAME={id:1020,name:'Grand Theft Auto V',summary:'A game.',cover:{image_id:'co123'},genres:[{name:'Adventure',slug:'adventure'}],rating:85,aggregated_rating:90,
    screenshots:[{image_id:'sc123'}],videos:[{video_id:'abcdefghijk',name:'Trailer'}]};
function fixture(options={}) {
    const calls=[];let clock=100000;let auth=0;
    const fetchImpl=async(url,init)=>{
        if(String(url).includes('twitch.tv')) {auth++;assert.equal(new URL(url).search,'');assert.equal(init.body.get('client_secret'),'secret-test');return Response.json({access_token:'token-'+auth,expires_in:3600});}
        calls.push({endpoint:new URL(url).pathname.split('/').slice(2).join('/'),body:init.body,time:clock,headers:init.headers});
        if(options.response) return options.response(calls.at(-1));
        if(String(url).endsWith('/count'))return Response.json({count:options.count??721});
        if(String(url).endsWith('/multiquery'))return Response.json([...init.body.matchAll(/query games "(\w+)"/g)].map(m=>({name:m[1],result:[GAME]})));
        return Response.json([GAME]);
    };
    const config={clientId:'id-test',clientSecret:'secret-test',fetchImpl,now:()=>clock,sleep:async ms=>{clock+=ms;}};
    return {calls,config,service:createIgdbService(config),auth:()=>auth,advance:ms=>{clock+=ms;}};
}
test('OAuth usa corpo POST e token compartilhado, sem Secret na URL',async()=>{
    const f=fixture();const client=createIgdbClient(f.config);
    await Promise.all([client('games','fields name;'),client('games','fields name;')]);
    assert.equal(f.auth(),1);assert.equal(f.calls[1].time-f.calls[0].time,260);
    f.advance(3600001);await client('games','fields name;');assert.equal(f.auth(),2);
});
test('401 renova token uma vez; 403 não tenta ignorar autenticação',async()=>{
    let requests=0;const f=fixture({response:()=>Response.json([], {status:++requests===1?401:200})});
    await createIgdbClient(f.config)('games','');assert.equal(f.auth(),2);
    const bad=fixture({response:()=>new Response(null,{status:403})});
    await assert.rejects(bad.service.getGame(1),{code:'IGDB_AUTH_ERROR'});assert.equal(bad.auth(),1);
});
for(const status of [401,403,404,429,500,503]) test(`HTTP ${status} é tratado sem vazar credenciais`,async()=>{
    const f=fixture({response:()=>new Response(null,{status})});
    await assert.rejects(f.service.getGame(1),e=>e.code?.startsWith(status===404?'GAME_':'IGDB_')&&!e.message.includes('secret-test'));
    assert.ok(f.calls.length<=3);
});
test('credenciais ausentes, token inválido, rede, timeout e JSON malformado',async()=>{
    await assert.rejects(createIgdbClient({})('games',''),{code:'IGDB_NOT_CONFIGURED'});
    await assert.rejects(createIgdbClient({clientId:'a',clientSecret:'b',fetchImpl:async()=>Response.json({})})('games',''),{code:'IGDB_AUTH_ERROR'});
    for(const [name,code] of [['TypeError','IGDB_UNAVAILABLE'],['TimeoutError','IGDB_TIMEOUT']]) {
        const f=fixture();const fetchImpl=async(u,o)=>{if(String(u).includes('twitch.tv'))return f.config.fetchImpl(u,o);const e=new Error('private credential');e.name=name;throw e;};
        await assert.rejects(createIgdbClient({...f.config,fetchImpl})('games',''),{code});
    }
    const f=fixture({response:()=>new Response('broken')});await assert.rejects(f.service.getGame(1),{code:'IGDB_INVALID_RESPONSE'});
});
test('cache compartilha chamadas, expira e não guarda falhas',async()=>{
    const f=fixture();await Promise.all([f.service.getGame(1020),f.service.getGame(1020)]);assert.equal(f.calls.length,1);
    f.advance(300001);await f.service.getGame(1020);assert.equal(f.calls.length,2);
    let failed=true;const retry=fixture({response:()=>failed?new Response('broken'):Response.json([GAME])});
    await assert.rejects(retry.service.getGame(1020),{code:'IGDB_INVALID_RESPONSE'});
    failed=false;assert.equal((await retry.service.getGame(1020)).id,1020);assert.equal(retry.calls.length,2);
});

test('jogo ausente, identificador incorreto e resposta de contagem inválida não viram dados válidos',async()=>{
    for(const [value,code] of [[[],'GAME_NOT_FOUND'],[[{...GAME,id:99}],'IGDB_INVALID_RESPONSE']]) {
        const f=fixture({response:()=>Response.json(value)});await assert.rejects(f.service.getGame(1020),{code});
    }
    const f=fixture({response:call=>Response.json(call.endpoint.endsWith('/count')?{count:'721'}:[GAME])});
    await assert.rejects(f.service.listGames({}),{code:'IGDB_INVALID_RESPONSE'});
    assert.throws(()=>normalizeGame({id:0,name:'Inválido'}),{code:'IGDB_INVALID_RESPONSE'});
});
test('busca parcial usa nome com filtros idênticos no resultado e count',async()=>{
    const f=fixture();const r=await f.service.listGames({search:'craft',sort:'relevance',genres:'adventure',platforms:'6',parent_platforms:'playstation',developers:'rockstar-games',metacritic:'70,100',tags:'multiplayer',hide_extras:true,page:2,page_size:48,batch:1});
    const body=f.calls.find(x=>x.endpoint==='games').body;const count=f.calls.find(x=>x.endpoint==='games/count').body;
    for(const text of ['name ~ *"craft"*','genres.slug','platforms = (6)','platform_family.slug','involved_companies.developer','aggregated_rating >= 70','game_modes.slug','game_type.type'])assert.ok(body.includes(text),text);
    assert.ok(!body.includes('search "'));assert.ok(body.includes(count));assert.equal(r.count,240);assert.equal(r.total_count,721);assert.equal(r.has_more,true);assert.equal(r.next,3);
    assert.equal((await f.service.listGames({search:'craft',sort:'relevance',page_size:48,batch:4})).count,721);
});
test('ordenações e datas são traduzidas em consulta IGDB',async()=>{
    for(const [sort,field] of [['popular','total_rating_count'],['rating','rating'],['recent','first_release_date'],['name','name']]) {
        const f=fixture();await f.service.listGames({sort,dates:'2026-01-01,2026-01-02'});assert.ok(f.calls[0].body.includes('sort '+field));assert.ok(f.calls[0].body.includes('first_release_date <='));
    }
});
test('categorias, metadados, detalhes e fallback mantêm contrato do React',async()=>{
    const f=fixture();const keys=['emAlta','melhoresAv','lancamentos','classicos','indie','multiplayer'];
    assert.deepEqual(Object.keys((await f.service.categories(keys)).categories),keys);
    const data=await f.service.getGame(1020);assert.equal(data.trailer.youtubeId,'abcdefghijk');assert.ok(data.screenshots[0].startsWith('https://images.igdb.com/'));assert.equal(data.public_stars,4.25);assert.equal(data.critic_score,90);
    const translated=createIgdbService({...f.config,translateDescription:async()=>{throw Error('offline');}});assert.equal((await translated.getGame(1020)).description,GAME.summary);
    assert.equal((await f.service.metadata('genres',{})).count,721);
    const empty=normalizeGame({id:1,name:'Empty'});assert.equal(empty.rating,null);assert.equal(empty.image,null);
});
test('rotas Express usam IGDB e validam entradas antes de consultas',async(t)=>{
    const f=fixture();const server=createApp({igdb:f.service}).listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(r=>server.close(r)));
    const get=path=>fetch(`http://127.0.0.1:${server.address().port}/api${path}`);
    assert.equal((await get('/health')).status,200);assert.equal((await get('/jogos')).status,200);assert.equal((await get('/jogos/busca?q=craft')).status,200);
    assert.equal((await get('/jogos/1020')).status,200);assert.equal((await get('/generos')).status,200);assert.equal((await get('/plataformas')).status,200);assert.equal((await get('/jogos/categorias')).status,200);
    const n=f.calls.length;
    for(const path of ['/jogos?page=0','/jogos?page_size=49','/jogos?sort=bad','/jogos?ordering=name,-rating','/jogos?unknown=1','/jogos?dates=2026-02-30,2026-03-01','/jogos?metacritic=100,0','/jogos/busca?q=*','/jogos?q=mine&search=craft','/jogos/categorias?include=bad','/jogos?key=private']) assert.equal((await get(path)).status,400,path);
    assert.equal(f.calls.length,n);
    assert.equal((await get('/jogos?q=mine')).status,200);
    assert.ok(f.calls.some(call=>call.body.includes('name ~ *"mine"*')));
});
