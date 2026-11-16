import { test, expect } from 'bun:test';
import { parseWebResults, referenceCanvasEvent, referenceToShape } from './web-reference.ts';

test('turns a cited web result into a canvas note that keeps the source URL', () => {
  const parsed = parseWebResults({
    results: [
      {
        title: 'Linear command bar',
        url: 'https://linear.app/docs/command-menu',
        snippet: 'Open the command menu with Cmd+K.',
        source: 'linear.app',
      },
      { title: 'Invented page', url: 'not-a-url', snippet: 'drop me', source: '' },
    ],
  }, 'Linear command bar');
  expect(parsed).toHaveLength(1);
  expect(parsed[0].url).toBe('https://linear.app/docs/command-menu');
  const shape = referenceToShape(parsed[0], { x: 80, y: 120 });
  expect(shape.type).toBe('note');
  expect(shape.id).toBe(`n_ref_${parsed[0].id}`);
  expect(shape.x).toBe(80);
  expect(shape.y).toBe(120);
  expect(shape.text).toContain('Linear command bar');
  expect(shape.text).toContain('https://linear.app/docs/command-menu');
  const event = referenceCanvasEvent('room-1', shape, parsed[0], 400);
  expect(event.room_id).toBe('room-1');
  expect(event.source).toBe('reference');
  expect(event.op).toEqual(shape);
  expect(event.transcript_span.url).toBe('https://linear.app/docs/command-menu');
  expect(event.thread_id).toMatch(/^thread_ref_/);
});

test('drops results without a real source URL instead of inventing a citation', () => {
  expect(parseWebResults({ results: [{ title: 'Mystery', url: 'ftp://files.example', snippet: 'no' }] }, 'mystery')).toEqual([]);
  expect(parseWebResults({ results: [] }, 'empty')).toEqual([]);
  expect(parseWebResults({}, 'missing')).toEqual([]);
});
