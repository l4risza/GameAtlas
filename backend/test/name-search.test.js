import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRawgService } from '../rawg-service.js';
import { createNameCatalog } from '../name-catalog.js';

const CATALOG = [
    { id: 1, name: 'Minecraft', added: 100 },
    { id: 2, name: 'Minelokd', added: 50 },
    { id: 3, name: 'Craft Adventure', added: 40 },
    { id: 4, name: 'Another Game', description_raw: 'Minecraft and craft', added: 300 },
];

test('busca recupera trechos no começo e final mesmo quando RAWG omite Minecraft', async () => {
    const calls = [];
    const service = createRawgService({ apiKey: 'private-test-key', catalogPages: 1,
        fetchImpl: async (url) => {
            const params = new URL(url).searchParams;
            calls.push(params);
            return Response.json({ count: 4000, next: null, results: params.has('search')
                ? [{ id: 5, name: 'This War of Mine', added: 10 }, { id: 6, name: 'Mini Metro', description_raw: 'craft' }]
                : CATALOG });
        } });
    const mine = await service.listGames({ search: 'Mine', page: 1, page_size: 20 });
    assert.deepEqual(mine.results.map((game) => game.title), ['Minecraft', 'Minelokd', 'This War of Mine']);
    const craft = await service.listGames({ search: 'craft', page: 1, page_size: 20 });
    assert.deepEqual(craft.results.map((game) => game.title), ['Minecraft', 'Craft Adventure']);
    const internal = await service.listGames({ search: 'NECR', page: 1, page_size: 20 });
    assert.deepEqual(internal.results.map((game) => game.title), ['Minecraft']);
    assert.equal(calls.filter((params) => !params.has('search')).length, 2);
    assert.equal(JSON.stringify(craft).includes('private-test-key'), false);
});

test('paginação usa o mesmo conjunto filtrado, não duplica IDs e pode iniciar na página 2', async () => {
    let calls = 0;
    const service = createRawgService({ apiKey: 'test', catalogPages: 1,
        fetchImpl: async (url) => {
            calls += 1;
            const search = new URL(url).searchParams.has('search');
            return Response.json({ results: search ? [CATALOG[0], { id: 5, name: 'Mine Game', added: 10 }] : CATALOG, next: null });
        } });
    const second = await service.listGames({ search: 'mine', page: 2, page_size: 2 });
    const first = await service.listGames({ search: 'MINE', page: 1, page_size: 2 });
    assert.equal(first.count, 3);
    assert.equal(first.count_scope, 'available');
    assert.equal(first.next, 2);
    assert.equal(first.previous, null);
    assert.deepEqual(first.results.map((game) => game.id), [1, 2]);
    assert.deepEqual(second.results.map((game) => game.id), [5]);
    assert.equal(second.next, null);
    assert.equal(second.previous, 1);
    assert.equal(calls, 4);
});

test('catálogo e consulta textual recebem os mesmos filtros de gênero e plataforma', async () => {
    const calls = [];
    const service = createRawgService({ apiKey: 'test', catalogPages: 1,
        fetchImpl: async (url) => {
            calls.push(new URL(url).searchParams);
            return Response.json({ results: [], next: null });
        } });
    const data = await service.listGames({ search: 'craft', genres: 'indie', platforms: '4' });
    assert.equal(data.count, 0);
    assert.equal(data.next, null);
    assert.ok(calls.every((params) => params.get('genres') === 'indie' && params.get('platforms') === '4'));
});

test('catálogo persiste sem URLs de paginação, é reutilizado e expira após um dia', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'gameatlas-name-search-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const cacheFile = join(directory, 'catalog.json');
    let clock = Date.now();
    let calls = 0;
    const options = { cacheFile, pageCount: 1, now: () => clock, loadPage: async () => {
        calls += 1;
        return { results: CATALOG, next: 'https://private.invalid/?key=secret' };
    } };
    assert.deepEqual((await createNameCatalog(options)()).map((game) => game.name), CATALOG.map((game) => game.name));
    assert.equal((await readFile(cacheFile, 'utf8')).includes('secret'), false);
    assert.deepEqual((await createNameCatalog(options)()).map((game) => game.name), CATALOG.map((game) => game.name));
    assert.equal(calls, 1);
    clock += 24 * 60 * 60 * 1000 + 1;
    await createNameCatalog(options)();
    assert.equal(calls, 2);
});

test('busca respeita múltiplos campos de ordenação antes de paginar', async () => {
    const service = createRawgService({ apiKey: 'test', catalogPages: 1,
        fetchImpl: async () => Response.json({ next: null, results: [
            { id: 1, name: 'Craft A', rating: 3 },
            { id: 2, name: 'Craft B', rating: 4 },
            { id: 3, name: 'Craft C', rating: 4 },
        ] }) });
    const data = await service.listGames({ search: 'craft', ordering: '-rating,-name', page_size: 2 });
    assert.deepEqual(data.results.map((game) => game.id), [3, 2]);
});
