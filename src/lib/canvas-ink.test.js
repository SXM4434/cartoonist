import { expect, test } from 'bun:test';
import { readableLabelColor } from './canvas-ink.ts';

test('whiteboard labels use dark ink instead of white or pale grey', () => {
  expect(readableLabelColor('white')).toBe('black');
  expect(readableLabelColor('grey')).toBe('black');
  expect(readableLabelColor('light-grey')).toBe('black');
});
test('semantic action and exception ink stays distinct', () => {
  expect(readableLabelColor('blue')).toBe('blue');
  expect(readableLabelColor('red')).toBe('red');
});