// Integração com contas sintéticas. Não usa RAWG, não envia e-mails e limpa os dados no finally.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readConfig } from '../config.js';
import { createAccountService } from '../account-service.js';
import { createSupabaseService } from '../supabase-service.js';

const config=readConfig();
if(!config.supabaseSecretKey) throw new Error('Configure o ambiente privado do backend.');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const make=()=>createClient(config.supabaseUrl,config.supabasePublishableKey,options);
const admin=createClient(config.supabaseUrl,config.supabaseSecretKey,options);
const visitor=make();
const accounts=createAccountService({url:config.supabaseUrl,publishableKey:config.supabasePublishableKey,secretKey:config.supabaseSecretKey});
const loginService=createSupabaseService({url:config.supabaseUrl,publishableKey:config.supabasePublishableKey,secretKey:config.supabaseSecretKey});
const users=[]; const games=[]; const files=[];
async function result(query) {const response=await query;if(response.error) throw new Error(`Falha de integração: ${response.error.code||response.error.status||'sem código'}.`);return response;}
const settingsResponse=await fetch(config.supabaseUrl+'/auth/v1/settings',{headers:{apikey:config.supabasePublishableKey},signal:AbortSignal.timeout(10000)});
if(!settingsResponse.ok||(await settingsResponse.json()).mailer_autoconfirm!==true)
    throw new Error('O teste sem e-mail exige projeto ativo e confirmação de cadastro desligada. Nenhuma conta criada.');
