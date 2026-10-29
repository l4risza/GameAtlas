import { createClient } from '@supabase/supabase-js';
import { ApiError } from './errors.js';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const unavailable = () => new ApiError(503, 'DATABASE_UNAVAILABLE', 'Não foi possível acessar o banco. Tente novamente.');
const invalidCredentials = () => new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail, usuário ou senha incorretos.');
const tooManyAttempts = () => new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
const USERNAME = /^[A-Za-z0-9_]{3,30}$/;

// Limite simples por IP, guardado na memória do servidor: 10 tentativas erradas a cada 10 minutos.
function createAttemptLimiter({ max = 10, windowMs = 10 * 60 * 1000, now = Date.now } = {}) {
    const attempts = new Map();
    const active = (key) => {
        const entry = attempts.get(key);
        if (entry && entry.resetAt > now()) return entry;
        attempts.delete(key);
        return null;
    };
    return {
        assertAllowed(key) { if ((active(key)?.count ?? 0) >= max) throw tooManyAttempts(); },
        recordFailure(key) {
            const entry = active(key);
            if (entry) { entry.count += 1; return; }
            if (attempts.size > 5000) for (const [other, value] of attempts) if (value.resetAt <= now()) attempts.delete(other);
            attempts.set(key, { count: 1, resetAt: now() + windowMs });
        },
    };
}

export function createSupabaseService({ url, publishableKey, secretKey, createClientImpl = createClient, now = Date.now }) {
    const configured = Boolean(url && publishableKey && secretKey);
    const authClient = configured ? createClientImpl(url, publishableKey, clientOptions) : null;
    const admin = configured ? createClientImpl(url, secretKey, clientOptions) : null;
    const loginLimiter = createAttemptLimiter({ now });
    return {
        configured,
        // Login por nome de usuário: o banco nunca entrega o e-mail ao navegador. O servidor descobre o
        // e-mail, confere a senha no Supabase e devolve só os tokens da sessão.
        async loginWithUsername(ip, body) {
            if (!configured) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'A conexão com o banco ainda não está configurada.');
            const key = ip || 'desconhecido';
            loginLimiter.assertAllowed(key);
            const username = typeof body?.identificador === 'string' ? body.identificador.trim() : '';
            const password = typeof body?.senha === 'string' ? body.senha : '';
            // Usuário inexistente e senha errada recebem exatamente a mesma resposta.
            if (!USERNAME.test(username) || !password || password.length > 256) { loginLimiter.recordFailure(key); throw invalidCredentials(); }
            let found;
            try { found = await admin.rpc('email_por_username', { candidato: username }); } catch { throw unavailable(); }
            if (found.error) throw unavailable();
            if (!found.data) { loginLimiter.recordFailure(key); throw invalidCredentials(); }
            let signIn;
            try { signIn = await authClient.auth.signInWithPassword({ email: found.data, password }); } catch { throw unavailable(); }
            if (signIn.error?.status >= 500 || signIn.error?.name === 'AuthRetryableFetchError') throw unavailable();
            if (signIn.error?.status === 429) throw tooManyAttempts();
            if (signIn.error || !signIn.data?.session) { loginLimiter.recordFailure(key); throw invalidCredentials(); }
            const { access_token, refresh_token } = signIn.data.session;
            return { access_token, refresh_token };
        },
        async linkGame(authorization, rawgId, rawg) {
            if (!configured) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'A conexão com o banco ainda não está configurada.');
            const token = /^Bearer ([^\s]{1,8192})$/i.exec(authorization || '')?.[1];
            if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
            let auth;
            try { auth = await authClient.auth.getUser(token); } catch { throw unavailable(); }
            if (auth.error?.status >= 500 || auth.error?.name === 'AuthRetryableFetchError') throw unavailable();
            if (auth.error || !auth.data?.user?.id) throw new ApiError(401, 'INVALID_SESSION', 'Sua sessão expirou. Entre novamente.');

            const columns = 'id,rawg_id,nome,slug,capa_url';
            let existing;
            try { existing = await admin.from('jogos').select(columns).eq('rawg_id', rawgId).maybeSingle(); }
            catch { throw unavailable(); }
            if (existing.error) throw unavailable();
            if (existing.data) return existing.data;

            // Nome e capa vêm da RAWG, nunca de dados enviados pelo navegador.
            const game = await rawg.getGame(rawgId);
            if (game.id !== rawgId) throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou um jogo inválido.');
            let saved;
            try {
                saved = await admin.from('jogos').upsert({
                    rawg_id: game.id, nome: game.title, slug: game.slug, capa_url: game.image,
                }, { onConflict: 'rawg_id' }).select(columns).single();
            } catch { throw unavailable(); }
            if (saved.error || !saved.data) throw unavailable();
            return saved.data;
        },
    };
}
