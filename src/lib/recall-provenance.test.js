import { test, expect } from 'bun:test';
import { citeTranscriptSpans, matchRecallDrawings, recallAnswer, UNSUPPORTED_ANSWER } from './recall-provenance.ts';

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

test('cites a quote against the stored transcript span and its drawing', () => {
  const cited = citeTranscriptSpans(
    [{ text: 'Resolve the itinerary conflict', speaker: 'Maya' }],
    [{ id: 'chunk-1', text: 'Maya: Resolve the itinerary conflict before Friday', speaker: 'Maya' }],
  );
  expect(cited[0].chunkId).toBe('chunk-1');
  const linked = matchRecallDrawings(cited, [
    { thread_id: 'travel', transcript_span: { latest: 'Resolve the itinerary conflict' }, op: { type: 'rect', id: 'calendar' } },
    { thread_id: 'pricing', transcript_span: { latest: 'Change subscription pricing' }, op: { shapes: [{ id: 'price' }] } },
  ]);
  expect(linked[0].chunkId).toBe('chunk-1');
  expect(linked[0].threadId).toBe('travel');
  expect(linked[0].shapeIds).toEqual(['calendar']);
  const reloaded = JSON.parse(JSON.stringify(linked));
  expect(reloaded[0].chunkId).toBe('chunk-1');
  expect(reloaded[0].threadId).toBe('travel');
  expect(reloaded[0].shapeIds).toEqual(['calendar']);
});

test('keeps the not-supported-by-the-transcript fallback when no span matches', () => {
  const cited = citeTranscriptSpans(
    [{ text: 'We already booked the hotel downtown', speaker: '' }],
    [{ id: 'chunk-1', text: 'Resolve the itinerary conflict before Friday', speaker: 'Maya' }],
  );
  expect(cited[0].chunkId).toBeUndefined();
  expect(matchRecallDrawings(cited, [
    { thread_id: 'travel', transcript_span: { latest: 'Resolve the itinerary conflict' }, op: { type: 'rect', id: 'calendar' } },
  ])[0].threadId).toBeUndefined();
  expect(recallAnswer('The hotel is booked.', cited)).toBe(UNSUPPORTED_ANSWER);
});