import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveAuthConfig } from '../src/services/auth-config.js';
import { authErrorMessage, safeAuthDestination, confirmationRedirect, confirmationError,
    observeAuthSession, registerWithPassword, loginWithPassword, loginWithIdentifier } from '../src/services/auth.js';

const shared = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test_public_key' };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function authFixture() {
    let callback; let finish; let fail; let unsubscribed = false;
    const pending = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    const auth = { onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
        getSession() { return pending; } };
    return { auth, event: (...args) => callback(...args), finish, fail, unsubscribed: () => unsubscribed };
}

test('um clone sem .env usa o mesmo projeto público de autenticação', async () => {
    const project = JSON.parse(await readFile(new URL('../src/config/supabase-public.json', import.meta.url), 'utf8'));
    const config = resolveAuthConfig({}, project);
    assert.equal(config.error, null); assert.ok(config.url.startsWith('https://'));
    assert.ok(config.key.startsWith('sb_publishable_'));
    assert.equal(resolveAuthConfig({}, shared).url, shared.url);
});
test('variáveis vazias do exemplo não desligam a autenticação compartilhada', () => {
    assert.equal(resolveAuthConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: '' }, shared).error, null);
});
test('substituição de projeto é atômica e aceita a variável anon antiga', () => {
    const env = { VITE_SUPABASE_URL: 'https://another.supabase.co/', VITE_SUPABASE_ANON_KEY: shared.publishableKey };
    assert.equal(resolveAuthConfig(env, shared).url, 'https://another.supabase.co');
    assert.ok(resolveAuthConfig({ VITE_SUPABASE_URL: env.VITE_SUPABASE_URL }, shared).error);
    assert.ok(resolveAuthConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_ANON_KEY }, shared).error);
});
test('chaves administrativas e URLs inválidas nunca são usadas pelo navegador', () => {
    const token = (role) => `header.${btoa(JSON.stringify({ role }))}.signature`;
    for (const key of ['sb_secret_private_key', token('service_role'), 'placeholder']) {
        assert.ok(resolveAuthConfig({ VITE_SUPABASE_URL: shared.url, VITE_SUPABASE_PUBLISHABLE_KEY: key }).error);
    }
    assert.equal(resolveAuthConfig({ VITE_SUPABASE_URL: shared.url, VITE_SUPABASE_ANON_KEY: token('anon') }).error, null);
    for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com', shared.url + '/auth/v1', shared.url + '?key=abc'])
        assert.ok(resolveAuthConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: shared.publishableKey }).error);
    assert.equal(resolveAuthConfig({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_PUBLISHABLE_KEY: shared.publishableKey }).error, null);
});
test('retorno do login fica dentro do site, sem ciclos nas telas de autenticação', () => {
    assert.equal(safeAuthDestination('/jogo/3498'), '/jogo/3498');
    assert.equal(safeAuthDestination('/listas?minhas=1'), '/listas?minhas=1');
    for (const path of [null, 'https://other.example', '//other.example', '/\\other.example', '/login?voltar=/login', '/cadastro', '/\n/other.example', '/LOGIN', '/foo/../cadastro', '/%6cogin'])
        assert.equal(safeAuthDestination(path), '/perfil');
});
test('retorno de confirmação usa a origem atual e informa links expirados', () => {
    assert.equal(confirmationRedirect('http://localhost:5173'), 'http://localhost:5173/perfil');
    assert.equal(confirmationRedirect('https://gameatlas.example'), 'https://gameatlas.example/perfil');
    assert.match(confirmationError({ hash: '#error_code=otp_expired' }), /expirou/);
    assert.ok(confirmationError({ search: '?error=access_denied' }));
    assert.equal(confirmationError({ hash: '#access_token=ignored' }), null);
});
test('cadastro sem confirmação envia nome e e-mail sem espaços, preservando a senha e a sessão', async () => {
    let received;
    const response = { user: { id: 'new-user' }, session: { access_token: 'fixture-token' } };
    const auth = { async signUp(input) { received = input; return { data: response, error: null }; } };
    const data = await registerWithPassword(auth, { email: ' player@example.com ', password: ' senha com espaços ', name: ' Jogador ' });
    assert.deepEqual(received, { email: 'player@example.com', password: ' senha com espaços ',
        options: { data: { nome: 'Jogador' } } });
    assert.equal(data, response);
    await assert.rejects(registerWithPassword(auth, { email: 'player@example.com', password: 'password', name: ' ' }), /nome/);
});
test('cadastro pendente não é apresentado como conta pronta para entrar', async () => {
    const auth = { signUp: async () => ({ data: { user: { id: 'pending-user' }, session: null }, error: null }) };
    await assert.rejects(registerWithPassword(auth, { email: 'player@example.com', password: 'test-password', name: 'Jogador' }),
        (error) => error.code === 'signup_confirmation_required' && /responsável/.test(authErrorMessage(error)));
});
test('cadastro não mostra sucesso se o Supabase falha ao enviar o e-mail', async () => {
    const error = { code: 'email_address_not_authorized' };
    await assert.rejects(registerWithPassword({ signUp: async () => ({ data: null, error }) },
        { email: 'player@example.com', password: 'test-password', name: 'Jogador' }), (caught) => caught === error);
    assert.match(authErrorMessage(error), /responsável/);
});
test('login só termina com uma sessão real e preserva senhas com espaços', async () => {
    let received;
    const response = { user: { id: 'user' }, session: { access_token: 'fixture-token' } };
    const auth = { async signInWithPassword(input) { received = input; return { data: response, error: null }; } };
    assert.equal(await loginWithPassword(auth, { email: ' user@example.com ', password: ' password ' }), response);
    assert.deepEqual(received, { email: 'user@example.com', password: ' password ' });
    await assert.rejects(loginWithPassword({ signInWithPassword: async () => ({ data: { session: null }, error: null }) },
        { email: 'user@example.com', password: 'password' }), /sessão/);
});
test('login informa credenciais inválidas, confirmação pendente e serviço indisponível', () => {
    assert.match(authErrorMessage({ code: 'invalid_credentials' }), /incorretos/);
    assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /regularizar/);
    assert.match(authErrorMessage({ name: 'AuthRetryableFetchError' }), /Supabase está ativo/);
    assert.match(authErrorMessage({ code: 'signup_disabled' }), /desativado/);
});
test('INITIAL_SESSION não apaga uma falha da leitura inicial', async () => {
    const fixture = authFixture(); const states = [];
    const stop = observeAuthSession(fixture.auth, (state) => states.push(state));
    fixture.event('INITIAL_SESSION', null);
    fixture.finish({ data: { session: null }, error: { code: 'refresh_token_not_found' } });
    await flush();
    assert.equal(states.length, 1); assert.equal(states[0].loading, false); assert.match(states[0].error, /expirou/);
    stop(); assert.equal(fixture.unsubscribed(), true);
});
test('login novo prevalece sobre leitura inicial atrasada', async () => {
    const fixture = authFixture(); const states = [];
    const stop = observeAuthSession(fixture.auth, (state) => states.push(state));
    const session = { user: { id: 'signed-in' } };
    fixture.event('SIGNED_IN', session);
    fixture.finish({ data: { session: null }, error: null });
    await flush();
    assert.equal(states.length, 1); assert.equal(states[0].session, session); stop();
});
test('sessão persistida é restaurada e assinatura cancelada não atualiza uma tela desmontada', async () => {
    const fixture = authFixture(); const states = []; const session = { user: { id: 'restored' } };
    const stop = observeAuthSession(fixture.auth, (state) => states.push(state));
    fixture.finish({ data: { session }, error: null }); await flush();
    assert.equal(states[0].session, session); stop(); fixture.event('SIGNED_OUT', null);
    assert.equal(states.length, 1);
});
test('falhas inesperadas liberam o formulário em vez de deixá-lo carregando', async () => {
    const fixture = authFixture(); const states = [];
    const stop = observeAuthSession(fixture.auth, (state) => states.push(state), 'Link de confirmação inválido.');
    fixture.fail(new TypeError('network failed')); await flush();
    assert.equal(states[0].loading, false); assert.equal(states[0].session, null);
    assert.equal(states[0].error, 'Link de confirmação inválido.'); stop();
});
test('leitura de sessão que nunca responde não deixa o botão Entrar bloqueado', async () => {
    const fixture = authFixture(); const states = [];
    const stop = observeAuthSession(fixture.auth, (state) => states.push(state), null, { timeoutMs: 5 });
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(states[0].loading, false); assert.match(states[0].error, /demorou/);
    stop();
});

