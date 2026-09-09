import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceOptimizedOrder } from '../lib/maps/distance-order';

test('one-way optimization respects asymmetric road distances and visits every stop', () => {
  const matrix = [[0,1,8,9],[5,0,1,8],[7,8,0,1],[2,9,8,0]];
  assert.deepEqual(distanceOptimizedOrder(matrix, false), [1,2,3]);
});

test('return journey can change the best delivery order', () => {
  const matrix = [[0,1,2],[1,0,1],[100,2,0]];
  assert.deepEqual(distanceOptimizedOrder(matrix, false), [1,2]);
  assert.deepEqual(distanceOptimizedOrder(matrix, true), [2,1]);
});

test('unreachable or malformed road matrices are rejected', () => {
  assert.throws(() => distanceOptimizedOrder([[0,1],[Infinity,0]]));
  assert.throws(() => distanceOptimizedOrder([[0,1],[0]]));
});
