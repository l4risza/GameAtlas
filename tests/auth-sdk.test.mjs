import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { authErrorMessage, loginWithPassword, observeAuthSession, registerWithPassword } from '../src/services/auth.js';

function serverFixture({ rejectLogin = false, rejectSignup = false, requireConfirmation = false } = {}) {
    const calls = [];
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com',
        aud: 'authenticated', role: 'authenticated', user_metadata: { nome: 'Teste SDK' },
        app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-10-25T12:00:00Z' };
    const encoded = (object) => btoa(JSON.stringify(object)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture-signature`;
    const sessionResponse = { access_token: token, refresh_token: 'fixture-refresh-token', expires_in: 3600, token_type: 'bearer', user };
    const client = createClient('https://auth-fixture.supabase.co', 'sb_publishable_fixture_public_key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (input, options = {}) => {
            const url = new URL(input); const body = options.body ? JSON.parse(options.body) : null;
            calls.push({ path: url.pathname, query: url.search, body });
            assert.ok(url.pathname.startsWith('/auth/v1/'), 'Teste de autenticação não deve acessar dados de outras funcionalidades');
            if (url.pathname.endsWith('/signup')) return rejectSignup
                ? Response.json({ code: 'email_address_not_authorized', msg: 'Email address not authorized' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
                : Response.json(requireConfirmation ? user : sessionResponse);
            if (url.pathname.endsWith('/token')) return rejectLogin
                ? Response.json({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
                : Response.json(sessionResponse);
            if (url.pathname.endsWith('/user')) return Response.json(user);
            if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
            throw new Error('Chamada inesperada no teste SDK');
        } },
    });
    return { client, calls, user };
}

test('cliente oficial entra após o cadastro sem confirmação, restaura sessão e permite novo login após sair', async () => {
    const { client, calls, user } = serverFixture();
    const states = []; const stop = observeAuthSession(client.auth, (state) => states.push(state));
    try {
        const signup = await registerWithPassword(client.auth, { email: user.email, password: 'fixture-password', name: 'Teste SDK' });
        assert.equal(signup.user.id, user.id); assert.ok(signup.session);
        assert.equal((await client.auth.getSession()).data.session.user.id, user.id);
        assert.ok(states.some((state) => state.session?.user.id === user.id));
        assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
        const login = await loginWithPassword(client.auth, { email: user.email, password: 'fixture-password' });
        assert.equal(login.user.id, user.id);
        assert.equal((await client.auth.getSession()).data.session.user.id, user.id);
        assert.ok(states.some((state) => state.session?.user.id === user.id));
        assert.equal((await client.auth.getUser()).data.user.id, user.id);
        const { error } = await client.auth.signOut({ scope: 'local' }); assert.equal(error, null);
        assert.equal((await client.auth.getSession()).data.session, null);
        assert.equal(states.at(-1).session, null);
        const signupRequest = calls.find((call) => call.path.endsWith('/signup'));
        assert.equal(new URLSearchParams(signupRequest.query).has('redirect_to'), false);
        assert.equal(signupRequest.body.data.nome, 'Teste SDK');
        assert.equal(calls.some((call) => /resend|verify|otp/.test(call.path)), false);
    } finally { stop(); }
});

test('cliente oficial não conclui o cadastro quando a confirmação ainda está ligada no servidor', async () => {
    const { client, user } = serverFixture({ requireConfirmation: true });
    await assert.rejects(registerWithPassword(client.auth, { email: user.email, password: 'fixture-password', name: 'Teste' }),
        (error) => error.code === 'signup_confirmation_required');
    assert.equal((await client.auth.getSession()).data.session, null);
});
test('erros reais do SDK são traduzidos para credenciais e e-mail bloqueado', async () => {
    const badLogin = serverFixture({ rejectLogin: true });
    await assert.rejects(loginWithPassword(badLogin.client.auth, { email: 'fixture@example.com', password: 'wrong-password' }),
        (error) => error.code === 'invalid_credentials' && /incorretos/.test(authErrorMessage(error)));
    const badSignup = serverFixture({ rejectSignup: true });
    await assert.rejects(registerWithPassword(badSignup.client.auth, { email: 'fixture@example.com', password: 'fixture-password', name: 'Teste' }),
        (error) => error.code === 'email_address_not_authorized' && /responsável/.test(authErrorMessage(error)));
});
