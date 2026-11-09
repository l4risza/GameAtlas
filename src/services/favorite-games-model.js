export const favoriteTitle = game => typeof game === 'string' ? game : game.title;
export const favoriteKey = game => typeof game === 'string' ? `legacy:${game}` : `igdb:${game.id}`;

export function selectedFavorites(items) {
    if (!Array.isArray(items) || items.length > 5) throw new Error('Você pode ter até 5 jogos favoritos.');
    const games = []; const legacy = []; const ids = new Set();
    for (const item of items) {
        if (typeof item === 'string') { legacy.push(item); continue; }
        if (!Number.isSafeInteger(item?.id) || item.id <= 0) throw new Error('Selecione um jogo nos resultados da busca.');
        if (ids.has(item.id)) throw new Error('Esse jogo já está nos favoritos.');
        ids.add(item.id); games.push(item);
    }
    return { games, legacy };
}

export function addSelectedFavorite(items, game) {
    selectedFavorites([game]);
    if (typeof game === 'string') throw new Error('Selecione um jogo nos resultados da busca.');
    if (items.some(item => typeof item !== 'string' && item.id === game.id)) throw new Error('Esse jogo já está nos favoritos.');
    // Um nome antigo só é substituído quando o usuário escolhe o jogo real.
    const remaining = items.filter(item => typeof item !== 'string' || item.trim().toLowerCase() !== game.title.trim().toLowerCase());
    const next = [...remaining, game];
    selectedFavorites(next);
    return next;
}
