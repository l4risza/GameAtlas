export const PLATFORMS = [
    ['1', 'PC'], ['2', 'PlayStation'], ['3', 'Xbox'], ['7', 'Nintendo'],
    ['4,8', 'Celular (iOS e Android)'], ['5,6', 'Mac e Linux'], ['11', 'SEGA'], ['14', 'Navegador'],
];

export const GENRES = [
    ['action', 'Ação'], ['adventure', 'Aventura'], ['role-playing-games-rpg', 'RPG'],
    ['strategy', 'Estratégia'], ['shooter', 'Tiro'], ['platformer', 'Plataforma'],
    ['racing', 'Corrida'], ['sports', 'Esportes'], ['fighting', 'Luta'], ['puzzle', 'Quebra-cabeça'],
    ['simulation', 'Simulação'], ['indie', 'Indie'], ['casual', 'Casual'], ['arcade', 'Arcade'],
    ['family', 'Família'], ['massively-multiplayer', 'MMO'], ['board-games', 'Tabuleiro'],
    ['card', 'Cartas'], ['educational', 'Educativo'],
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