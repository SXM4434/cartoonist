import { test, expect } from 'bun:test';
import { wakeQuery, voiceAction, pauseNudge } from './voice-intent.ts';
test('recognizes hey Cartoonist without treating ordinary discussion as a wake query', () => {
  expect(wakeQuery('Hey Cartoonist, summarize what we decided')).toBe('summarize what we decided');
  expect(wakeQuery('Cartoonist has drawn our calendar')).toBeNull();
});
test('routes requests for drawings and documents explicitly', () => {
  expect(voiceAction('draw our itinerary')).toBe('draw');
  expect(voiceAction('draft the PRD')).toBe('documents');
  expect(voiceAction('what did we decide?')).toBe('recall');
});
test('nudges only with consent after six seconds following a question', () => {
  expect(pauseNudge('What do you think?', 6000, true)).toBeTruthy();
  expect(pauseNudge('What do you think?', 5999, true)).toBeNull();
  expect(pauseNudge('What do you think?', 7000, false)).toBeNull();
  expect(pauseNudge('The itinerary is ready.', 7000, true)).toBeNull();
});