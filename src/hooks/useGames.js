import { useApi } from './useApi';
import { getGameById, searchGames } from '../services/api';
import { ORDERING_BY_SORT } from '../services/search-options';

const PAGE_SIZE = 48;
const ALL_CATEGORIES = 'emAlta,melhoresAv,lancamentos,classicos,indie,multiplayer';

export function useGames({ search = '', page = 1, platform = '', genre = '', sort = 'relevance',
    hideExtras = true, batch = 1, categories: included = ALL_CATEGORIES, dates = '', tags = '' } = {}) {
    const term = search.trim();
    const browsing = !term && Boolean(platform || genre || dates || tags || (sort && sort !== 'relevance'));
    const path = term
        ? `/jogos/busca?${new URLSearchParams({ q: term, page, page_size: PAGE_SIZE, sort,
            hide_extras: hideExtras, batch, ...(platform && { parent_platforms: platform }), ...(genre && { genres: genre }) })}`
        : browsing 
            ? `/jogos?${new URLSearchParams({ page, page_size: PAGE_SIZE, ordering: ORDERING_BY_SORT[sort] || '-added',
                ...(platform && { parent_platforms: platform }), ...(genre && { genres: genre }),
                ...(dates && { dates }), ...(tags && { tags }) })}`
            : `/jogos/categorias?${new URLSearchParams({ include: included })}`;
    const { data, loading, error, reload } = useApi(path);
    const games = data?.games || Object.fromEntries((data?.results || []).map((game) => [game.id, game]));
    const categories = data?.categories || { todos: (data?.results || []).map((game) => game.id) };
    const resolveCategory = (key) => (categories[key] || []).map((id) => games[id]).filter(Boolean);

    return {
        games, categories, loading, error, reload, resolveCategory,
        results: data?.results || [], count: data?.count || 0,
        countScope: data?.count_scope || 'total',
        next: data?.next ?? null, previous: data?.previous ?? null,
        hasMore: data?.has_more || false,
        getGameById, searchGames,
    };
}
