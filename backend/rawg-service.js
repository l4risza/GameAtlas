import { ApiError } from './errors.js';
import { setTimeout as delay } from 'node:timers/promises';
import { createNameCatalog } from './name-catalog.js';
import { normalizeSearchText, compareGames, isDemoOrAddition } from './search-policy.js';

const RAWG_BASE_URL = 'https://api.rawg.io/api/';

export function normalizeGame(game) {
    const names = (items) => (items || []).map((item) => item.name).filter(Boolean);
    const platforms = names((game.platforms?.length ? game.platforms : game.parent_platforms || []).map((item) => item.platform || {}));
    const genres = names(game.genres);
    const rawgRating = Number.isFinite(game.rating) ? game.rating : null;
    return {
        id: game.id,
        slug: game.slug || '',
        title: game.name || 'Jogo sem título',
        image: game.background_image || null,
        banner: game.background_image || null,
        description: game.description_raw || '',
        rating: rawgRating === null ? null : Math.round(rawgRating * 20) / 10,
        rawg_rating: rawgRating,
        metacritic: game.metacritic ?? null,
        platform: platforms.join(' / ') || 'Não informado',
        platforms,
        genre: genres.join(' / ') || 'Não informado',
        genres,
        developers: names(game.developers),
        publishers: names(game.publishers),
        released: game.released || null,
        year: /^\d{4}-/.test(game.released || '') ? Number(game.released.slice(0, 4)) : null,
        multiplayer: (game.tags || []).some((tag) => tag.slug === 'multiplayer'),
        playtime: game.playtime ?? null,
        website: /^https?:\/\//i.test(game.website || '') ? game.website : null,
        rawg_url: game.slug ? `https://rawg.io/games/${encodeURIComponent(game.slug)}` : 'https://rawg.io',
    };
}

