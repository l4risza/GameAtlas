import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createSupabaseService } from '../supabase-service.js';
import { createApp } from '../app.js';

function fixture({ authError, authThrows, existing, dbError, rawgError } = {}) {
    const calls = { tokens: [], games: [], rows: [] };
    let clients = 0;
    const stored = { id: 1, rawg_id: 3498, nome: 'GTA V', slug: 'gta-v', capa_url: 'https://media.rawg.io/game.jpg' };
    const createClientImpl = () => ++clients === 1 ? { auth: { async getUser(token) {
        calls.tokens.push(token);
        if (authThrows) throw new Error('network');
        return { data: { user: authError ? null : { id: 'validated-user' } }, error: authError };
    } } } : { from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing || null, error: dbError }) }) }),
        upsert: (row, options) => { calls.rows.push({ row, options }); return { select: () => ({ single: async () => ({ data: stored, error: dbError }) }) }; },
    }) };
    const service = createSupabaseService({ url: 'https://example.supabase.co', publishableKey: 'public-test', secretKey: 'server-test', createClientImpl });
    const rawg = { async getGame(id) { calls.games.push(id); if (rawgError) throw rawgError;
        return { id, title: stored.nome, slug: stored.slug, image: stored.capa_url }; } };
    return { service, rawg, calls, stored };
}

