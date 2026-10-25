// Teste somente de autenticação. Usa uma conta sintética e não envia e-mails.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { resolveAuthConfig } from '../src/services/auth-config.js';
import { confirmationRedirect, loginWithPassword } from '../src/services/auth.js';

async function optionalEnv(path) {
    try { return parseEnv(await readFile(new URL(path, import.meta.url), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
const shared = JSON.parse(await readFile(new URL('../src/config/supabase-public.json', import.meta.url), 'utf8'));
const frontendEnv = await optionalEnv('../.env.local');
const serverEnv = { ...await optionalEnv('../backend/.env.local'), ...process.env };
const config = resolveAuthConfig({ ...process.env, ...frontendEnv }, shared);
if (config.error) throw new Error(config.error);
if (!serverEnv.SUPABASE_SECRET_KEY || serverEnv.SUPABASE_URL?.replace(/\/$/, '') !== config.url)
    throw new Error('O teste real precisa da chave privada e da URL do mesmo projeto, configuradas somente no ambiente do servidor.');

let preflight;
try {
    preflight = await fetch(config.url + '/auth/v1/settings', { headers: { apikey: config.key }, signal: AbortSignal.timeout(10000) });
} catch {
    throw new Error('O projeto Supabase não respondeu. Confira no painel se ele está ativo e se a URL ainda é a mesma. Nenhuma conta de teste foi criada.');
}
if (!preflight.ok) throw new Error(`O serviço de login respondeu com erro HTTP ${preflight.status}. Nenhuma conta de teste foi criada.`);
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(config.url, serverEnv.SUPABASE_SECRET_KEY, options);
const client = createClient(config.url, config.key, options);
const email = `gameatlas-auth-test-${randomUUID()}@example.com`;
const password = randomBytes(24).toString('base64url');
let userId;
try {
    const link = await admin.auth.admin.generateLink({ type: 'signup', email, password,
        options: { data: { nome: 'Teste temporário de autenticação' }, redirectTo: confirmationRedirect('http://localhost:5173') } });
    if (link.error) throw new Error(`Não foi possível criar a conta temporária de autenticação. HTTP ${link.error.status || 0}; código: ${link.error.code || link.error.name}.`);
    userId = link.data.user?.id;
    assert.ok(userId);
    const tokenHash = link.data.properties?.hashed_token;
    assert.ok(tokenHash, 'A confirmação não retornou o token de teste');
    if (!link.data.user.email_confirmed_at) {
        await assert.rejects(loginWithPassword(client.auth, { email, password }),
            (error) => error.code === 'email_not_confirmed', 'Login deve exigir confirmação quando ela estiver ativa');
    }
    const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' });
    if (verified.error) throw new Error('A confirmação da conta temporária falhou.');
    assert.equal(verified.data.user.id, userId);
    assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
    await assert.rejects(loginWithPassword(client.auth, { email, password: 'intentionally-wrong-fixture-password' }),
        (error) => error.code === 'invalid_credentials');
    const login = await loginWithPassword(client.auth, { email, password });
    assert.equal(login.user.id, userId);
    assert.equal((await client.auth.getSession()).data.session.user.id, userId);
    assert.equal((await client.auth.getUser()).data.user.id, userId);
    assert.equal((await client.auth.signOut({ scope: 'local' })).error, null);
    assert.equal((await client.auth.getSession()).data.session, null);
} finally {
    if (userId) {
        const cleanup = await admin.auth.admin.deleteUser(userId);
        if (cleanup.error) throw new Error('A conta temporária não pôde ser removida. Confira os usuários de teste no Supabase.');
    }
}
console.log('OK: criação e confirmação da conta temporária, login, sessão e saída verificados no Supabase real. Conta temporária removida. O envio de e-mails não faz parte deste teste.');
