'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { blockFor, parseTilePath } = require('../lib/vector-tile-renderer');

test('vector tile paths are limited to the VFR style and the drawn zoom range', () => {
  assert.deepEqual(parseTilePath('/vector-tile/vfr/11/1075/704.png'), { style: 'vfr', z: 11, x: 1075, y: 704 });
  assert.equal(parseTilePath('/vector-tile/other/11/1/1.png'), null);
  assert.equal(parseTilePath('/vector-tile/vfr/2/1/1.png'), null);
  assert.equal(parseTilePath('/vector-tile/vfr/17/1/1.png'), null);
  assert.equal(parseTilePath('/vector-tile/vfr/3/8/1.png'), null);
});

test('tiles are drawn in 4x4 blocks and indexed row by row', () => {
  assert.deepEqual(blockFor(11, 1075, 704), { z: 11, x0: 1072, y0: 704, n: 4, index: 3, key: '11/1072/704' });
  assert.deepEqual(blockFor(11, 1076, 705), { z: 11, x0: 1076, y0: 704, n: 4, index: 4, key: '11/1076/704' });
  assert.equal(blockFor(1, 1, 1).n, 2);
});
