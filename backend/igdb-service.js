import { ApiError } from './errors.js';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_URL = 'https://api.igdb.com/v4/';
const MIN_INTERVAL_MS = 260;

const PLATFORM_FILTERS = {
    pc: 'platforms = (6)',
    playstation: 'platforms.platform_family = 1',
    xbox: 'platforms.platform_family = 2',
    nintendo: 'platforms.platform_family = 5',
    sega: 'platforms.platform_family = 3',
    mobile: 'platforms = (34,39)',
    'mac-linux': 'platforms = (14,3)',
    web: 'platforms = (82)',
};

const ORDER = {
    '-added': 'total_rating_count desc',
    '-rating': 'rating desc',
    '-metacritic': 'aggregated_rating desc',
    '-released': 'first_release_date desc',
    name: 'name asc',
};
const ORDERING_BY_SORT = { popular: '-added', rating: '-rating', recent: '-released', name: 'name' };

const unix = (date) => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
const quoted = (value) => `"${String(value).replace(/["\\]/g, '')}"`;

function buildWhere({ genres, tags, dates, parent_platforms, hide_extras }, ordering) {
    const rules = [];
    if (genres) rules.push(`genres.slug = (${genres.split(',').map(quoted).join(',')})`);
    if (tags) rules.push(`game_modes.slug = ${quoted(tags)}`);
    if (parent_platforms) rules.push(PLATFORM_FILTERS[parent_platforms]);
    if (dates) {
        const [start, end] = dates.split(',');
        rules.push(`first_release_date >= ${unix(start)} & first_release_date <= ${unix(end)}`);
    }
    if (hide_extras) rules.push('parent_game = null & version_parent = null');
    if (ordering === '-rating') rules.push('rating_count >= 20');
    if (ordering === '-metacritic') rules.push('aggregated_rating_count >= 3');
    return rules.filter(Boolean).join(' & ');
}

export function createIgdbClient({ clientId, clientSecret, fetchImpl = fetch,
    now = Date.now }) {
    let token = null;
    let tokenExpires = 0;
    let queue = Promise.resolve();
    async function getToken() {
        if (token && tokenExpires > now()) return token;
        const params = new URLSearchParams({
            client_id: clientId, client_secret: clientSecret, grant_type:
                'client_credentials',
        });
        const response = await fetchImpl(`${TOKEN_URL}?${params}`, { method: 'POST' });
        if (!response.ok) throw new ApiError(502, 'IGDB_AUTH_ERROR', 'A Twitch recusou as credenciais do servidor.');
        const data = await response.json();
        token = data.access_token;
        tokenExpires = now() + (data.expires_in - 60) * 1000;
        return token;
    }
    function throttled(task) {
        const run = queue.then(task);
        queue = run.catch(() => { }).then(() => new Promise((done) =>
            setTimeout(done, MIN_INTERVAL_MS)));
        return run;
    } return async function query(endpoint, body, retried = false) {
        if (!clientId || !clientSecret) {
            throw new ApiError(503, 'IGDB_NOT_CONFIGURED', 'Configure as credenciais da Twitch em backend /.env.local.');
        }
        const response = await throttled(async () => fetchImpl(new
            URL(endpoint, IGDB_URL), {
            method: 'POST',
            headers: {
                'Client-ID': clientId, Authorization: `Bearer ${await
                    getToken()}`, Accept: 'application/json'
            },
            body,
            signal: AbortSignal.timeout(15000),
        }));
        if (response.status === 401 && !retried) {
            token = null;
            return query(endpoint, body, true);
        }
        if (response.status === 429) throw new ApiError(503,
            'IGDB_RATE_LIMIT', 'Limite de consultas da IGDB atingido.'); if (!response.ok) throw new ApiError(502, 'IGDB_UNAVAILABLE', 'A IGDBestá indisponível no momento.');
        return {
            data: await response.json(), total:
                Number(response.headers.get('x-count')) || 0
        };
    };
}
export const LIST_FIELDS = `fields name,slug,cover.image_id,artworks.image_id,screenshots.image_id,
summary,rating,rating_count,aggregated_rating,first_release_date,genres.name,genres.slug,platforms.name,game_modes.slug,
involved_companies.developer,involved_companies.publisher,involved_companies.company.name;`;