test('exige Bearer válido antes de consultar RAWG ou gravar jogos', async () => {
    for (const header of [undefined, '', 'Basic abc', 'Bearer ', 'Bearer a b']) {
        const { service, rawg, calls } = fixture();
        await assert.rejects(service.linkGame(header, 3498, rawg), { status: 401, code: 'AUTH_REQUIRED' });
        assert.deepEqual(calls, { tokens: [], games: [], rows: [] });
    }
});
test('valida o token no Auth e rejeita sessão expirada', async () => {
    const { service, rawg, calls } = fixture({ authError: { status: 401 } });
    await assert.rejects(service.linkGame('Bearer expired-token', 3498, rawg), { status: 401 });
    assert.deepEqual(calls.tokens, ['expired-token']); assert.equal(calls.games.length, 0);
});
test('reaproveita jogo local depois de validar a sessão', async () => {
    const existing = { id: 42, rawg_id: 3498 };
    const { service, rawg, calls } = fixture({ existing });
    assert.deepEqual(await service.linkGame('Bearer valid-token', 3498, rawg), existing);
    assert.equal(calls.tokens.length, 1); assert.equal(calls.games.length, 0); assert.equal(calls.rows.length, 0);
});
test('vincula RAWG por ID único, com metadados vindos do servidor', async () => {
    const { service, rawg, calls, stored } = fixture();
    assert.deepEqual(await service.linkGame('Bearer valid-token', 3498, rawg), stored);
    assert.deepEqual(calls.games, [3498]);
    assert.deepEqual(calls.rows, [{ row: { rawg_id: 3498, nome: stored.nome, slug: stored.slug, capa_url: stored.capa_url }, options: { onConflict: 'rawg_id' } }]);
});
test('falhas de conexão não expõem detalhes ou segredos', async () => {
    for (const options of [{ authThrows: true }, { dbError: { message: 'server-test' } }, { authError: { status: 503 } }]) {
        const { service, rawg } = fixture(options);
        await assert.rejects(service.linkGame('Bearer valid-token', 3498, rawg), (error) => error.status === 503 && !error.message.includes('server-test'));
    }
});
test('não grava uma resposta RAWG com outro ID', async () => {
    const { service, calls } = fixture();
    await assert.rejects(service.linkGame('Bearer valid-token', 3498, { getGame: async () => ({ id: 1 }) }), { code: 'RAWG_INVALID_RESPONSE' });
    assert.equal(calls.rows.length, 0);
});
test('configuração ausente não impede os endpoints públicos RAWG', async () => {
    const service = createSupabaseService({});
    assert.equal(service.configured, false);
    await assert.rejects(service.linkGame('', 1, {}), { code: 'DATABASE_NOT_CONFIGURED' });
});
test('rota POST ignora metadados do navegador e valida IDs', async (t) => {
    const { service, rawg, calls } = fixture();
    const server = createApp({ rawg, supabaseService: service }).listen(0, '127.0.0.1');
    await once(server, 'listening'); t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/biblioteca/jogos/`;
    assert.equal((await fetch(url + 'invalid', { method: 'POST' })).status, 400);
    assert.equal((await fetch(url + '3498', { method: 'POST' })).status, 401);
    const response = await fetch(url + '3498', { method: 'POST', headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Metadados falsos', capa_url: 'https://evil.example' }) });
    assert.equal(response.status, 200); assert.equal((await response.json()).nome, 'GTA V');
    assert.equal(calls.rows[0].row.nome, 'GTA V');
});

function loginFixture({ email = 'ana@email.com', rpcError, rpcThrows, signInError, signInThrows, now } = {}) {
    const calls = { rpc: [], signIn: [] };
    let clients = 0;
    const createClientImpl = () => ++clients === 1 ? { auth: { async signInWithPassword(input) {
        calls.signIn.push(input);
        if (signInThrows) throw new Error('network');
        return signInError ? { data: { session: null }, error: signInError }
            : { data: { session: { access_token: 'access-1', refresh_token: 'refresh-1', user: { id: 'u1' } } }, error: null };
    } } } : { async rpc(name, args) {
        calls.rpc.push({ name, args });
        if (rpcThrows) throw new Error('network');
        return { data: rpcError ? null : email, error: rpcError || null };
    } };
    const service = createSupabaseService({ url: 'https://example.supabase.co', publishableKey: 'public-test', secretKey: 'server-test', createClientImpl, now });
    return { service, calls };
}

test('login por usuário devolve só os tokens e nunca o e-mail', async () => {
    const { service, calls } = loginFixture();
    const result = await service.loginWithUsername('1.1.1.1', { identificador: ' Ana_01 ', senha: ' senha com espaço ' });
    assert.deepEqual(result, { access_token: 'access-1', refresh_token: 'refresh-1' });
    assert.deepEqual(calls.rpc, [{ name: 'email_por_username', args: { candidato: 'Ana_01' } }]);
    assert.deepEqual(calls.signIn, [{ email: 'ana@email.com', password: ' senha com espaço ' }]);
});
test('usuário inexistente, senha errada e formato inválido recebem a mesma resposta', async () => {
    const missing = loginFixture({ email: null });
    await assert.rejects(missing.service.loginWithUsername('ip', { identificador: 'ninguem', senha: 'x' }), { status: 401, code: 'INVALID_CREDENTIALS' });
    assert.equal(missing.calls.signIn.length, 0);
    const wrong = loginFixture({ signInError: { status: 400, code: 'invalid_credentials' } });
    await assert.rejects(wrong.service.loginWithUsername('ip', { identificador: 'ana_01', senha: 'errada' }), { status: 401, code: 'INVALID_CREDENTIALS' });
    for (const body of [{}, { identificador: 'ab', senha: 'x' }, { identificador: 'a@b.com', senha: 'x' }, { identificador: 'ana_01', senha: '' }, { identificador: 'ana_01', senha: 'x'.repeat(257) }, { identificador: 42, senha: 'x' }]) {
        const bad = loginFixture();
        await assert.rejects(bad.service.loginWithUsername('ip', body), { status: 401, code: 'INVALID_CREDENTIALS' });
        assert.deepEqual(bad.calls, { rpc: [], signIn: [] });
    }
});
test('depois de 10 tentativas erradas o IP é bloqueado por 10 minutos', async () => {
    let clock = 1_000_000;
    const { service, calls } = loginFixture({ signInError: { status: 400, code: 'invalid_credentials' }, now: () => clock });
    for (let i = 0; i < 10; i += 1) await assert.rejects(service.loginWithUsername('9.9.9.9', { identificador: 'ana_01', senha: 'x' }), { status: 401 });
    await assert.rejects(service.loginWithUsername('9.9.9.9', { identificador: 'ana_01', senha: 'x' }), { status: 429, code: 'TOO_MANY_ATTEMPTS' });
    assert.equal(calls.signIn.length, 10);
    await assert.rejects(service.loginWithUsername('8.8.8.8', { identificador: 'ana_01', senha: 'x' }), { status: 401 });
    clock += 10 * 60 * 1000 + 1;
    await assert.rejects(service.loginWithUsername('9.9.9.9', { identificador: 'ana_01', senha: 'x' }), { status: 401 });
});
test('falhas do banco ou do Auth viram 503 sem expor segredos', async () => {
    for (const options of [{ rpcError: { message: 'server-test' } }, { rpcThrows: true }, { signInThrows: true }, { signInError: { status: 503 } }]) {
        const { service } = loginFixture(options);
        await assert.rejects(service.loginWithUsername('ip', { identificador: 'ana_01', senha: 'x' }),
            (error) => error.status === 503 && !error.message.includes('server-test'));
    }
    const limited = loginFixture({ signInError: { status: 429 } });
    await assert.rejects(limited.service.loginWithUsername('ip', { identificador: 'ana_01', senha: 'x' }), { status: 429 });
    await assert.rejects(createSupabaseService({}).loginWithUsername('ip', {}), { code: 'DATABASE_NOT_CONFIGURED' });
});
test('rota POST /api/auth/entrar valida o corpo JSON', async (t) => {
    const { service } = loginFixture();
    const server = createApp({ rawg: {}, supabaseService: service }).listen(0, '127.0.0.1');
    await once(server, 'listening'); t.after(() => new Promise((resolve) => server.close(resolve)));
    const url = `http://127.0.0.1:${server.address().port}/api/auth/entrar`;
    const post = (body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    const ok = await post(JSON.stringify({ identificador: 'ana_01', senha: 'segredo123' }));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { access_token: 'access-1', refresh_token: 'refresh-1' });
    assert.equal((await post('{quebrado')).status, 400);
    assert.equal((await post(JSON.stringify({ senha: 'x'.repeat(5000) }))).status, 400);
    assert.equal((await fetch(url)).status, 404);
});
