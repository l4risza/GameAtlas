import test from 'node:test';
import assert from 'node:assert/strict';
import { addSelectedFavorite, selectedFavorites, favoriteKey } from '../src/services/favorite-games-model.js';

test('favoritos novos exigem o identificador do jogo e impedem duplicidade', () => {
    assert.throws(() => addSelectedFavorite([], 'qualquer texto'), /Selecione/);
    assert.throws(() => addSelectedFavorite([], { title: 'Sem ID' }), /Selecione/);
    const game = { id: 1020, title: 'Grand Theft Auto V' };
    assert.deepEqual(addSelectedFavorite([], game), [game]);
    assert.throws(() => addSelectedFavorite([game], game), /já está/);
    assert.notEqual(favoriteKey(game), favoriteKey('1020'));
});

test('nomes antigos são preservados e substituídos só com seleção explícita', () => {
    const game = { id: 1, title: 'The Warriors' };
    assert.deepEqual(addSelectedFavorite(['the warriors', 'Outro antigo'], game), ['Outro antigo', game]);
    assert.deepEqual(selectedFavorites(['Texto antigo', game]), { games: [game], legacy: ['Texto antigo'] });
});

test('o limite inclui jogos selecionados e nomes antigos', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({ id: index + 1, title: `Jogo ${index}` }));
    assert.throws(() => addSelectedFavorite(items, { id: 6, title: 'Outro' }), /até 5/);
    assert.throws(() => selectedFavorites([...items, 'Antigo']), /até 5/);
    assert.throws(() => selectedFavorites([{ id: -1 }]), /Selecione/);
});