test('cadastro com nome de usuário envia username e usa o mesmo valor como nome de exibição inicial', async () => {
    let received;
    const auth = { async signUp(input) { received = input; return { data: { user: { id: 'u' }, session: { access_token: 't' } }, error: null }; } };
    await registerWithPassword(auth, { email: 'ana@example.com', password: 'senha-forte', username: ' Ana_01 ' });
    assert.deepEqual(received, { email: 'ana@example.com', password: 'senha-forte', options: { data: { nome: 'Ana_01', username: 'Ana_01' } } });
    await assert.rejects(registerWithPassword(auth, { email: 'ana@example.com', password: 'senha-forte', username: '  ' }), /nome de usuário/);
});
test('erro genérico do banco no cadastro vira aviso de nome de usuário repetido', () => {
    assert.match(authErrorMessage({ message: 'Database error saving new user' }), /nome de usuário/);
});
test('login com e-mail vai direto ao Supabase e com nome de usuário passa pelo backend', async () => {
    const calls = [];
    const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u' } };
    const auth = {
        async signInWithPassword(input) { calls.push(['signIn', input]); return { data: { session }, error: null }; },
        async setSession(input) { calls.push(['setSession', input]); return { data: { session }, error: null }; },
    };
    const request = async (path, options) => { calls.push(['request', path, options]); return { access_token: 'a', refresh_token: 'r' }; };
    await loginWithIdentifier(auth, { identifier: ' ana@example.com ', password: 'p' }, request);
    assert.deepEqual(calls, [['signIn', { email: 'ana@example.com', password: 'p' }]]);
    calls.length = 0;
    await loginWithIdentifier(auth, { identifier: ' Ana_01 ', password: ' p ' }, request);
    assert.deepEqual(calls, [
        ['request', '/auth/entrar', { method: 'POST', body: { identificador: 'Ana_01', senha: ' p ' } }],
        ['setSession', { access_token: 'a', refresh_token: 'r' }],
    ]);
    await assert.rejects(loginWithIdentifier(auth, { identifier: 'ana_01', password: 'p' }, async () => { throw new Error('E-mail, usuário ou senha incorretos.'); }), /incorretos/);
    await assert.rejects(loginWithIdentifier({ setSession: async () => ({ data: { session: null }, error: null }) }, { identifier: 'ana_01', password: 'p' }, request), /sessão/);
});
