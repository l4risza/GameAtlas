import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRawgService } from '../rawg-service.js';
import { createApp } from '../app.js';

async function api(t, fetchImpl) {
    const service = createRawgService({ apiKey: 'private-key', fetchImpl, catalogPages: 1 });
    const server = createApp({ rawg: service }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return (query) => fetch(`http://127.0.0.1:${server.address().port}/api/jogos/busca?${query}`);
}

test('relevância prioriza título exato e combina início do nome com popularidade', async (t) => {
    const results = [
        { id: 1, name: 'Craft', added: 0 },
        { id: 2, name: 'Minecraft', added: 50000, ratings_count: 30000 },
        { id: 3, name: 'Craft Adventure', added: 80 },
        { id: 4, name: 'Another Craft', added: 100 },
        { id: 5, name: 'Craft Strange', added: 0 },
        { id: 6, name: 'Other Game', description_raw: 'craft', added: 100000 },
    ];
    const get = await api(t, async () => Response.json({ results, next: null }));
    const data = await (await get('q=craft')).json();
    assert.deepEqual(data.results.map((game) => game.id), [1, 2, 3, 4, 5]);
    const popular = await (await get('q=craft&sort=popular')).json();
    assert.equal(popular.results[0].id, 2);
    const alphabetical = await (await get('q=craft&sort=name')).json();
    assert.equal(alphabetical.results[0].id, 4);
});

test('ocultar extras remove demos e DLCs, preserva jogos completos e pode ser desativado', async (t) => {
    const calls = [];
    const results = [
        { id: 1, name: 'Game Complete', added: 100, rating: 0 },
        { id: 2, name: 'Game Demo', added: 80 },
        { id: 3, name: 'Game: Prologue', added: 60 },
        { id: 4, name: 'Game Expansion', parents_count: 1, added: 50 },
        { id: 5, name: 'Game Prototype', tags: [{ slug: 'demo' }], added: 40 },
        { id: 6, name: 'Game Demon Quest', added: 30 },
        { id: 7, name: 'Game DLC Quest', added: 20 },
    ];
    const get = await api(t, async (url) => {
        calls.push(new URL(url).searchParams);
        return Response.json({ results, next: null });
    });
    const hidden = await (await get('q=game&hide_extras=true')).json();
    assert.deepEqual(hidden.results.map((game) => game.id), [1, 6, 7]);
    assert.ok(calls.every((params) => params.get('exclude_additions') === 'true'));
    assert.ok(calls.every((params) => !params.has('hide_extras') && !params.has('sort') && !params.has('batch')));
    const all = await (await get('q=game&hide_extras=false')).json();
    assert.equal(all.count, 7);
    assert.equal(JSON.stringify(all).includes('private-key'), false);
});

test('plataforma e gênero filtram o catálogo, a busca e a contagem antes de paginar', async (t) => {
    const calls = [];
    const get = await api(t, async (url) => {
        const params = new URL(url).searchParams;
        calls.push(params);
        const results = params.get('parent_platforms') === '7' && params.get('genres') === 'platformer'
            ? [{ id: 1, name: 'Mario Nintendo', platforms: [{ platform: { id: 7, name: 'Nintendo Switch' } }] }]
            : [{ id: 2, name: 'Mario Mobile' }];
        return Response.json({ results, next: null });
    });
    const data = await (await get('q=mario&parent_platforms=7&genres=platformer')).json();
    assert.equal(data.count, 1);
    assert.equal(data.next, null);
    assert.equal(data.results[0].title, 'Mario Nintendo');
    assert.ok(calls.every((params) => params.get('parent_platforms') === '7' && params.get('genres') === 'platformer'));
});

test('buscar mais jogos inclui uma correspondência após a terceira página RAWG e reutiliza as anteriores', async (t) => {
    const searchPages = [];
    const get = await api(t, async (url) => {
        const params = new URL(url).searchParams;
        if (!params.has('search')) return Response.json({ results: [{ id: 1, name: 'Minecraft' }], next: null });
        const page = Number(params.get('page'));
        searchPages.push(page);
        return Response.json({ results: page === 4 ? [{ id: 2, name: 'Craft Hidden' }] : [], next: page < 4 ? 'private-next' : null });
    });
    const initial = await (await get('q=craft&hide_extras=true')).json();
    assert.equal(initial.count, 1);
    assert.equal(initial.has_more, true);
    const expanded = await (await get('q=craft&batch=2&hide_extras=true')).json();
    assert.equal(expanded.count, 2);
    assert.equal(expanded.has_more, false);
    assert.deepEqual(new Set(expanded.results.map((game) => game.id)), new Set([1, 2]));
    assert.deepEqual(searchPages, [1, 2, 3, 4]);
});

test('mostrar extras preserva jogos completos mesmo quando a RAWG muda os primeiros candidatos', async (t) => {
    const get = await api(t, async (url) => {
        const params = new URL(url).searchParams;
        return Response.json({ next: null, results: params.get('exclude_additions') === 'true'
            ? [{ id: 1, name: 'Craft Complete', added: 100 }]
            : [{ id: 2, name: 'Craft Demo', added: 80 }] });
    });
    const hidden = await (await get('q=craft&hide_extras=true')).json();
    const all = await (await get('q=craft&hide_extras=false')).json();
    assert.deepEqual(hidden.results.map((game) => game.id), [1]);
    assert.deepEqual(all.results.map((game) => game.id), [1, 2]);
});

for (const query of ['sort=unknown', 'hide_extras=yes', 'hide_extras=true&hide_extras=false',
    'batch=0', 'batch=21', 'parent_platforms=nintendo', 'parent_platforms=7&parent_platforms=1']) {
    test(`valida filtros antes de consultar RAWG: ${query}`, async (t) => {
        let calls = 0;
        const get = await api(t, async () => { calls += 1; return Response.json({ results: [] }); });
        assert.equal((await get(`q=mario&${query}`)).status, 400);
        assert.equal(calls, 0);
    });
}
