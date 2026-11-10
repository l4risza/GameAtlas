export const PLATFORMS = [
    ['pc', 'PC'], ['playstation', 'PlayStation'], ['xbox', 'Xbox'], ['nintendo', 'Nintendo'],
    ['mobile', 'Celular (iOS e Android)'], ['mac-linux', 'Mac e Linux'], ['sega', 'SEGA'], ['web', 'Navegador'],
];

export const GENRES = [
    ['adventure', 'Aventura'], ['role-playing-rpg', 'RPG'], ['strategy', 'Estratégia'],
    ['shooter', 'Tiro'], ['platform', 'Plataforma'], ['racing', 'Corrida'],
    ['sport', 'Esportes'], ['fighting', 'Luta'], ['puzzle', 'Quebra-cabeça'],
    ['simulator', 'Simulação'], ['indie', 'Indie'], ['arcade', 'Arcade'],
    ['card-and-board-game', 'Cartas e tabuleiro'],
];

export const SORTS = [
    ['relevance', 'Relevância'], ['popular', 'Mais populares'], ['rating', 'Melhores notas'], ['recent', 'Mais Recentes'],
    ['name', 'Nome (A–Z)'],
];

export const ORDERING_BY_SORT = {
    relevance: '-added', popular: '-added', rating: '-rating', recent: '-released', name: 'name',
};

export const CATEGORY_EXPLORE_PARAMS = {
    emAlta: { ordem: 'popular' },
    melhoresAv: { ordem: 'rating' },
    lancamentos: { ordem: 'recent' },
    classicos: { dates: '1970-01-01,2015-12-31' },
    indie: { genero: 'indie' },
    multiplayer: { tags: 'multiplayer' },
};

export function categoryExploreLink(key) {
    const extra = CATEGORY_EXPLORE_PARAMS[key];
    return extra ? `/explorar?${new URLSearchParams(extra)}` : '/explorar';
}