async function account() {
    const suffix=randomUUID().replaceAll('-','');
    const input={email:`gameatlas-contas-${suffix}@gmail.com`,password:randomBytes(24).toString('base64url'),options:{data:{username:'teste_'+suffix.slice(0,20)}}};
    const client=make(); const signup=await client.auth.signUp(input);
    if(signup.data?.user?.id) users.push(signup.data.user.id);
    if(signup.error||!signup.data.session) throw new Error('Cadastro público temporário falhou.');
    return {client,input,id:signup.data.user.id,token:signup.data.session.access_token};
}
try {
    const a=await account(); const b=await account();
    const own={Authorization:`Bearer ${a.token}`};
    assert.deepEqual(await accounts.usernameAvailable(a.input.options.data.username.toUpperCase()),{disponivel:false});
    const duplicate=await make().auth.signUp({...a.input,email:`gameatlas-duplicado-${randomUUID()}@gmail.com`});
    if(duplicate.data?.user?.id) users.push(duplicate.data.user.id);
    assert.ok(duplicate.error,'O banco aceitou username repetido');
    let username=a.input.options.data.username;
    const metadata=(await result(a.client.auth.getUser())).data.user.user_metadata;
    assert.equal(metadata.display_name,username); assert.equal(metadata.username,username);
    username='novo_'+randomUUID().replaceAll('-','').slice(0,20);
    await result(a.client.from('perfis').update({username,nome:'Nome de exibição separado'}).eq('id',a.id));
    const changedMetadata=(await result(a.client.auth.getUser())).data.user.user_metadata;
    assert.equal(changedMetadata.username,username);assert.equal(changedMetadata.display_name,username);
    assert.equal(changedMetadata.nome,'Nome de exibição separado');
    const tokens=await loginService.loginWithUsername('fixture',{identificador:username.toUpperCase(),senha:a.input.password});
    const viaUsername=make(); await result(viaUsername.auth.setSession(tokens));
    assert.equal((await result(viaUsername.auth.getUser())).data.user.id,a.id);
    const repeatedEmail=await make().auth.signUp({...b.input,email:a.input.email});
    assert.ok(repeatedEmail.error,'O Auth aceitou e-mail repetido');
    console.log('OK: cadastro público, username obrigatório/único, metadados Auth e login por username/e-mail.');

    await result(a.client.from('perfis').update({jogos_favoritos:['Minecraft','Portal 2'],redes_sociais:[{rede:'github',url:'https://github.com/gameatlas'}],ordem_reviews:'populares',ordem_listas:'antigas'}).eq('id',a.id));
    const profile=(await result(a.client.from('perfis').select('jogos_favoritos,redes_sociais').eq('id',a.id).single())).data;
    assert.deepEqual(profile.jogos_favoritos,['Minecraft','Portal 2']);assert.equal(profile.redes_sociais[0].rede,'github');
    assert.equal((await a.client.from('perfis').update({jogos_favoritos:['A','a']}).eq('id',a.id)).error?.code,'23514');
    const photo=`${a.id}/${randomUUID()}.png`; files.push(photo);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4CYAAAAASUVORK5CYII=','base64');
    await result(a.client.storage.from('avatares').upload(photo,png,{contentType:'image/png'}));
    const foreign=await b.client.storage.from('avatares').upload(`${a.id}/foreign.png`,png,{contentType:'image/png'});
    if(!foreign.error) files.push(`${a.id}/foreign.png`);
    assert.ok(foreign.error,'Outro usuário conseguiu enviar para a pasta alheia');
    const url=a.client.storage.from('avatares').getPublicUrl(photo).data.publicUrl;
    await result(a.client.from('perfis').update({avatar_url:url}).eq('id',a.id));
    assert.equal((await fetch(url)).status,200);
    console.log('OK: favoritos do perfil, redes sociais e upload de foto com isolamento entre usuários.');

    for(let n=0;n<2;n++) {
        const row=await result(admin.from('jogos').insert({rawg_id:8000000000000+randomInt(1000000000),nome:'Jogo sintético de configurações'}).select('id').single());games.push(row.data.id);
    }
    const reviews=[];
    for(let n=0;n<2;n++) {
        const row=await result(admin.from('reviews').insert({usuario_id:a.id,jogo_id:games[n],nota:4,criado_em:new Date(Date.now()-(n?0:86400000)).toISOString()}).select('id').single());reviews.push(row.data.id);
    }
    assert.equal((await accounts.likeReview(own.Authorization,reviews[0],true)).curtidas,1);
    assert.equal((await accounts.likeReview(own.Authorization,reviews[0],true)).curtidas,1);
    assert.equal((await accounts.likeReview(`Bearer ${b.token}`,reviews[0],true)).curtidas,2);
    const popular=await accounts.profileContent('reviews',a.id,{ordem:'populares',page_size:'1'});
    assert.equal(popular.items[0].id,reviews[0]);assert.equal(popular.count,2);
    assert.equal((await accounts.profileContent('reviews',a.id,{ordem:'recentes'})).items[0].id,reviews[1]);
    await result(admin.from('listas').insert([
        {usuario_id:a.id,nome:'Privada teste',publica:false,criado_em:'2026-01-01T00:00:00Z'},
        {usuario_id:a.id,nome:'Pública antiga',publica:true,criado_em:'2026-02-01T00:00:00Z'},
        {usuario_id:a.id,nome:'Pública recente',publica:true,criado_em:'2026-03-01T00:00:00Z'},
    ]));
    const lists=await accounts.profileContent('listas',a.id,{ordem:'antigas'});
    assert.equal(lists.count,2);assert.equal(lists.items[0].nome,'Pública antiga');
    assert.equal((await accounts.profileContent('listas',a.id,{ordem:'recentes'})).items[0].nome,'Pública recente');
    assert.equal((await accounts.profileContent('listas',a.id,{},own.Authorization)).count,3);
    await result(a.client.from('perfis').update({mostrar_reviews:false,mostrar_listas:false}).eq('id',a.id));
    assert.equal((await accounts.profileContent('reviews',a.id)).count,0);
    assert.equal((await accounts.profileContent('listas',a.id)).count,0);
    assert.equal((await result(visitor.from('reviews').select('id').eq('usuario_id',a.id))).data.length,2);
    console.log('OK: uma curtida por usuário, popularidade, paginação, listas privadas e preferências de exibição.');

    await assert.rejects(accounts.deactivate(own.Authorization,{senha:'senha-incorreta'}),{status:401});
    assert.equal((await accounts.deactivate(own.Authorization,{senha:a.input.password})).desativada,true);
    assert.ok((await make().auth.signInWithPassword({email:a.input.email,password:a.input.password})).error);
    await assert.rejects(loginService.loginWithUsername('fixture',{identificador:username,senha:a.input.password}),{status:401});
    assert.equal((await result(a.client.from('perfis').update({bio:'Não deve alterar'}).eq('id',a.id).select('id'))).data.length,0);
    assert.ok((await a.client.from('listas').insert({nome:'Conta desativada'})).error);
    assert.equal((await result(visitor.from('perfis').select('id').eq('id',a.id))).data.length,0);
    assert.equal((await result(visitor.from('reviews').select('id').eq('usuario_id',a.id))).data.length,0);
    const inactive=(await result(admin.from('perfis').select('desativado_em').eq('id',a.id).single())).data;
    assert.ok(inactive.desativado_em);
    console.log('OK: desativação preserva dados, bloqueia login e impede escrita com JWT antigo.');
} finally {
    if(files.length) await result(admin.storage.from('avatares').remove(files));
    for(const id of users) await result(admin.auth.admin.deleteUser(id));
    if(games.length) await result(admin.from('jogos').delete().in('id',games));
    console.log('Limpeza concluída: contas, arquivos e jogos sintéticos removidos.');
}
