import { test, expect } from 'bun:test';
import { parseWebResults, referenceCanvasEvent, referenceToShape, verifyWebResults } from './web-reference.ts';

function model(title, url, snippet = 'A short note.') {
  return {
    id: 'ref_test',
    query: 'lookup',
    title,
    url,
    snippet,
    source: 'example.com',
  };
}

function page(status, finalUrl, title, text) {
  return { status, finalUrl, title, text };
}

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

test('drops a fetched page that answers 404', () => {
  const kept = verifyWebResults(
    [model('Linear command menu', 'https://linear.app/missing')],
    [page(404, 'https://linear.app/missing', 'Linear command menu', 'Linear command menu was not found')],
  );
  expect(kept).toEqual([]);
});

test('keeps the final URL after a redirect and replaces the title with the page title', () => {
  const kept = verifyWebResults(
    [model('Linear command menu', 'http://linear.app/old')],
    [page(200, 'https://linear.app/docs/command-menu', 'Command menu - Linear Docs', 'Open the menu.')],
  );
  expect(kept).toHaveLength(1);
  expect(kept[0].url).toBe('https://linear.app/docs/command-menu');
  expect(kept[0].title).toBe('Command menu - Linear Docs');
  expect(kept[0].source).toBe('linear.app');
  expect(kept[0].snippet).toBe('A short note.');
});

test('drops a page whose title and text share no meaningful word with the result', () => {
  expect(verifyWebResults(
    [model('Linear command menu', 'https://example.com/pasta')],
    [page(200, 'https://example.com/pasta', 'How to salt pasta water', 'Boil the pot then add salt.')],
  )).toEqual([]);
  expect(verifyWebResults(
    [model('The Guide', 'https://example.com/guide')],
    [page(200, 'https://example.com/guide', 'The Pasta', 'The kitchen')],
  )).toEqual([]);
});

test('keeps a page that shares a meaningful word and uses the real title', () => {
  const byTitle = verifyWebResults(
    [model('Linear command menu', 'https://linear.app/docs/command-menu', 'Open it with Cmd+K.')],
    [page(200, 'https://linear.app/docs/command-menu', 'Command menu - Linear Docs', 'Keyboard shortcuts.')],
  );
  expect(byTitle).toHaveLength(1);
  expect(byTitle[0].title).toBe('Command menu - Linear Docs');
  expect(byTitle[0].url).toBe('https://linear.app/docs/command-menu');
  expect(byTitle[0].snippet).toBe('Open it with Cmd+K.');

  const byText = verifyWebResults(
    [model('Command menu', 'https://linear.app/docs')],
    [page(200, 'https://linear.app/docs', 'Welcome', 'Use the command menu to jump to any action.')],
  );
  expect(byText).toHaveLength(1);
  expect(byText[0].title).toBe('Welcome');
  expect(byText[0].url).toBe('https://linear.app/docs');
});

test('ignores a matching word past the first 20 kB of page text', () => {
  const pad = 'salt '.repeat(6000);
  const kept = verifyWebResults(
    [model('Linear command menu', 'https://example.com/late')],
    [page(200, 'https://example.com/late', 'Notes', `${pad} linear command menu`)],
  );
  expect(kept).toEqual([]);
});
