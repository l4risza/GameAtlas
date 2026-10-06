import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTranslationService, selectDescription, splitDescription } from '../translation-service.js';
import { createRawgService } from '../rawg-service.js';

test('descrições inglesas e espanholas usam detecção automática e destino pt-BR', async () => {
    const calls = [];
    const service = createTranslationService({ cacheDirectory: null,
        translateImpl: async (text, options) => { calls.push({ text, options }); return { text: 'Um jogo de aventura.' }; } });
    for (const source of ['An adventure game.', 'Un juego de aventura.']) {
        assert.deepEqual(await service.translateDescription(source), { text: 'Um jogo de aventura.', status: 'translated', language: 'pt-BR' });
    }
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ options }) => options.from === 'auto' && options.to === 'pt-BR'));
});

test('versões duplicadas em inglês e espanhol são reduzidas a uma descrição', () => {
    const source = 'An open-world adventure.\nExplore a city.\n\nEspañol\nUna aventura de mundo abierto.\nExplora una ciudad.';
    assert.deepEqual(selectDescription(source), { text: 'An open-world adventure.\nExplore a city.', portuguese: false });
    assert.deepEqual(selectDescription('English\nA puzzle game.\nSpanish\nUn juego de rompecabezas.'), { text: 'A puzzle game.', portuguese: false });
});

test('uma seção portuguesa e descrições vazias não fazem consultas externas', async () => {
    const service = createTranslationService({ cacheDirectory: null, translateImpl: async () => { assert.fail('Não deveria consultar tradução.'); } });
    assert.deepEqual(await service.translateDescription('An adventure.\nPortuguês (Brasil)\nUma aventura.'),
        { text: 'Uma aventura.', status: 'original', language: 'pt-BR' });
    assert.deepEqual(await service.translateDescription(''), { text: '', status: 'empty', language: 'pt-BR' });
});

test('textos extensos são divididos sem perder palavras', () => {
    const source = 'First paragraph contains several words.\n\nSecond paragraph contains additional game information. '.repeat(150).trim();
    const chunks = splitDescription(source);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.length <= 3000));
    assert.equal(chunks.join(' ').replace(/\s+/g, ' '), source.replace(/\s+/g, ' '));
});

test('consultas simultâneas e posteriores compartilham a tradução, e texto alterado é retraduzido', async () => {
    let calls = 0;
    const service = createTranslationService({ cacheDirectory: null,
        translateImpl: async () => { calls += 1; return { text: 'Um jogo de aventura.' }; } });
    await Promise.all([service.translateDescription('An adventure.'), service.translateDescription('An adventure.')]);
    await service.translateDescription('An adventure.');
    assert.equal(calls, 1);
    await service.translateDescription('A different adventure.');
    assert.equal(calls, 2);
});

test('a tradução salva em disco é reutilizada após reiniciar o serviço', async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'gameatlas-translations-'));
    t.after(async () => {
        for (const name of await readdir(directory)) await unlink(join(directory, name));
        await rmdir(directory);
    });
    const first = createTranslationService({ cacheDirectory: directory, translateImpl: async () => ({ text: 'Um jogo de quebra-cabeça.' }) });
    await first.translateDescription('A puzzle game.');
    const second = createTranslationService({ cacheDirectory: directory, translateImpl: async () => { assert.fail('Deveria usar cache persistente.'); } });
    assert.equal((await second.translateDescription('A puzzle game.')).text, 'Um jogo de quebra-cabeça.');
});

test('uma falha de tradução não bloqueia a fila e não é armazenada como sucesso', async () => {
    let calls = 0;
    const service = createTranslationService({ cacheDirectory: null, translateImpl: async () => {
        calls += 1;
        if (calls === 1) throw new Error('Indisponível');
        return { text: 'Um jogo traduzido.' };
    } });
    await assert.rejects(service.translateDescription('A game.'));
    assert.equal((await service.translateDescription('Another game.')).text, 'Um jogo traduzido.');
    assert.equal((await service.translateDescription('A game.')).text, 'Um jogo traduzido.');
    assert.equal(calls, 3);
});

test('detalhes retornam descrição em português e metadados da tradução', async () => {
    const rawg = createRawgService({ apiKey: 'test-key', fetchImpl: async () => Response.json({ id: 4200, name: 'Portal 2', description_raw: 'A puzzle game.' }),
        translateDescription: async () => ({ text: 'Um jogo de quebra-cabeça.', status: 'translated', language: 'pt-BR' }) });
    const game = await rawg.getGame(4200);
    assert.equal(game.title, 'Portal 2');
    assert.equal(game.description, 'Um jogo de quebra-cabeça.');
    assert.equal(game.description_language, 'pt-BR');
    assert.equal(game.description_translation, 'translated');
});

test('uma falha na tradução mantém o jogo disponível sem exibir descrição em idioma diferente', async () => {
    const diagnostics = [];
    const rawg = createRawgService({ apiKey: 'test-key', fetchImpl: async () => Response.json({ id: 4200, name: 'Portal 2', description_raw: 'A puzzle game.' }),
        onDiagnostic: (event) => diagnostics.push(event),
        translateDescription: async () => { throw new Error('Serviço indisponível'); } });
    const game = await rawg.getGame(4200);
    assert.equal(game.title, 'Portal 2');
    assert.equal(game.description, '');
    assert.equal(game.description_translation, 'unavailable');
    assert.equal(diagnostics[0].code, 'TRANSLATION_UNAVAILABLE');
});
