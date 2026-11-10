import { database, resultOf } from './supabase';
import { localGame } from './account';
import { selectedFavorites } from './favorite-games-model';

export async function loadFavoriteGames(userId) {
    const { data } = await resultOf(database().from('perfil_jogos_favoritos')
        .select('jogo_id,jogos!inner(rawg_id,nome,capa_url)').eq('usuario_id', userId).order('posicao'));
    return data.map(row => ({ id: row.jogos.rawg_id, title: row.jogos.nome, image: row.jogos.capa_url }));
}

export async function saveFavoriteGames(items) {
    const { games, legacy } = selectedFavorites(items);
    const linked = [];
    for (const game of games) linked.push(await localGame(game.id));
    await resultOf(database().rpc('salvar_favoritos_igdb', { jogos: linked.map(game => game.id), legados: legacy }));
    return [...linked.map(game => ({ id: game.rawg_id, title: game.nome, image: game.capa_url })), ...legacy];
}
