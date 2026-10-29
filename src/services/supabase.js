import { createClient } from '@supabase/supabase-js';
import projectPublic from '../config/supabase-public.json';
import { resolveAuthConfig } from './auth-config';
import { authErrorMessage } from './auth';

const config = resolveAuthConfig(import.meta.env, projectPublic);
export const authConfigurationError = config.error;
export const supabase = config.error ? null : createClient(config.url, config.key);

export function database() {
    if (!supabase) throw new Error(authConfigurationError || 'A conexão com o banco ainda não está configurada.');
    return supabase;
}

export function accountError(error) {
    const authMessage = authErrorMessage(error);
    if (authMessage) return authMessage;
    if (error?.code === '23505') return 'Esse nome de usuário ou registro já está em uso.';
    if (error?.code === '23503') return 'O jogo ou a lista não está mais disponível. Atualize a página.';
    if (error?.code === '42501') return 'Você não tem permissão para essa ação. Entre na sua conta.';
    if (error?.code === '23514') return 'Confira os dados preenchidos e a nota de 1 a 5.';
    if (error?.code === 'invalid_credentials') return 'E-mail, usuário ou senha incorretos.';
    if (error?.code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.';
    if (error?.code === 'user_already_exists') return 'Este e-mail já está cadastrado. Entre na sua conta.';
    if (error?.code === 'over_email_send_rate_limit' || error?.status === 429) return 'Aguarde um pouco antes de tentar novamente.';
    if (error?.code === 'weak_password') return 'Use uma senha mais forte, com pelo menos 8 caracteres.';
    return error instanceof Error && !error.code ? error.message : 'Não foi possível concluir. Tente novamente.';
}

export async function resultOf(query) {
    const result = await query;
    if (result.error) throw new Error(accountError(result.error));
    return result;
}
