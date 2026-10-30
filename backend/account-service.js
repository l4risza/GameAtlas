import { createClient } from '@supabase/supabase-js';
import { ApiError } from './errors.js';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new ApiError(503, 'DATABASE_UNAVAILABLE', 'Não foi possível acessar o banco. Tente novamente.');
const invalid = (message) => new ApiError(400, 'INVALID_BODY', message);

export function createAccountService({ url, publishableKey, secretKey, createClientImpl = createClient, now = Date.now }) {
    const configured = Boolean(url && publishableKey && secretKey);
    const admin = configured ? createClientImpl(url, secretKey, options) : null;
    const attempts = new Map();
    function client(token) {
        if (!configured) throw new ApiError(503, 'DATABASE_NOT_CONFIGURED', 'A conexão com o banco ainda não está configurada.');
        return createClientImpl(url, publishableKey, token
            ? { ...options, global: { headers: { Authorization: `Bearer ${token}` } } } : options);
    }
    async function result(query) {
        let response;
        try { response = await query; } catch { throw unavailable(); }
        if (response.error) {
            if (response.error.code === '22023') throw invalid('Paginação ou ordenação inválida.');
            if (['42501','23503'].includes(response.error.code)) throw new ApiError(403, 'NOT_ALLOWED', 'Operação não permitida.');
            throw unavailable();
        }
        return response;
    }
    function tokenOf(header, optional = false) {
        if (!header && optional) return null;
        const token = /^Bearer ([^\s]{1,8192})$/i.exec(header || '')?.[1];
        if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
        return token;
    }
    async function authenticated(header) {
        const token = tokenOf(header); const db = client(token);
        let auth;
        try { auth = await db.auth.getUser(token); } catch { throw unavailable(); }
        if (auth.error?.status >= 500 || auth.error?.name === 'AuthRetryableFetchError') throw unavailable();
        if (auth.error?.status === 429) throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde um pouco.');
        if (auth.error || !auth.data?.user?.id) throw new ApiError(401, 'INVALID_SESSION', 'Sua sessão expirou. Entre novamente.');
        const profile = await result(admin.from('perfis').select('id,desativado_em').eq('id', auth.data.user.id).single());
        if (profile.data?.desativado_em) throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Esta conta está desativada.');
        return { db, user: auth.data.user, token };
    }
    function id(value) {
        if (typeof value !== 'string' || !UUID.test(value)) throw invalid('Identificador inválido.');
        return value;
    }
    function page(value, fallback, max) {
        if (value === undefined) return fallback;
        if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw invalid('Paginação inválida.');
        return Number(value);
    }
    return {
        async usernameAvailable(username) {
            if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) throw invalid('Use de 3 a 30 letras, números ou _.');
            const response = await result(client().rpc('username_disponivel', { candidato: username.trim() }));
            return { disponivel: response.data === true };
        },
        async profileContent(kind, userId, query = {}, authorization) {
            const alvo = id(userId);
            const allowed = kind === 'reviews' ? ['recentes','antigas','populares'] : ['recentes','antigas'];
            if (query.ordem !== undefined && !allowed.includes(query.ordem)) throw invalid('Ordenação inválida.');
            const token = tokenOf(authorization, true);
            const db = token ? (await authenticated(authorization)).db : client();
            const response = await result(db.rpc(kind === 'reviews' ? 'reviews_do_perfil' : 'listas_do_perfil', {
                alvo, ordenacao: query.ordem ?? null, pagina: page(query.page, 1, 10000), tamanho: page(query.page_size, 12, 48),
            }));
            return response.data;
        },
        async likeReview(authorization, reviewId, add) {
            const review = id(reviewId); const { db, user } = await authenticated(authorization);
            const found = await result(db.from('reviews').select('id').eq('id', review).maybeSingle());
            if (!found.data) throw new ApiError(404, 'REVIEW_NOT_FOUND', 'Review não encontrada.');
            if (add) {
                let response;
                try { response = await db.from('review_curtidas').insert({ review_id: review, usuario_id: user.id }); }
                catch { throw unavailable(); }
                // Repetir a ação não cria uma segunda curtida.
                if (response.error?.code !== '23505') await result(Promise.resolve(response));
            } else {
                await result(db.from('review_curtidas').delete().eq('review_id', review).eq('usuario_id', user.id));
            }
            const total = await result(db.rpc('total_curtidas_review', { alvo: review }));
            return { curtida: add, curtidas: Number(total.data) };
        },
        async deactivate(authorization, body) {
            if (typeof body?.senha !== 'string' || !body.senha || body.senha.length > 256) throw invalid('Informe sua senha atual.');
            const { user, token } = await authenticated(authorization);
            const attempt = attempts.get(user.id);
            if (attempt?.until > now() && attempt.count >= 5)
                throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde dez minutos.');
            // Cliente exclusivo: a reautenticação não modifica a sessão de outra requisição.
            let check;
            try { check = await client().auth.signInWithPassword({ email: user.email, password: body.senha }); }
            catch { throw unavailable(); }
            if (check.error?.status >= 500 || check.error?.name === 'AuthRetryableFetchError') throw unavailable();
            if (check.error?.status === 429) throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde um pouco.');
            if (check.error || check.data?.user?.id !== user.id) {
                if (!attempt || attempt.until <= now()) {
                    for (const [key, entry] of attempts) if (entry.until <= now()) attempts.delete(key);
                    attempts.set(user.id, { count: 1, until: now()+600000 });
                } else attempt.count += 1;
                throw new ApiError(401, 'INVALID_CREDENTIALS', 'Senha atual incorreta.');
            }
            // Primeiro bloqueia as regras do banco, inclusive para tokens antigos.
            await result(admin.rpc('gameatlas_desativar_conta', { alvo: user.id }));
            const signedOut = await result(admin.auth.admin.signOut(token, 'global'));
            const banned = await result(admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' }));
            if (!banned.data?.user) throw unavailable();
            attempts.delete(user.id);
            return { desativada: true, sessoes_encerradas: !signedOut.error };
        },
    };
}
