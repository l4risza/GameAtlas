import { database, resultOf } from './supabase';
import { requestJson } from './api';

const GAME_COLUMNS = 'id,rawg_id,nome,capa_url';
const REVIEW_COLUMNS = `id,usuario_id,nota,texto,criado_em,atualizado_em,jogos!inner(${GAME_COLUMNS}),perfis(nome,username)`;
export const PAGE_SIZE = 12;

export const reviewView = (row) => ({
    id: row.id, userId: row.usuario_id, rawgId: row.jogos.rawg_id,
    gameTitle: row.jogos.nome, gameImage: row.jogos.capa_url, rating: row.nota, text: row.texto,
    author: row.perfis?.username ? `@${row.perfis.username}` : row.perfis?.nome || 'Jogador',
    date: new Date(row.atualizado_em).toLocaleDateString('pt-BR')
});

export async function loadReviews(page = 1, userId, rawgId, order = 'recentes', excludeUserId) {
    let query = database().from('reviews').select(REVIEW_COLUMNS, { count: 'exact' });
    if (userId) query = query.eq('usuario_id', userId);
    if (excludeUserId) query = query.neq('usuario_id', excludeUserId);
    const { data, count } = await resultOf(query.order('atualizado_em', { ascending: order === 'antigas' })
        .order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1));
    return { items: data.map(reviewView), count };
}

export async function loadLists(page = 1, userId, order = 'recentes') {
    let query = database().from('listas').select('id,usuario_id,nome,descricao,publica,perfis(nome,username)', { count: 'exact' });
    query = userId ? query.eq('usuario_id', userId) : query.eq('publica', true);
    const { data, count } = await resultOf(query.order('criado_em', { ascending: order === 'antigas' })
        .order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1));
    return { items: data, count };
}

export async function loadSaved(page = 1) {
    const { data, count } = await resultOf(database().from('jogos_salvos')
        .select(`jogo_id,salvo_em,jogos(${GAME_COLUMNS})`, { count: 'exact' })
        .order('salvo_em', { ascending: false }).order('jogo_id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1));
    return { items: data.map((row) => row.jogos), count };
}

export async function localGame(rawgId) {
    const { data: { session }, error } = await database().auth.getSession();
    if (error || !session) throw new Error('Entre na sua conta para continuar.');
    return requestJson(`/biblioteca/jogos/${encodeURIComponent(rawgId)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
    });
}

export async function loadGameAccount(rawgId, userId) {
    const { data: game } = await resultOf(database().from('jogos').select('id').eq('rawg_id', rawgId).maybeSingle());
    let saved = false; let review = null;
    if (game) {
        const [s, r] = await Promise.all([
            resultOf(database().from('jogos_salvos').select('jogo_id').eq('usuario_id', userId).eq('jogo_id', game.id).maybeSingle()),
            resultOf(database().from('reviews').select('id,nota,texto').eq('usuario_id', userId).eq('jogo_id', game.id).maybeSingle()),
        ]);
        saved = Boolean(s.data); review = r.data;
    }
    return { gameId: game?.id, saved, review };
}

export async function saveGame(rawgId, userId) {
    const game = await localGame(rawgId);
    const result = await database().from('jogos_salvos').insert({ usuario_id: userId, jogo_id: game.id });
    if (result.error?.code !== '23505') await resultOf(Promise.resolve(result));
}
export async function removeSaved(gameId, userId) {
    await resultOf(database().from('jogos_salvos').delete().eq('usuario_id', userId).eq('jogo_id', gameId));
}
export async function saveReview(rawgId, userId, nota, texto, reviewId) {
    if (reviewId) {
        await resultOf(database().from('reviews').update({ nota, texto: texto.trim() || null })
            .eq('id', reviewId).eq('usuario_id', userId).select('id').single());
    } else {
        const game = await localGame(rawgId);
        await resultOf(database().from('reviews').insert({ usuario_id: userId, jogo_id: game.id, nota, texto: texto.trim() || null }));
    }
}
export async function deleteReview(id, userId) {
    await resultOf(database().from('reviews').delete().eq('id', id).eq('usuario_id', userId));
}
export async function addToList(rawgId, listId) {
    const game = await localGame(rawgId);
    const result = await database().from('lista_jogos').insert({ lista_id: listId, jogo_id: game.id });
    if (result.error?.code !== '23505') await resultOf(Promise.resolve(result));
}
const COVER_COUNT = 4;

// Até 4 capas para a miniatura da lista.
async function coversOf(listId) {
    const { data } = await resultOf(database().from('lista_jogos').select('jogos(capa_url)')
        .eq('lista_id', listId).order('posicao').order('adicionado_em').order('jogo_id').limit(COVER_COUNT));
    return data.map((row) => row.jogos?.capa_url).filter(Boolean);
}

// Listas com total de jogos e capas (usado na página Listas).
export async function loadListsWithCovers(page = 1, userId, order = 'recentes') {
    let query = database().from('listas')
        .select('id,usuario_id,nome,descricao,publica,perfis(nome,username),lista_jogos(count)', { count: 'exact' });
    query = userId ? query.eq('usuario_id', userId) : query.eq('publica', true);
    const { data, count } = await resultOf(query.order('criado_em', { ascending: order === 'antigas' })
        .order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1));
    const items = await Promise.all(data.map(async (row) => ({
        ...row, total: row.lista_jogos?.[0]?.count ?? 0, covers: await coversOf(row.id).catch(() => []),
    })));
    return { items, count };
}

// Resumo da lista geral "Jogos salvos" (total + capas).
export async function loadSavedSummary(userId) {
    const { data, count } = await resultOf(database().from('jogos_salvos')
        .select('jogo_id,jogos(capa_url)', { count: 'exact' }).eq('usuario_id', userId)
        .order('salvo_em', { ascending: false }).order('jogo_id').limit(COVER_COUNT));
    return { total: count ?? 0, covers: data.map((row) => row.jogos?.capa_url).filter(Boolean) };
}

export async function loadReview(id) {
    const { data } = await resultOf(database().from('reviews').select(REVIEW_COLUMNS).eq('id', id).maybeSingle());
    if (!data) throw new Error('Esta avaliação não existe mais.');
    return reviewView(data);
}

// Jogo já guardado no banco (pode não existir se ninguém salvou/avaliou ainda).
export async function findGame(rawgId) {
    const { data } = await resultOf(database().from('jogos').select('nome,capa_url').eq('rawg_id', rawgId).maybeSingle());
    return data;
}
