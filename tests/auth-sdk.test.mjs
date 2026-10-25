import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { authErrorMessage, loginWithPassword, observeAuthSession, registerWithPassword, resendSignup } from '../src/services/auth.js';

function serverFixture({ rejectLogin = false, rejectSignup = false } = {}) {
    const calls = [];
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com',
        aud: 'authenticated', role: 'authenticated', user_metadata: { nome: 'Teste SDK' },
        app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-10-25T12:00:00Z' };
    const encoded = (object) => btoa(JSON.stringify(object)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
    const client = createClient('https://auth-fixture.supabase.co', 'sb_publishable_fixture_public_key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (input, options = {}) => {
            const url = new URL(input); const body = options.body ? JSON.parse(options.body) : null;
            calls.push({ path: url.pathname, query: url.search, body });
            assert.ok(url.pathname.startsWith('/auth/v1/'), 'Teste de autenticação não deve acessar dados de outras funcionalidades');
            if (url.pathname.endsWith('/signup')) return rejectSignup
                ? Response.json({ code: 'email_address_not_authorized', msg: 'Email address not authorized' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
                : Response.json(user);
            if (url.pathname.endsWith('/token')) return rejectLogin
                ? Response.json({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
                : Response.json({ access_token: token, refresh_token: 'fixture-refresh-token', expires_in: 3600, token_type: 'bearer', user });
            if (url.pathname.endsWith('/user')) return Response.json(user);
            if (url.pathname.endsWith('/resend')) return Response.json({});
            if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
            throw new Error('Chamada inesperada no teste SDK');
        } },
    });
    return { client, calls, user };
}

test('cliente oficial executa cadastro pendente, reenvio, login, restauração de sessão e saída', async () => {
    const { client, calls, user } = serverFixture();
    const signup = await registerWithPassword(client.auth, { email: user.email, password: 'fixture-password', name: 'Teste SDK', origin: 'http://localhost:5173' });
    assert.equal(signup.user.id, user.id); assert.equal(signup.session, null);
    await resendSignup(client.auth, user.email, 'http://localhost:5173');
    const states = []; const stop = observeAuthSession(client.auth, (state) => states.push(state));
    try {
        const login = await loginWithPassword(client.auth, { email: user.email, password: 'fixture-password' });
        assert.equal(login.user.id, user.id);
        assert.equal((await client.auth.getSession()).data.session.user.id, user.id);
        assert.ok(states.some((state) => state.session?.user.id === user.id));
        assert.equal((await client.auth.getUser()).data.user.id, user.id);
        const { error } = await client.auth.signOut({ scope: 'local' }); assert.equal(error, null);
        assert.equal((await client.auth.getSession()).data.session, null);
        assert.equal(states.at(-1).session, null);
        const signupRequest = calls.find((call) => call.path.endsWith('/signup'));
        assert.ok(signupRequest.query.includes('redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fperfil'));
        assert.equal(signupRequest.body.data.nome, 'Teste SDK');
        assert.ok(calls.some((call) => call.path.endsWith('/resend')));
    } finally { stop(); }
});
test('erros reais do SDK são traduzidos para credenciais e e-mail bloqueado', async () => {
    const badLogin = serverFixture({ rejectLogin: true });
    await assert.rejects(loginWithPassword(badLogin.client.auth, { email: 'fixture@example.com', password: 'wrong-password' }),
        (error) => error.code === 'invalid_credentials' && /incorretos/.test(authErrorMessage(error)));
    const badSignup = serverFixture({ rejectSignup: true });
    await assert.rejects(registerWithPassword(badSignup.client.auth, { email: 'fixture@example.com', password: 'fixture-password', name: 'Teste', origin: 'http://localhost:5173' }),
        (error) => error.code === 'email_address_not_authorized' && /responsável/.test(authErrorMessage(error)));
});
