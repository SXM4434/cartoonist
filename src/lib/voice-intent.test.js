import { test, expect } from 'bun:test';
import { wakeQuery, voiceAction, pauseNudge, wakeFromStream, interruptPlayback } from './voice-intent.ts';
test('recognizes hey Cartoonist without treating ordinary discussion as a wake query', () => {
  expect(wakeQuery('Hey Cartoonist, summarize what we decided')).toBe('summarize what we decided');
  expect(wakeQuery('Cartoonist has drawn our calendar')).toBeNull();
});
test('routes requests for drawings and documents explicitly', () => {
  expect(voiceAction('draw our itinerary')).toBe('draw');
  expect(voiceAction('draft the PRD')).toBe('documents');
  expect(voiceAction('update the PRD with the owner we chose')).toBe('documents');
  expect(voiceAction('what did we decide?')).toBe('recall');
});
test('nudges only with consent after six seconds following a question', () => {
  expect(pauseNudge('What do you think?', 6000, true)).toBeTruthy();
  expect(pauseNudge('What do you think?', 5999, true)).toBeNull();
  expect(pauseNudge('What do you think?', 7000, false)).toBeNull();
  expect(pauseNudge('The itinerary is ready.', 7000, true)).toBeNull();
});
test('finds a wake phrase split between final speech chunks and inside a longer utterance', () => {
  expect(wakeFromStream('We agreed to ship. Hey', ' Cartoonist, update the PRD')).toBe('update the PRD');
  expect(wakeFromStream('We agreed to ship.', ' Hey Cartoonist, draw the plan')).toBe('draw the plan');
  expect(wakeFromStream('Hey Cartoonist, draw the plan', 'and assign an owner')).toBeNull();
});
test('participant speech interrupts both playback paths', () => {
  let paused = 0, cancelled = 0;
  expect(interruptPlayback(true, { pause: () => paused++ }, () => cancelled++)).toBe(true);
  expect([paused, cancelled]).toEqual([1, 1]);
  expect(interruptPlayback(false, { pause: () => paused++ }, () => cancelled++)).toBe(false);
});

import { voiceAction as va2 } from './voice-intent.ts';
import { test as t2, expect as e2 } from 'bun:test';
t2('visual voice requests go to the board', () => {
  for (const q of ['make a timeline of the launch', 'show the race day flow', 'lay out the options in a table', 'create a mind map of sponsors', 'draw the decision']) e2(va2(q)).toBe('draw');
});
t2('past questions go to recall, document asks to documents', () => {
  e2(va2('what did we decide about engraving')).toBe('recall');
  e2(va2('who owns the expo booth')).toBe('recall');
  e2(va2('update the action items')).toBe('documents');
});

import { splitDrawRequests } from './voice-intent.ts';
import { test as t3, expect as e3 } from 'bun:test';
t3('several spoken asks in one pause become separate drawing requests', () => {
  const parts = splitDrawRequests('Can I say again? Yeah. Um, so can you make a outline for a New Balance marathon activation? Give us a few steps and And also, can you draw a physical drawing of the activation, please?');
  e3(parts.length).toBe(2);
  e3(parts[0]).toContain('outline');
  e3(parts[1]).toContain('physical drawing');
});
t3('one verb with a list of different drawings splits per drawing', () => {
  const parts = splitDrawRequests('Build me an outline, a drawing of the booth and a mobile app screen for the activation');
  e3(parts.length).toBe(3);
  e3(parts[2]).toMatch(/^build a mobile app screen/i);
});
t3('a single request or plain talk stays whole', () => {
  e3(splitDrawRequests('Draw the race day flow from check-in to finish')).toEqual(['Draw the race day flow from check-in to finish']);
  e3(splitDrawRequests('We are going to build an activation for the marathon.')).toEqual(['We are going to build an activation for the marathon.']);
});
t3('"and then a mobile app screen" becomes its own drawing', () => {
  const parts = splitDrawRequests('Can you draw a physical drawing of the activation, please, and then a mobile app screen for runners');
  e3(parts).toEqual(['Can you draw a physical drawing of the activation, please', 'make a mobile app screen for runners']);
});
