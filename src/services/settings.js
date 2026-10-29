import { accountError, database, resultOf } from './supabase';
import { checkAvatarFile } from './settings-validation';

const BASE_COLUMNS = 'id,nome,username,avatar_url,bio';
// Colunas criadas pela migração 20261014000100_configuracoes.sql.
const EXTRA_COLUMNS = 'jogos_favoritos,redes_sociais,mostrar_reviews,mostrar_listas,ordem_reviews,ordem_listas';
// Valores usados enquanto a migração das configurações não foi aplicada (ou o perfil ainda não tem dados).
export const PROFILE_EXTRAS_DEFAULTS = { jogos_favoritos: [], redes_sociais: [], mostrar_reviews: true, mostrar_listas: true,
    ordem_reviews: 'recentes', ordem_listas: 'recentes' };
const AVATAR_BUCKET = 'avatares';
const AVATAR_SIZE = 256;

function settingsError(error) {
    if (error?.code === 'email_exists') return 'Esse e-mail já está em uso por outra conta.';
    if (error?.code === 'same_password') return 'A nova senha deve ser diferente da atual.';
    if (error?.code === 'reauthentication_needed') return 'Entre novamente na sua conta para fazer essa alteração.';
    if (error?.code === 'email_address_invalid') return 'Esse e-mail não é aceito. Confira o endereço.';
    return accountError(error);
}

function storageError(error) {
    const status = String(error?.statusCode ?? error?.status ?? '');
    const message = String(error?.message ?? '');
    if (status === '404' || /bucket not found/i.test(message)) return 'O envio de fotos ainda não está habilitado no banco.';
    if (status === '413' || /exceeded|too large/i.test(message)) return 'A imagem é grande demais.';
    if (status === '403' || /row-level security|unauthorized/i.test(message)) return 'Você não tem permissão para enviar essa foto.';
    return 'Não foi possível enviar a foto. Tente novamente.';
}

// true = livre, false = já em uso, null = não deu para verificar (o banco continua recusando nomes repetidos no cadastro).
export async function isUsernameAvailable(username) {
    try {
        const { data, error } = await database().rpc('username_disponivel', { candidato: username });
        return error || typeof data !== 'boolean' ? null : data;
    } catch { return null; }
}

// Carrega o perfil em duas consultas: se a migração das configurações ainda não foi aplicada,
// as colunas extras não existem e a tela continua funcionando só com os campos básicos.
export async function loadSettingsProfile(userId) {
    const { data: profile } = await resultOf(database().from('perfis').select(BASE_COLUMNS).eq('id', userId).single());
    const extra = await database().from('perfis').select(EXTRA_COLUMNS).eq('id', userId).single();
    const missingColumns = extra.error && (extra.error.code === '42703' || /does not exist/i.test(extra.error.message ?? ''));
    if (extra.error && !missingColumns) throw new Error(accountError(extra.error));
    return { profile, extras: extra.error ? null : extra.data };
}

// Devolve os valores gravados (as mesmas chaves de "fields") para a tela se atualizar sem recarregar.
export async function updateProfile(userId, fields) {
    const columns = Object.keys(fields).join(',');
    const { data } = await resultOf(database().from('perfis').update(fields).eq('id', userId).select(columns).single());
    return data;
}

// Recorta o centro da imagem em um quadrado de 256 px e converte para JPEG (~30 KB).
async function squareJpeg(file) {
    const bitmap = await createImageBitmap(file);
    try {
        const side = Math.min(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const context = canvas.getContext('2d');
        context.fillStyle = '#140A28'; // fundo para PNGs com transparência
        context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
        if (!blob) throw new Error('Falha ao converter a imagem.');
        return blob;
    } finally {
        bitmap.close?.();
    }
}

export async function uploadAvatar(userId, file) {
    const problem = checkAvatarFile(file);
    if (problem) throw new Error(problem);
    let blob;
    try { blob = await squareJpeg(file); } catch { throw new Error('Não foi possível ler essa imagem. Tente outro arquivo.'); }
    const path = `${userId}/${Date.now()}.jpg`; // nome novo a cada envio evita foto antiga em cache
    const storage = database().storage.from(AVATAR_BUCKET);
    const { error } = await storage.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw new Error(storageError(error));
    return { path, url: storage.getPublicUrl(path).data.publicUrl };
}

export async function discardAvatar(path) {
    try { await database().storage.from(AVATAR_BUCKET).remove([path]); } catch { /* limpeza opcional */ }
}

// Apaga as fotos antigas do usuário, mantendo só "keepPath" (ou nenhuma, se for null).
export async function pruneAvatars(userId, keepPath) {
    try {
        const storage = database().storage.from(AVATAR_BUCKET);
        const { data } = await storage.list(userId, { limit: 100 });
        const old = (data ?? []).map((file) => `${userId}/${file.name}`).filter((path) => path !== keepPath);
        if (old.length) await storage.remove(old);
    } catch { /* limpeza opcional: arquivos antigos não atrapalham */ }
}

export async function requestEmailChange(newEmail) {
    const { error } = await database().auth.updateUser({ email: newEmail },
        { emailRedirectTo: `${window.location.origin}/configuracoes?aba=conta` });
    if (error) throw new Error(settingsError(error));
}

// O Supabase não confere a senha atual ao trocar de senha; por isso entramos de novo com ela antes.
export async function changePassword(email, currentPassword, newPassword) {
    const check = await database().auth.signInWithPassword({ email, password: currentPassword });
    if (check.error) {
        throw new Error(check.error.code === 'invalid_credentials' ? 'Senha atual incorreta.' : settingsError(check.error));
    }
    const { error } = await database().auth.updateUser({ password: newPassword });
    if (error) throw new Error(settingsError(error));
}

// Envia o link de redefinição. O endereço /redefinir-senha precisa estar na lista de URLs de redirecionamento
// do Supabase, e o projeto precisa ter envio de e-mail (SMTP) configurado para o link chegar.
export async function requestPasswordReset(email) {
    const { error } = await database().auth.resetPasswordForEmail(email,
        { redirectTo: `${window.location.origin}/redefinir-senha` });
    if (!error) return;
    if (error.code === 'unexpected_failure' || error.status >= 500) {
        throw new Error('Não foi possível enviar o e-mail agora. O envio de e-mails ainda precisa ser configurado pelo responsável pelo site.');
    }
    throw new Error(settingsError(error));
}

// Grava a nova senha usando a sessão de recuperação criada pelo link do e-mail.
export async function resetPassword(newPassword) {
    const { error } = await database().auth.updateUser({ password: newPassword });
    if (!error) return;
    if (error.name === 'AuthSessionMissingError') throw new Error('O link expirou ou já foi usado. Peça um novo link.');
    throw new Error(settingsError(error));
}

export async function signOutLocal() {
    const { error } = await database().auth.signOut({ scope: 'local' });
    if (error) throw new Error(settingsError(error));
}
