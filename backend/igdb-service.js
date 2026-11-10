import { createIgdbClient } from './igdb-client.js';
export { createIgdbClient } from './igdb-client.js';
import { ApiError } from './errors.js';

const PLATFORM_FILTERS = {
    pc: 'platforms = (6)',
    playstation: 'platforms.platform_family.slug = "playstation"',
    xbox: 'platforms.platform_family.slug = "xbox"',
    nintendo: 'platforms.platform_family.slug = "nintendo"',
    sega: 'platforms.platform_family.slug = "sega"',
    mobile: 'platforms = (34,39)',
    'mac-linux': 'platforms = (14,3)',
    web: 'platforms = (82)',
};

const ORDER = {
    added: 'total_rating_count asc', rating: 'rating asc', metacritic: 'aggregated_rating asc',
    released: 'first_release_date asc', '-name': 'name desc',
    created: 'created_at asc', '-created': 'created_at desc', updated: 'updated_at asc', '-updated': 'updated_at desc',
    '-added': 'total_rating_count desc',
    '-rating': 'rating desc',
    '-metacritic': 'aggregated_rating desc',
    '-released': 'first_release_date desc',
    name: 'name asc',
};
const ORDERING_BY_SORT = { popular: '-added', rating: '-rating', recent: '-released', name: 'name' };

const unix = (date) => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
const quoted = (value) => JSON.stringify(String(value));

function buildWhere({ genres, tags, dates, platforms, developers, metacritic, parent_platforms, hide_extras }, ordering) {
    const rules = [];
    const filter=(field,value)=>`${field}${/^\d+(,\d+)*$/.test(value)?'':'.slug'} = (${value.split(',').map(x=>/^\d+$/.test(x)?x:quoted(x)).join(',')})`;
    if (genres) rules.push(filter('genres',genres));
    if (platforms) rules.push(filter('platforms',platforms));
    if (developers) rules.push(`involved_companies.developer = true & ${filter('involved_companies.company',developers)}`);
    if (metacritic) {const [min,max]=metacritic.split(',');rules.push(`aggregated_rating >= ${min} & aggregated_rating <= ${max}`);}
    if (tags) rules.push(tags==='multiplayer'?'game_modes.slug = "multiplayer"':filter('keywords',tags));
    if (parent_platforms) rules.push(PLATFORM_FILTERS[parent_platforms]);
    if (dates) {
        const [start, end] = dates.split(',');
        rules.push(`first_release_date >= ${unix(start)} & first_release_date <= ${unix(end)+86399}`);
    }
    if (hide_extras) rules.push('game_type.type = ("Main Game","Remake","Remaster") & parent_game = null & version_parent = null');
    if (ordering === '-rating') rules.push('rating_count >= 20');
    if (ordering === '-metacritic') rules.push('aggregated_rating_count >= 3');
    return rules.filter(Boolean).join(' & ');
}

export const LIST_FIELDS = `fields name,slug,cover.image_id,artworks.image_id,screenshots.image_id,
summary,rating,rating_count,aggregated_rating,first_release_date,genres.name,genres.slug,platforms.name,game_modes.slug,
involved_companies.developer,involved_companies.publisher,involved_companies.company.name;`;

const image = (item, size) => /^[a-z0-9_]+$/i.test(item?.image_id || '')
    ? `https://images.igdb.com/igdb/image/upload/t_${size}/${item.image_id}.jpg` : null;

