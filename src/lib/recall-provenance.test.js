import { test, expect } from 'bun:test';
import { matchRecallDrawings } from './recall-provenance.ts';
test('links a cited itinerary discussion to its original drawing only', () => {
  const result = matchRecallDrawings([{ text: 'Resolve the itinerary conflict', speaker: '' }], [
    { thread_id: 'travel', transcript_span: { latest: 'Resolve the itinerary conflict' }, op: { type: 'rect', id: 'calendar' } },
    { thread_id: 'pricing', transcript_span: { latest: 'Change subscription pricing' }, op: { shapes: [{ id: 'price' }] } }
  ]);
  expect(result[0].threadId).toBe('travel');
  expect(result[0].shapeIds).toEqual(['calendar']);
});
test('does not invent a drawing link for unsupported quotes', () => {
  expect(matchRecallDrawings([{ text: 'Nothing about travel', speaker: '' }], [])[0].threadId).toBeUndefined();
});