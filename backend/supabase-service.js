import { createClient } from '@supabase/supabase-js';
import { ApiError } from './errors.js';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const unavailable = () => new ApiError(503, 'DATABASE_UNAVAILABLE', 'Não foi possível acessar o banco. Tente novamente.');

export function createSupabaseService({ url, publishableKey, secretKey, createClientImpl = createClient }) {
    const configured = Boolean(url && publishableKey && secretKey);
    const authClient = configured ? createClientImpl(url, publishableKey, clientOptions) : null;
    const admin = configured ? createClientImpl(url, secretKey, clientOptions) : null;
    return {
        configured,
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
