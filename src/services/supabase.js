import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export function database() {
    if (!supabase) throw new Error('A conexão com o banco ainda não está configurada.');
    return supabase;
}

export function accountError(error) {
    if (error?.name === 'AuthRetryableFetchError') return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
    if (error?.code === '23505') return 'Esse nome de usuário ou registro já está em uso.';
    if (error?.code === '23503') return 'O jogo ou a lista não está mais disponível. Atualize a página.';
    if (error?.code === '42501') return 'Você não tem permissão para essa ação. Entre na sua conta.';
    if (error?.code === '23514') return 'Confira os dados preenchidos e a nota de 1 a 5.';
    if (error?.code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
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