export function normalizeGame(game) {
    if(!game||!Number.isSafeInteger(game.id)||game.id<=0||typeof game.name!=='string')
        throw new ApiError(502,'IGDB_INVALID_RESPONSE','A IGDB retornou um jogo inválido.');
    const names = (items) => (items || []).map((item) => item.name).filter(Boolean);
    const companies = (role) => (game.involved_companies || [])
        .filter((item) => item[role]).map((item) => item.company?.name).filter(Boolean);
    const released = Number.isFinite(game.first_release_date) && Math.abs(game.first_release_date)<8640000000000
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null;
    const platforms = names(game.platforms);
    const genres = names(game.genres);
    const wide = game.artworks?.[0] || game.screenshots?.[0];
    const hasRating = Number.isFinite(game.rating);
    return {
        id: game.id,
        slug: game.slug || '',
        title: game.name || 'Jogo sem título',
        image: image(wide, 'screenshot_big') || image(game.cover, 'cover_big'),
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
    const videos = (game.videos || []).filter((item) => /^[a-zA-Z0-9_-]{11}$/.test(item.video_id || ''));
    const video = videos.find((item) => /trailer/i.test(item.name || '')) || videos[0];
    return {
        ...normalizeGame(game),
        screenshots: shots.length ? shots : fallback,
        trailer: video ? { name: video.name || '', youtubeId: video.video_id } : null,
    };
}

export function createIgdbService({ clientId, clientSecret, fetchImpl, now=Date.now, sleep, timeoutMs, onDiagnostic = () => { }, translateDescription }) {
    const client = createIgdbClient({ clientId, clientSecret, fetchImpl, now, sleep, timeoutMs });
    const cache = new Map();
    const pending = new Map();

    async function query(endpoint, body) {
        const key = `${endpoint}:${body}`;
        const cached = cache.get(key);
        if (cached && cached.expires > now()) return cached.value;
        if(pending.has(key)) return pending.get(key);
        const task=(async()=>{const value=await client(endpoint,body);
            if(cache.size>=100) cache.delete(cache.keys().next().value);
            cache.set(key,{value,expires:now()+300000});return value;})();
        pending.set(key,task);try{return await task;}finally{pending.delete(key);}
    }

    async function getGame(id) {
        const { data } = await query('games', `${DETAIL_FIELDS} where id = ${id}; limit 1;`);
        if (!data[0]) throw new ApiError(404, 'GAME_NOT_FOUND', 'Jogo não encontrado.');
        if(data[0].id!==id) throw new ApiError(502,'IGDB_INVALID_RESPONSE','A IGDB retornou outro identificador de jogo.');
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
            return { ...game, description_translation: 'unavailable', description_language: null };
        }
    }

    async function listGames(params) {
        const { page = 1, page_size = 20, search, sort = 'ordering' } = params;
        const ordering = ORDERING_BY_SORT[sort] || params.ordering || '-added';
        const useRelevance = search && sort === 'relevance';
        const where = buildWhere(params, useRelevance ? null : ordering);
        const clauses = [LIST_FIELDS];
        const byName = search ? `name ~ *${quoted(search)}*` : '';
        const fullWhere = [byName, where].filter(Boolean).join(' & ');
        if (fullWhere) clauses.push(`where ${fullWhere};`);
        const sorts=useRelevance?'name asc':ordering.split(',').map(key=>ORDER[key]).join(',');
        if(!sorts) throw new ApiError(400,'INVALID_QUERY','Ordenação inválida.');
        clauses.push(`sort ${sorts};`);
        clauses.push(`limit ${page_size}; offset ${(page - 1) * page_size};`);

        const [{data},{data:counter}]=await Promise.all([query('games',clauses.join(' ')),query('games/count',fullWhere?`where ${fullWhere};`:'')]);
        const total=counter.count;
        const count=search?Math.min(total,(params.batch||1)*240):total;
        const hasNext=page*page_size<count;
        return {
            count, total_count:total,
            count_scope:count<total?'window':'total',
            has_more:count<total,
            next: hasNext ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: page*page_size-page_size>=count?[]:data.slice(0,Math.max(0,count-(page-1)*page_size)).map(normalizeGame),
        };
    }

    async function categories(keys) {
        const today = Math.floor(now() / 1000);
        const DAY = 86400;
        const base = 'cover != null & game_type.type = ("Main Game","Remake","Remaster") & parent_game = null & version_parent = null';
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
            if(!keys.includes(group.name)||!Array.isArray(group.result)||group.error) throw new ApiError(502,'IGDB_INVALID_RESPONSE','A IGDB retornou categorias inválidas.');
            const items = group.result.map(normalizeGame);
            categoryIds[group.name] = items.map((game) => game.id);
            for (const game of items) games[game.id] = game;
        }
        if(keys.some(key=>!Object.hasOwn(categoryIds,key))) throw new ApiError(502,'IGDB_INVALID_RESPONSE','A IGDB não retornou todas as categorias.');
        return { games, categories: categoryIds };
    }

    async function metadata(resource, { page = 1, page_size = 40 }) {
        const [{data},{data:counter}]=await Promise.all([query(resource,
            `fields id,name,slug; sort name asc; limit ${page_size}; offset ${(page - 1) * page_size};`),query(`${resource}/count`,'')]);
        const total=counter.count; const hasNext=page*page_size<total;
        return {
            count:total,
            next: hasNext ? page + 1 : null,
            previous: page > 1 ? page - 1 : null,
            results: data,
        };
    }

    return { listGames, categories, getGame, metadata };
}
