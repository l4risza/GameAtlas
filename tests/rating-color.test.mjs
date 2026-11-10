import test from 'node:test';
import assert from 'node:assert/strict';
import { ratingColor } from '../src/services/rating-color.js';
test('cor gradual das estrelas usa a mesma escala de 0 a 5 ou 0 a 100', () => {
    assert.equal(ratingColor(0), 'hsl(0 100% 55%)');
    assert.equal(ratingColor(2.5), 'hsl(25 100% 55%)');
    assert.equal(ratingColor(5), 'hsl(50 100% 55%)');
    assert.equal(ratingColor(50, 100), ratingColor(2.5));
    assert.equal(ratingColor(-5), ratingColor(0));
    assert.equal(ratingColor(10), ratingColor(5));
    assert.equal(ratingColor(null), ratingColor(0));
});
