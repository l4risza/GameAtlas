import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../app.js';
import { createRawgService, normalizeGame } from '../rawg-service.js';

const API_KEY = 'test-key-never-exposed';
const GAME = {
    id: 3498, slug: 'grand-theft-auto-v', name: 'Grand Theft Auto V',
    background_image: 'https://media.rawg.io/test.jpg', rating: 4.5, released: '2013-09-17',
    platforms: [{ platform: { name: 'PC' } }], genres: [{ name: 'Action' }],
    tags: [{ slug: 'multiplayer' }], description_raw: 'Descrição do jogo.',
};
const LIST = {
    count: 100, next: `https://api.rawg.io/api/games?key=${API_KEY}&page=2`, previous: null, results: [GAME],
};

async function serve(t, options = {}) {
    const calls = [];
    const fetchImpl = options.fetchImpl || (async (url) => {
        calls.push(new URL(url));
        const pathname = new URL(url).pathname;
        const data = pathname.endsWith('/3498') ? GAME : LIST;
        return Response.json(data);
    });
    const rawg = createRawgService({ apiKey: API_KEY, fetchImpl, retryDelayMs: 0, catalogPages: 0, ...options });
    const server = createApp({ rawg, corsOrigins: ['http://localhost:5173'] }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    return { calls, get: (path, init) => fetch(`${base}${path}`, init) };
}

test('lista jogos, traduz campos e não expõe a chave ou links privados de paginação', async (t) => {
    const { get, calls } = await serve(t);
    const response = await get('/api/jogos?page=1&page_size=12&genres=indie&platforms=4');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.results[0].title, GAME.name);
    assert.equal(data.results[0].rating, 9);
    assert.equal(data.next, 2);
    assert.equal(JSON.stringify(data).includes(API_KEY), false);
    assert.equal(calls[0].searchParams.get('key'), API_KEY);
    assert.equal(calls[0].searchParams.get('genres'), 'indie');
    assert.equal(calls[0].searchParams.get('platforms'), '4');
});

test('busca usa q e não é confundida com a rota de detalhes', async (t) => {
    const { get, calls } = await serve(t);
    assert.equal((await get('/api/jogos/busca?q=God%20of%20War&page=2')).status, 200);
    assert.equal(calls[0].pathname, '/api/games');
    assert.equal(calls[0].searchParams.get('search'), 'God of War');
    assert.equal(calls[0].searchParams.get('page'), '2');
});

test('detalhes consultam diretamente o ID, inclusive fora da primeira página', async (t) => {
    const { get, calls } = await serve(t);
    const data = await (await get('/api/jogos/3498')).json();
    assert.equal(data.description, GAME.description_raw);
    assert.equal(calls[0].pathname, '/api/games/3498');
    assert.equal(calls.length, 1);
});

for (const path of [
    '/api/jogos/busca?q=%20', '/api/jogos?page=0', '/api/jogos?page=-1',
    '/api/jogos?page_size=49', '/api/jogos?page=1&page=2', '/api/jogos?key=user-key', '/api/jogos?platforms=pc',
    '/api/jogos?ordering=unknown', '/api/jogos?dates=2026-02-30,2026-03-01',
    '/api/jogos?metacritic=100,10', '/api/jogos/categorias?include=unknown', '/api/jogos/invalid',
]) {
    test(`valida parâmetros antes de consultar RAWG: ${path}`, async (t) => {
        const { get, calls } = await serve(t);
        assert.equal((await get(path)).status, 400);
        assert.equal(calls.length, 0);
    });
}

test('categorias fazem consultas próprias e não usam uma única página popular para todos os grupos', async (t) => {
    const { get, calls } = await serve(t);
    const response = await get('/api/jogos/categorias?include=emAlta,lancamentos,indie,multiplayer');
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(data.categories), ['emAlta', 'lancamentos', 'indie', 'multiplayer']);
    assert.equal(calls.length, 4);
    assert.ok(calls.some((url) => url.searchParams.has('dates')));
    assert.ok(calls.some((url) => url.searchParams.get('genres') === 'indie'));
    assert.ok(calls.some((url) => url.searchParams.get('tags') === 'multiplayer'));
    assert.equal(JSON.stringify(data).includes(API_KEY), false);
});