export function createRawgService({
    apiKey, fetchImpl = fetch, timeoutMs = 15000, cacheTtlMs = 300000, now = Date.now,
    retries = 2, retryDelayMs = 250, onDiagnostic = () => {},
    translateDescription,
    catalogPages = 25, catalogCacheFile,
}) {
    const cache = new Map();
    const pending = new Map();
    const loadCatalog = createNameCatalog({
        loadPage: async (params) => {
            const data = await request('games', params);
            if (!Array.isArray(data.results)) throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou uma resposta inválida.');
            return data;
        },
        pageCount: catalogPages, cacheFile: catalogCacheFile, now,
    });

    const searchCache = new Map();
    const searchPending = new Map();

    async function fetchData(url, endpoint) {
        // Todas as tentativas compartilham o mesmo limite de 15 segundos.
        const signal = AbortSignal.timeout(timeoutMs);
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            let upstreamStatus = null;
            try {
                const response = await fetchImpl(url, { signal, redirect: 'error' });
                upstreamStatus = response.status;
                if (!response.ok) {
                    if (response.status === 404) throw new ApiError(404, 'GAME_NOT_FOUND', 'Jogo não encontrado.');
                    if ([401, 403].includes(response.status)) throw new ApiError(502, 'RAWG_AUTH_ERROR', 'A RAWG recusou a chave configurada no servidor.');
                    if (response.status === 429) throw new ApiError(503, 'RAWG_RATE_LIMIT', 'Limite de consultas da RAWG atingido. Tente novamente mais tarde.');
                    const error = new ApiError(502, 'RAWG_UNAVAILABLE', 'A RAWG está temporariamente indisponível. Tente novamente em instantes.');
                    error.retryable = [408, 500, 502, 503, 504].includes(response.status);
                    throw error;
                }
                const data = await response.json();
                if (!data || typeof data !== 'object') throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou uma resposta inválida.');
                return data;
            } catch (error) {
                const timedOut = signal.aborted || ['TimeoutError', 'AbortError'].includes(error.name);
                const retryable = !timedOut && (!(error instanceof ApiError) || error.retryable === true);
                const retrying = retryable && attempt < retries;
                const rawCode = error.cause?.code || error.code || error.name;
                // O diagnóstico omite a URL completa, a chave e mensagens externas.
                onDiagnostic({ endpoint, attempt: attempt + 1, status: upstreamStatus,
                    code: /^[A-Z0-9_]+$/.test(rawCode || '') ? rawCode : 'RAWG_CONNECTION_ERROR', retrying });
                if (timedOut) throw new ApiError(504, 'RAWG_TIMEOUT', 'A RAWG demorou para responder. Tente novamente.');
                if (!retrying) {
                    if (error instanceof ApiError) throw error;
                    throw new ApiError(502, 'RAWG_UNAVAILABLE', 'Não foi possível conectar à RAWG. Verifique a conexão com a internet e tente novamente.');
                }
                try { await delay(retryDelayMs * (2 ** attempt), undefined, { signal }); } catch {
                    throw new ApiError(504, 'RAWG_TIMEOUT', 'A RAWG demorou para responder. Tente novamente.');
                }
            }
        }
    }

    async function request(endpoint, params = {}) {
        if (!apiKey) throw new ApiError(503, 'RAWG_NOT_CONFIGURED', 'Configure RAWG_API_KEY em backend/.env.local.');
        const cacheKey = `${endpoint}?${new URLSearchParams(Object.entries(params).sort())}`;
        const cached = cache.get(cacheKey);
        if (cached && cached.expires > now()) return cached.data;
        cache.delete(cacheKey);
        if (pending.has(cacheKey)) return pending.get(cacheKey);

        const task = (async () => {
            const url = new URL(endpoint, RAWG_BASE_URL);
            url.search = new URLSearchParams({ ...params, key: apiKey }).toString();
            try {
                const data = await fetchData(url, endpoint);
                if (cache.size >= 100) cache.delete(cache.keys().next().value);
                cache.set(cacheKey, { data, expires: now() + cacheTtlMs });
                return data;
            } catch (error) {
                if (error instanceof ApiError) throw error;
                if (['TimeoutError', 'AbortError'].includes(error.name)) throw new ApiError(504, 'RAWG_TIMEOUT', 'A RAWG demorou para responder. Tente novamente.');
                // Não devolver mensagens do fetch: elas podem conter a URL e a chave.
                throw new ApiError(502, 'RAWG_UNAVAILABLE', 'Não foi possível consultar a RAWG.');
            }
        })();
        pending.set(cacheKey, task);
        try { return await task; } finally { pending.delete(cacheKey); }
    }

    async function listGames(params) {
        if (normalizeSearchText(params.search) && catalogPages) return searchGames(params);
        const { sort = 'ordering', hide_extras = false } = params;
        const upstreamParams = { ...params };
        for (const option of ['sort', 'hide_extras', 'batch']) delete upstreamParams[option];
        if (hide_extras) upstreamParams.exclude_additions = true;
        const data = await request('games', upstreamParams);
        if (!Array.isArray(data.results)) throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou uma resposta inválida.');
        const search = normalizeSearchText(params.search);
        // A busca da RAWG é aproximada; a descrição nunca decide a correspondência.
        const matched = search
            ? data.results.filter((game) => typeof game?.name === 'string' && normalizeSearchText(game.name).includes(search) &&
                (!hide_extras || !isDemoOrAddition(game)))
            : data.results;
        if (search) matched.sort((left, right) => compareGames(left, right, { term: search, sort, ordering: params.ordering }));
        return {
            count: search ? matched.length : data.count || 0,
            count_scope: search ? 'page' : 'total',
            // Não repassar links da RAWG, pois eles incluem a chave da API.
            next: data.next ? Number(params.page || 1) + 1 : null,
            previous: data.previous ? Number(params.page || 1) - 1 : null,
            results: matched.map(normalizeGame),
        };
    }

    async function searchGames(params) {
        const { search, page = 1, page_size = 20, ordering = '-added',
            sort = 'ordering', hide_extras = false, batch = 1, ...filters } = params;
        if (hide_extras) filters.exclude_additions = true;
        const term = normalizeSearchText(search);
        const key = new URLSearchParams(Object.entries({ ...filters, search: term, ordering, sort, hide_extras, batch }).sort()).toString();
        let snapshot = searchCache.get(key);
        if (!snapshot || snapshot.expires <= now()) {
            if (!searchPending.has(key)) {
                const task = (async () => {
                    // A RAWG busca palavras completas. O catálogo complementa trechos internos.
                    const candidates = new Map();
                    let hasMore = false;
                    // Mostrar extras conserva também os candidatos da consulta de jogos completos.
                    const sources = hide_extras ? [filters] : [{ ...filters, exclude_additions: true }, filters];
                    for (const sourceFilters of sources) {
                        let sourceHasMore = false;
                        const catalog = await loadCatalog(sourceFilters);
                        for (const game of catalog) candidates.set(game.id, game);
                        for (let upstreamPage = 1; upstreamPage <= batch * 3; upstreamPage += 1) {
                            const data = await request('games', { ...sourceFilters, search, ordering, page_size: 40, page: upstreamPage });
                            if (!Array.isArray(data.results)) throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou uma resposta inválida.');
                            for (const game of data.results) if (Number.isInteger(game.id)) candidates.set(game.id, game);
                            sourceHasMore = Boolean(data.next);
                            if (!data.next) break;
                        }
                        hasMore ||= sourceHasMore;
                    }
                    const games = [...candidates.values()].filter((game) =>
                        typeof game.name === 'string' && normalizeSearchText(game.name).includes(term) &&
                        (!hide_extras || !isDemoOrAddition(game)));
                    games.sort((left, right) => compareGames(left, right, { term, sort, ordering }));
                    const value = { games, hasMore: hasMore && batch < 20, expires: now() + cacheTtlMs };
                    if (searchCache.size >= 100) searchCache.delete(searchCache.keys().next().value);
                    searchCache.set(key, value);
                    return value;
                })();
                searchPending.set(key, task);
            }
            try { snapshot = await searchPending.get(key); } finally { searchPending.delete(key); }
        }
        const start = (page - 1) * page_size;
        return {
            count: snapshot.games.length, count_scope: 'available',
            has_more: snapshot.hasMore,
            next: start + page_size < snapshot.games.length ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: snapshot.games.slice(start, start + page_size).map(normalizeGame),
        };
    }

     async function categories(keys) {

        const end = new Date(now());

        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 90);

        const twoYearsAgo = new Date(end);
        twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);

        const queries = {
            //emAlta: { ordering: '-added'},
            emAlta: {ordering: '-added', dates: `${twoYearsAgo.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`},
            melhoresAv: { ordering: '-metacritic', metacritic: '1,100' },
            lancamentos: { ordering: '-released', dates: `${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}` },
            classicos: { ordering: '-added', dates: '1970-01-01,2015-12-31' },
            indie: { ordering: '-added', genres: 'indie' },
            multiplayer: { ordering: '-added', tags: 'multiplayer' },
        };
        const groups = await Promise.all(keys.map(async (key) => [key, await listGames({ page: 1, page_size: 12, ...queries[key] })]));
        const games = {};
        const categoryIds = {};
        for (const [key, group] of groups) {
            categoryIds[key] = group.results.map((game) => game.id);
            for (const game of group.results) games[game.id] = game;
        }
        return { games, categories: categoryIds };
    }

    return {
        listGames,
        categories,
        async getGame(id) {
            const data = await request(`games/${id}`);
            if (!Number.isInteger(data.id)) throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou uma resposta inválida.');
            const game = normalizeGame(data);
            if (!translateDescription) return game;
            try {
                const translated = await translateDescription(game.description);
                return { ...game, description: translated.text,
                    description_translation: translated.status, description_language: translated.language };
            } catch {
                // Uma falha de tradução não impede a exibição dos detalhes do jogo.
                onDiagnostic({ endpoint: `games/${id}/translation`, attempt: 1, status: null,
                    code: 'TRANSLATION_UNAVAILABLE', retrying: false });
                return { ...game, description: '', description_translation: 'unavailable', description_language: 'pt-BR' };
            }
        },
        async metadata(resource, params) {
            const data = await request(resource, params);
            if (!Array.isArray(data.results)) throw new ApiError(502, 'RAWG_INVALID_RESPONSE', 'A RAWG retornou uma resposta inválida.');
            return {
                count: data.count || 0,
                next: data.next ? params.page + 1 : null,
                previous: data.previous ? params.page - 1 : null,
                results: data.results.map(({ id, name, slug }) => ({ id, name, slug })),
            };
        },
    };
}
