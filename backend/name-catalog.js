import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const DAY = 24 * 60 * 60 * 1000;

function compact(game) {
    const fields = ['id', 'name', 'slug', 'background_image', 'rating', 'ratings_count', 'added', 'metacritic',
        'released', 'playtime', 'created', 'updated', 'parents_count', 'is_demo'];
    const result = Object.fromEntries(fields.filter((field) => game[field] !== undefined).map((field) => [field, game[field]]));
    const identity = ({ id, name, slug }) => ({ id, name, slug });
    for (const field of ['genres', 'tags', 'developers', 'publishers']) {
        if (Array.isArray(game[field])) result[field] = game[field].map(identity);
    }
    for (const field of ['platforms', 'parent_platforms']) {
        if (Array.isArray(game[field])) result[field] = game[field].map(({ platform }) => ({ platform: identity(platform || {}) }));
    }
    return result;
}

export function createNameCatalog({ loadPage, pageCount = 10, cacheFile, now = Date.now }) {
    const snapshots = new Map();
    const pending = new Map();

    return async function load(filters = {}) {
        if (!pageCount) return [];
        const key = new URLSearchParams(Object.entries(filters).sort()).toString();
        const path = cacheFile instanceof URL ? fileURLToPath(cacheFile) : cacheFile;
        const diskFile = path && (key ? `${path}.${createHash('sha256').update(key).digest('hex').slice(0, 16)}` : path);
        const cached = snapshots.get(key);
        if (cached && now() - cached.updated < DAY) return cached.games;
        if (pending.has(key)) return pending.get(key);

        const task = (async () => {
            if (diskFile) {
                try {
                    const saved = JSON.parse(await readFile(diskFile, 'utf8'));
                    if (saved.version === 2 && saved.pageCount === pageCount &&
                        Array.isArray(saved.games) && now() - saved.updated < DAY) {
                        snapshots.set(key, saved);
                        return saved.games;
                    }
                } catch { /* O catálogo pode ser reconstruído a partir da RAWG. */ }
            }

            const games = new Map();
            for (let first = 1; first <= pageCount; first += 3) {
                const pages = await Promise.all(Array.from({ length: Math.min(3, pageCount - first + 1) },
                    (_, offset) => loadPage({ ...filters, ordering: '-added', page_size: 40, page: first + offset })));
                for (const data of pages) {
                    for (const game of data.results) if (Number.isInteger(game.id)) games.set(game.id, compact(game));
                }
                if (pages.some((data) => !data.next)) break;
            }
            const snapshot = { version: 2, pageCount, updated: now(), games: [...games.values()] };
            if (snapshots.size >= 20) snapshots.delete(snapshots.keys().next().value);
            snapshots.set(key, snapshot);
            if (diskFile) {
                try {
                    await mkdir(dirname(diskFile), { recursive: true });
                    await writeFile(diskFile, JSON.stringify(snapshot), 'utf8');
                } catch { /* A busca continua funcionando com o cache em memória. */ }
            }
            return snapshot.games;
        })();
        pending.set(key, task);
        try { return await task; } finally { pending.delete(key); }
    };
}