for (const [upstreamStatus, status, code] of [[404, 404, 'GAME_NOT_FOUND'], [401, 502, 'RAWG_AUTH_ERROR'], [403, 502, 'RAWG_AUTH_ERROR'], [429, 503, 'RAWG_RATE_LIMIT'], [500, 502, 'RAWG_UNAVAILABLE']]) {
    test(`converte erro RAWG ${upstreamStatus} sem devolver segredos`, async (t) => {
        const { get } = await serve(t, { fetchImpl: async () => new Response(`key=${API_KEY}`, { status: upstreamStatus }) });
        const response = await get('/api/jogos/3498');
        const data = await response.json();
        assert.equal(response.status, status);
        assert.equal(data.code, code);
        assert.equal(JSON.stringify(data).includes(API_KEY), false);
    });
}

test('timeout tem resposta 504 e configuração ausente tem resposta 503', async (t) => {
    const timeout = await serve(t, { fetchImpl: async () => { throw new DOMException('URL com segredo', 'TimeoutError'); } });
    assert.equal((await timeout.get('/api/jogos')).status, 504);
    const missing = await serve(t, { apiKey: '' });
    assert.equal((await missing.get('/api/jogos')).status, 503);
    assert.equal((await missing.get('/api/health')).status, 200);
});

test('cache compartilha consultas simultâneas e expira', async () => {
    let calls = 0;
    let clock = 1000;
    const service = createRawgService({ apiKey: API_KEY, cacheTtlMs: 100, now: () => clock,
        fetchImpl: async () => { calls += 1; return Response.json(LIST); } });
    await Promise.all([service.listGames({ page: 1 }), service.listGames({ page: 1 })]);
    await service.listGames({ page: 1 });
    assert.equal(calls, 1);
    clock += 101;
    await service.listGames({ page: 1 });
    assert.equal(calls, 2);
});

test('resposta inválida e falha de rede não expõem a URL com a chave', async (t) => {
    const malformed = await serve(t, { fetchImpl: async () => Response.json({ results: null }) });
    assert.equal((await malformed.get('/api/jogos')).status, 502);
    const network = await serve(t, { fetchImpl: async () => { throw new Error(`fetch failed?key=${API_KEY}`); } });
    const response = await network.get('/api/jogos');
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes(API_KEY), false);
});

test('gêneros e plataformas entregam metadados sem URLs privadas', async (t) => {
    const { get } = await serve(t, { fetchImpl: async () => Response.json({ count: 1, results: [{ id: 4, name: 'PC', slug: 'pc', games: [GAME] }] }) });
    for (const resource of ['generos', 'plataformas']) {
        const data = await (await get(`/api/${resource}`)).json();
        assert.deepEqual(data.results[0], { id: 4, name: 'PC', slug: 'pc' });
    }
});

test('CORS permite apenas as origens configuradas e rota desconhecida retorna JSON', async (t) => {
    const { get } = await serve(t);
    const allowed = await get('/api/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const denied = await get('/api/health', { headers: { Origin: 'https://example.invalid' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    assert.equal((await get('/api/unknown')).status, 404);
});

test('jogos sem imagem, data ou nota e links de site inseguros são tratados', () => {
    const game = normalizeGame({ id: 1, platforms: null, genres: null, tags: null, website: 'javascript:alert(1)' });
    assert.equal(game.image, null);
    assert.equal(game.year, null);
    assert.equal(game.rating, null);
    assert.equal(game.website, null);
});

test('busca recupera uma falha de rede e um erro 503 antes de retornar jogos', async (t) => {
    let calls = 0;
    const diagnostics = [];
    const { get } = await serve(t, {
        onDiagnostic: (event) => diagnostics.push(event),
        fetchImpl: async () => {
            calls += 1;
            if (calls === 1) throw new TypeError(`fetch failed?key=${API_KEY}`, { cause: { code: 'ECONNRESET' } });
            if (calls === 2) return new Response('Indisponível', { status: 503 });
            return Response.json({ ...LIST, results: [{ ...GAME, id: 22509, name: 'Minecraft' }] });
        },
    });
    const response = await get('/api/jogos/busca?q=Minecraft');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).results[0].title, 'Minecraft');
    assert.equal(calls, 3);
    assert.equal(diagnostics.length, 2);
    assert.equal(diagnostics[0].code, 'ECONNRESET');
    assert.equal(diagnostics.every((event) => event.retrying), true);
    assert.equal(JSON.stringify(diagnostics).includes(API_KEY), false);
});