const image = (item, size) => item?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_${size}/${item.image_id}.jpg` : null;

export function normalizeGame(game) {
    const names = (items) => (items || []).map((item) => item.name).filter(Boolean);
    const companies = (role) => (game.involved_companies || [])
        .filter((item) => item[role]).map((item) => item.company?.name).filter(Boolean);
    const released = game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null;
    const platforms = names(game.platforms);
    const genres = names(game.genres);
    const wide = game.artworks?.[0] || game.screenshots?.[0];
    const hasRating = Number.isFinite(game.rating);
    return {
        id: game.id,
        slug: game.slug || '',
        title: game.name || 'Jogo sem título',
        image: image(game.cover, 'cover_big'),
        banner: image(wide, '1080p') || image(game.cover, 'cover_big'),
        description: game.summary || '',
        rating: hasRating ? Math.round(game.rating) / 10 : null,
        public_stars: hasRating ? game.rating / 20 : null,
        critic_score: Number.isFinite(game.aggregated_rating) ? Math.round(game.aggregated_rating) : null,
        ratings_count: game.rating_count ?? null,
        ratings: [],
        platform: platforms.join(' / ') || 'Não informado',
        platforms,
        genre: genres.join(' / ') || 'Não informado',
        genres,
        genre_slugs: (game.genres || []).map((item) => item.slug).filter(Boolean),
        developers: companies('developer'),
        publishers: companies('publisher'),
        released,
        year: released ? Number(released.slice(0, 4)) : null,
        multiplayer: (game.game_modes || []).some((mode) => mode.slug === 'multiplayer'),
        playtime: null,
        website: null,
    };
}
const DETAIL_FIELDS = LIST_FIELDS.replace(/;$/, ',videos.video_id,videos.name;');

function normalizeDetails(game) {
    const shots = (game.screenshots || []).map((item) => image(item, '1080p')).filter(Boolean);
    const fallback = (game.artworks || []).map((item) => image(item, '1080p')).filter(Boolean);
    const videos = (game.videos || []).filter((item) => item.video_id);
    const video = videos.find((item) => /trailer/i.test(item.name || '')) || videos[0];
    return {
        ...normalizeGame(game),
        screenshots: shots.length ? shots : fallback,
        trailer: video ? { name: video.name || '', youtubeId: video.video_id } : null,
    };
}

export function createIgdbService({ clientId, clientSecret, fetchImpl, now, onDiagnostic = () => { }, translateDescription }) {
    const client = createIgdbClient({ clientId, clientSecret, fetchImpl, now });
    const cache = new Map();

    async function query(endpoint, body) {
        const key = `${endpoint}:${body}`;
        const cached = cache.get(key);
        if (cached && cached.expires > Date.now()) return cached.value;
        const value = await client(endpoint, body);
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { value, expires: Date.now() + 300000 });
        return value;
    }

    async function getGame(id) {
        const { data } = await query('games', `${DETAIL_FIELDS} where id = ${id}; limit 1;`);
        if (!data[0]) throw new ApiError(404, 'GAME_NOT_FOUND', 'Jogo não encontrado.');
        const game = normalizeDetails(data[0]);

        if (!translateDescription) return game;
        try {
            const translated = await translateDescription(game.description);
            return {
                ...game,
                description: translated.text,
                description_translation: translated.status,
                description_language: translated.language,
            };
        } catch {
            // Uma falha de tradução não impede a exibição do jogo.
            onDiagnostic({
                endpoint: `games/${id}/translation`, attempt: 1, status: null,
                code: 'TRANSLATION_UNAVAILABLE', retrying: false,
            });
            return { ...game, description: '', description_translation: 'unavailable', description_language: 'pt-BR' };
        }
    }

    async function listGames(params) {
        const { page = 1, page_size = 20, search, sort = 'ordering' } = params;
        const ordering = ORDERING_BY_SORT[sort] || params.ordering || '-added';
        const useRelevance = search && sort === 'relevance';
        const where = buildWhere(params, useRelevance ? null : ordering);
        const clauses = [LIST_FIELDS];

        if (useRelevance) {
            clauses.push(`search ${quoted(search)};`);
            if (where) clauses.push(`where ${where};`);
        } else {
            const byName = search ? `name ~ *${quoted(search)}*` : '';
            const fullWhere = [byName, where].filter(Boolean).join(' & ');
            if (fullWhere) clauses.push(`where ${fullWhere};`);
            clauses.push(`sort ${ORDER[ordering] || ORDER['-added']};`);
        }
        clauses.push(`limit ${page_size}; offset ${(page - 1) * page_size};`);

        const { data, total } = await query('games', clauses.join(' '));
        const hasNext = total ? page * page_size < total : data.length === page_size;
        return {
            count: total || data.length,
            count_scope: 'total',
            has_more: false,
            next: hasNext ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: data.map(normalizeGame),
        };
    }

    async function categories(keys) {
        const today = Math.floor(Date.now() / 1000);
        const DAY = 86400;
        const base = 'cover != null & parent_game = null & version_parent = null';
        const rules = {
            emAlta: `where ${base} & first_release_date >= ${today - 730 * DAY} & first_release_date <= ${today}; sort total_rating_count desc;`,
            melhoresAv: `where ${base} & aggregated_rating_count >= 3; sort aggregated_rating desc;`,
            lancamentos: `where ${base} & first_release_date >= ${today - 90 * DAY} & first_release_date <= ${today}; sort first_release_date desc;`,
            classicos: `where ${base} & first_release_date <= ${unix('2015-12-31')}; sort total_rating_count desc;`,
            indie: `where ${base} & genres.slug = "indie"; sort total_rating_count desc;`,
            multiplayer: `where ${base} & game_modes.slug = "multiplayer"; sort total_rating_count desc;`,
        };
        const body = keys.map((key) => `query games "${key}" { ${LIST_FIELDS} ${rules[key]} limit 12; };`).join('\n');
        const { data } = await query('multiquery', body);

        const games = {};
        const categoryIds = {};
        for (const group of data) {
            const items = group.result.map(normalizeGame);
            categoryIds[group.name] = items.map((game) => game.id);
            for (const game of items) games[game.id] = game;
        }
        return { games, categories: categoryIds };
    }

    async function metadata(resource, { page = 1, page_size = 40 }) {
        const { data, total } = await query(resource,
            `fields id,name,slug; sort name asc; limit ${page_size}; offset ${(page - 1) * page_size};`);
        const hasNext = total ? page * page_size < total : data.length === page_size;
        return {
            count: total || data.length,
            next: hasNext ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: data,
        };
    }

    return { listGames, categories, getGame, metadata };
}