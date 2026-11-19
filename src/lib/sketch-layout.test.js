import { test, expect } from 'bun:test';
import { placeBatchClear, bboxOf } from './sketch-layout.ts';

test('an overlapping batch stacks below existing work on the same left edge', () => {
  const existing = [{ type: 'rect', id: 'a', x: 100, y: 100, w: 1000, h: 200 }];
  const incoming = [{ type: 'rect', id: 'b', x: 300, y: 150, w: 200, h: 80 }];
  const b = bboxOf(placeBatchClear(existing, incoming));
  expect(b.minX).toBe(100);
  expect(b.minY).toBe(420);
});
