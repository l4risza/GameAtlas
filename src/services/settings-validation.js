// Validações puras (sem React nem Supabase) das telas de configurações.
// Cada função devolve { value } quando está tudo certo ou { error } com a mensagem para o usuário.

export const NAME_MAX = 100;
export const BIO_MAX = 1000;
export const FAVORITES_MAX = 5;
export const FAVORITE_MAX_LENGTH = 60;
export const SOCIALS_MAX = 6;
export const PASSWORD_MIN = 8;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

// "hosts" limita o endereço ao domínio da rede; null = qualquer site https.
export const SOCIAL_NETWORKS = {
    instagram: { label: 'Instagram', icon: 'bi-instagram', hosts: ['instagram.com'] },
    github: { label: 'GitHub', icon: 'bi-github', hosts: ['github.com'] },
    linkedin: { label: 'LinkedIn', icon: 'bi-linkedin', hosts: ['linkedin.com'] },
    x: { label: 'X', icon: 'bi-twitter-x', hosts: ['x.com', 'twitter.com'] },
    youtube: { label: 'YouTube', icon: 'bi-youtube', hosts: ['youtube.com', 'youtu.be'] },
    twitch: { label: 'Twitch', icon: 'bi-twitch', hosts: ['twitch.tv'] },
    steam: { label: 'Steam', icon: 'bi-steam', hosts: ['steamcommunity.com'] },
    discord: { label: 'Discord', icon: 'bi-discord', hosts: ['discord.gg', 'discord.com'] },
    site: { label: 'Site', icon: 'bi-globe', hosts: null },
};

export function checkDisplayName(raw) {
    const value = String(raw ?? '').trim();
    if (!value) return { error: 'Informe um nome de exibição.' };
    if (value.length > NAME_MAX) return { error: `Use no máximo ${NAME_MAX} caracteres.` };
    return { value };
}

// Vazio remove o nome de usuário (a coluna aceita null).
export function checkUsername(raw) {
    const value = String(raw ?? '').trim().replace(/^@/, '');
    if (!value) return { value: null };
    if (!USERNAME_PATTERN.test(value)) return { error: 'Use de 3 a 30 letras, números ou sublinhados.' };
    return { value };
}

// Cadastro: aqui o nome de usuário é obrigatório (nas Configurações ele pode ser removido).
export function checkSignupUsername(raw) {
    const checked = checkUsername(raw);
    if (checked.error) return checked;
    if (!checked.value) return { error: 'Escolha um nome de usuário.' };
    return checked;
}

export function checkBio(raw) {
    const value = String(raw ?? '').trim();
    if (value.length > BIO_MAX) return { error: `Use no máximo ${BIO_MAX} caracteres.` };
    return { value: value || null };
}

export function checkEmail(raw, current) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: 'Informe um e-mail válido.' };
    if (value === String(current ?? '').toLowerCase()) return { error: 'Esse já é o seu e-mail atual.' };
    return { value };
}

export function checkPasswordChange(current, next) {
    if (!current) return { error: 'Informe sua senha atual.' };
    if (String(next ?? '').length < PASSWORD_MIN) return { error: `A nova senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.` };
    if (next === current) return { error: 'A nova senha deve ser diferente da atual.' };
    return {};
}

// Página "criar nova senha" (sem senha atual: o link do e-mail já comprovou quem é).
export function checkResetPassword(next, confirm) {
    if (String(next ?? '').length < PASSWORD_MIN) return { error: `A nova senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.` };
    if (next !== confirm) return { error: 'As senhas precisam ser iguais.' };
    return {};
}

export function checkFavorite(raw, list = []) {
    const value = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!value) return { error: 'Digite o nome do jogo.' };
    if (value.length > FAVORITE_MAX_LENGTH) return { error: `Use no máximo ${FAVORITE_MAX_LENGTH} caracteres.` };
    if (list.length >= FAVORITES_MAX) return { error: `Você pode ter até ${FAVORITES_MAX} jogos favoritos.` };
    if (list.some((item) => item.toLowerCase() === value.toLowerCase())) return { error: 'Esse jogo já está na lista.' };
    return { value };
}

// Só aceita https. Sem esquema, completa com https://. Bloqueia javascript:, http:, usuário/senha na URL
// e, nas redes conhecidas, domínios que não sejam da própria rede.
export function checkSocial(network, rawUrl, list = []) {
    const info = SOCIAL_NETWORKS[network];
    if (!info) return { error: 'Escolha uma rede social.' };
    if (list.length >= SOCIALS_MAX) return { error: `Você pode ter até ${SOCIALS_MAX} redes sociais.` };
    if (list.some((item) => item.rede === network)) {
        return { error: `Você já adicionou ${info.label}. Remova o atual antes de trocar.` };
    }
    let text = String(rawUrl ?? '').trim();
    if (!text) return { error: 'Cole o endereço do seu perfil.' };
    if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`;
    let url;
    try { url = new URL(text); } catch { return { error: 'Esse endereço não parece válido.' }; }
    if (url.protocol !== 'https:') return { error: 'Use um endereço que comece com https://.' };
    if (url.username || url.password) return { error: 'O endereço não pode conter usuário ou senha.' };
    const host = url.hostname.toLowerCase();
    if (!host.includes('.')) return { error: 'Esse endereço não parece válido.' };
    if (info.hosts && !info.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        return { error: `O endereço precisa ser do ${info.label} (${info.hosts[0]}).` };
    }
    if (url.href.length > 190) return { error: 'O endereço é longo demais.' };
    return { value: { rede: network, url: url.href } };
}

// Devolve a mensagem de erro, ou '' quando o arquivo é aceitável.
export function checkAvatarFile(file) {
    if (!file) return 'Escolha uma imagem.';
    if (!AVATAR_TYPES.includes(file.type)) return 'Use uma imagem JPG, PNG ou WebP.';
    if (file.size > AVATAR_MAX_BYTES) return 'A imagem deve ter no máximo 5 MB.';
    return '';
}