test('falha persistente termina após três tentativas e não é armazenada no cache', async () => {
    let calls = 0;
    const service = createRawgService({ apiKey: API_KEY, retryDelayMs: 0,
        fetchImpl: async () => { calls += 1; return calls <= 3 ? new Response('', { status: 502 }) : Response.json(LIST); } });
    await assert.rejects(service.listGames({ page: 1 }), (error) => error.status === 502);
    assert.equal(calls, 3);
    assert.equal((await service.listGames({ page: 1 })).results[0].id, GAME.id);
    assert.equal(calls, 4);
});

test('chave inválida, jogo inexistente e limite de consultas não provocam novas tentativas', async () => {
    for (const status of [401, 403, 404, 429]) {
        let calls = 0;
        const service = createRawgService({ apiKey: API_KEY, retryDelayMs: 0,
            fetchImpl: async () => { calls += 1; return new Response('', { status }); } });
        await assert.rejects(service.listGames({ page: 1 }));
        assert.equal(calls, 1);
    }
});

test('o timeout total também limita a espera entre tentativas', async () => {
    const service = createRawgService({ apiKey: API_KEY, timeoutMs: 30, retryDelayMs: 100,
        fetchImpl: async () => new Response('', { status: 503 }) });
    await assert.rejects(service.listGames({ page: 1 }), (error) => error.status === 504);
});

test('a busca parcial inclui apenas nomes que contêm o termo e ignora descrição e nomes parecidos', async (t) => {
    const { get } = await serve(t, { fetchImpl: async () => Response.json({
        count: 7000, next: `https://api.rawg.io/api/games?key=${API_KEY}&page=2`, previous: null,
        results: [
            { id: 1, name: 'Minecraft' },
            { id: 2, name: 'This War of Mine' },
            { id: 3, name: 'Mini Metro', description_raw: 'Build a mine.' },
            { id: 4, name: 'In Sound Mind' },
            { id: 5, name: 'Portal 2', description_raw: 'Mine resources in this game.' },
            { id: 6, name: 'MINE: FOREVER' },
            { id: 7, description_raw: 'Mine' },
        ],
    }) });
    const response = await get('/api/jogos/busca?q=mine');
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.results.map((game) => game.title), ['Minecraft', 'MINE: FOREVER', 'This War of Mine']);
    assert.equal(data.count, 3);
    assert.equal(data.count_scope, 'page');
    assert.equal(data.next, 2);
    assert.equal(JSON.stringify(data).includes(API_KEY), false);
});

test('busca por nome ignora acentos, caixa e espaços repetidos, mantendo a paginação', async (t) => {
    const { get } = await serve(t, { fetchImpl: async () => Response.json({ count: 20, next: 'private-next', previous: 'private-previous',
        results: [{ id: 1, name: 'São   Paulo Adventure' }, { id: 2, name: 'Another Game', description_raw: 'São Paulo Adventure' }] }) });
    const data = await (await get('/api/jogos/busca?q=SAO%20PAULO&page=2')).json();
    assert.deepEqual(data.results.map((game) => game.id), [1]);
    assert.equal(data.previous, 1);
    assert.equal(data.next, 3);
});

test('catálogo com search também aplica o filtro de nome e uma página sem correspondências continua navegável', async (t) => {
    const { get } = await serve(t, { fetchImpl: async () => Response.json({ ...LIST,
        results: [{ id: 1, name: 'Mini Metro', description_raw: 'Mine resources.' }] }) });
    const data = await (await get('/api/jogos?search=mine')).json();
    assert.deepEqual(data.results, []);
    assert.equal(data.count, 0);
    assert.equal(data.count_scope, 'page');
    assert.equal(data.next, 2);
});
