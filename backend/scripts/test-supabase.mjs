// Verifica a integração real, usando contas sintéticas removidas ao terminar.
// Executar com a API local ligada: node backend/scripts/test-supabase.mjs
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { readConfig } from '../config.js';

const config = readConfig();
if (!config.supabaseSecretKey) throw new Error('Configure o Supabase localmente antes do teste.');
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, options);
const visitor = createClient(config.supabaseUrl, config.supabasePublishableKey, options);
const users = [];
let gameId;
let existed = false;
let passed = false;
async function result(query) {
    const response = await query;
    if (response.error) throw new Error(response.error.message);
    return response;
}
async function account() {
    const password = randomBytes(24).toString('base64url');
    const email = `gameatlas-test-${randomUUID()}@example.com`;
    const { data } = await result(admin.auth.admin.createUser({ email, password, email_confirm: true,
        user_metadata: { nome: 'Teste de integração GameAtlas' } }));
    users.push(data.user.id);
    const client = createClient(config.supabaseUrl, config.supabasePublishableKey, options);
    const login = await result(client.auth.signInWithPassword({ email, password }));
    assert.equal(login.data.user.id, data.user.id);
    return { client, id: data.user.id, token: login.data.session.access_token };
}

try {
    const front = await readFile(new URL('../../.env.local', import.meta.url), 'utf8');
    assert.ok(front.includes(`VITE_SUPABASE_URL=${config.supabaseUrl}`));
    assert.ok(front.includes(`VITE_SUPABASE_PUBLISHABLE_KEY=${config.supabasePublishableKey}`));
    for (const route of ['login', 'cadastro', 'perfil', 'listas', 'reviews', 'jogos-salvos']) {
        const html = await (await fetch(`http://localhost:5173/${route}`, { headers: { Accept: 'text/html' } })).text();
        assert.ok(html.includes('id="root"'), `Acesso direto à rota ${route} não carregou o React`);
    }
    const original = await result(admin.from('jogos').select('id').eq('rawg_id', 3498).maybeSingle());
    existed = Boolean(original.data);
    const fixtures = await Promise.allSettled([account(), account()]);
    const failure = fixtures.find((item) => item.status === 'rejected');
    if (failure) throw failure.reason;
    const [a, b] = fixtures.map((item) => item.value);
    const profile = await result(a.client.from('perfis').select('id,nome,username').eq('id', a.id).single());
    assert.equal(profile.data.nome, 'Teste de integração GameAtlas');
    assert.equal(profile.data.username, null);
    await result(a.client.from('perfis').update({ bio: 'Bio de teste' }).eq('id', a.id).select('id').single());

    const endpoint = `http://127.0.0.1:${config.port}/api/biblioteca/jogos/3498`;
    assert.equal((await fetch(endpoint, { method: 'POST' })).status, 401);
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer invalid-token' } })).status, 401);
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${a.token}` }, signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 200, 'Vinculação RAWG falhou');
    const game = await response.json(); gameId = game.id;
    assert.equal(game.rawg_id, 3498); assert.ok(game.nome.includes('Grand Theft Auto'));
    const again = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${b.token}` } });
    assert.equal((await again.json()).id, gameId);

    const { data: list } = await result(a.client.from('listas').insert({ nome: 'Teste de integração' }).select('id,publica').single());
    assert.equal(list.publica, false);
    await result(a.client.from('lista_jogos').insert({ lista_id: list.id, jogo_id: gameId }));
    const { data: review } = await result(a.client.from('reviews').insert({ jogo_id: gameId, nota: 5 }).select('id,texto').single());
    assert.equal(review.texto, null);
    assert.equal((await result(a.client.from('jogos_salvos').select('jogo_id'))).data.length, 0);
    await result(a.client.from('jogos_salvos').insert({ jogo_id: gameId }));
    assert.equal((await a.client.from('jogos_salvos').insert({ jogo_id: gameId })).error.code, '23505');

    assert.equal((await result(b.client.from('listas').select('id').eq('id', list.id))).data.length, 0);
    assert.equal((await result(b.client.from('lista_jogos').select('jogo_id').eq('lista_id', list.id))).data.length, 0);
    assert.equal((await result(b.client.from('jogos_salvos').select('jogo_id').eq('usuario_id', a.id))).data.length, 0);
    assert.equal((await b.client.from('jogos_salvos').insert({ usuario_id: a.id, jogo_id: gameId })).error.code, '42501');
    assert.equal((await b.client.from('lista_jogos').insert({ lista_id: list.id, jogo_id: gameId })).error.code, '42501');
    assert.equal((await result(b.client.from('reviews').update({ nota: 1 }).eq('id', review.id).select('id'))).data.length, 0);
    assert.equal((await result(b.client.from('perfis').update({ bio: 'Intruso' }).eq('id', a.id).select('id'))).data.length, 0);
    await result(a.client.from('listas').update({ publica: true }).eq('id', list.id).select('id').single());
    assert.equal((await result(visitor.from('listas').select('id').eq('id', list.id))).data.length, 1);
    assert.equal((await result(visitor.from('lista_jogos').select('jogo_id').eq('lista_id', list.id))).data.length, 1);
    assert.equal((await visitor.from('jogos_salvos').select('jogo_id')).error.code, '42501');
    await result(a.client.from('listas').update({ publica: false }).eq('id', list.id));
    assert.equal((await result(visitor.from('listas').select('id').eq('id', list.id))).data.length, 0);

    await result(a.client.from('reviews').update({ nota: 3, texto: '   ' }).eq('id', review.id).select('id').single());
    assert.equal((await result(a.client.from('reviews').select('nota,texto').eq('id', review.id).single())).data.texto, null);
    for (const nota of [0, 6]) assert.equal((await a.client.from('reviews').update({ nota }).eq('id', review.id)).error.code, '23514');
    await result(a.client.from('jogos_salvos').delete().eq('jogo_id', gameId));
    assert.equal((await result(a.client.from('reviews').select('id').eq('id', review.id))).data.length, 1);
    assert.equal((await result(a.client.from('lista_jogos').select('jogo_id').eq('lista_id', list.id))).data.length, 1);

    // Os joins e contagens usados pelas telas precisam funcionar com a chave pública.
    const joined = await result(a.client.from('reviews').select('id,jogos(id,rawg_id,nome,capa_url),perfis(nome,username)', { count: 'exact' })
        .eq('usuario_id', a.id).range(0, 11));
    assert.equal(joined.count, 1); assert.equal(joined.data[0].jogos.rawg_id, 3498);
    await result(a.client.from('reviews').delete().eq('id', review.id));
    await result(a.client.from('listas').delete().eq('id', list.id));
    assert.equal((await result(a.client.from('lista_jogos').select('jogo_id').eq('lista_id', list.id))).data.length, 0);
    await result(a.client.auth.signOut({ scope: 'local' }));
    assert.equal((await a.client.auth.getSession()).data.session, null);
    passed = true;
} finally {
    for (const id of users) await result(admin.auth.admin.deleteUser(id));
    if (gameId && !existed) {
        const cleanup = await admin.from('jogos').delete().eq('id', gameId);
        // Uma interação real simultânea preserva o jogo por sua chave estrangeira.
        if (cleanup.error && cleanup.error.code !== '23503') throw new Error('Falha ao limpar o jogo de teste.');
    }
}
if (passed) console.log('OK: login, perfil, vínculo RAWG, listas públicas/privadas, notas sem comentário, Jogos Salvos e isolamento entre usuários. Contas e dados sintéticos removidos.');
