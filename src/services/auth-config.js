// As chaves publishable/anon são públicas; chaves secret/service_role são proibidas no navegador.
function isPublicKey(key) {
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    try {
        const parts = key.split('.');
        if (parts.length !== 3) return false;
        return JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/'))).role === 'anon';
    } catch { return false; }
}

export function resolveAuthConfig(env = {}, shared = {}) {
    const envUrl = env.VITE_SUPABASE_URL?.trim() || '';
    const envKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim() || '';
    const custom = Boolean(envUrl || envKey);
    const url = custom ? envUrl : shared.url?.trim();
    const key = custom ? envKey : shared.publishableKey?.trim();
    if (!url || !key) return { error: 'A conexão do login não está configurada. Preencha a URL e a chave pública do Supabase juntas e reinicie o site.' };
    try {
        const parsed = new URL(url);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
        if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/'
            || (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:'))) throw new Error('URL inválida');
    } catch { return { error: 'O endereço do Supabase para login é inválido. Confira a configuração do projeto.' }; }
    if (!isPublicKey(key)) return { error: 'O login precisa da chave pública publishable ou anon do Supabase. A chave privada deve ficar apenas no servidor.' };
    return { url: url.replace(/\/$/, ''), key, error: null };
}
