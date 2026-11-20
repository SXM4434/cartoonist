import { expect, test } from 'bun:test';
import { speechSegments } from './speech-transcript.ts';

test('sound events cannot become participant speech or speaker prompts', () => {
  expect(speechSegments([{ text: '[outro jingle]', type: 'audio_event' }, { text: '[silence]' }])).toEqual([]);
});

test('spoken words keep speaker attribution and recording offsets', () => {
  expect(speechSegments([
    { text: 'Draw', type: 'word', speaker_id: 'speaker_1', start: 1, end: 1.4 },
    { text: 'a calendar', type: 'word', speaker_id: 'speaker_1', start: 1.5, end: 2 },
    { text: 'Approved', type: 'word', speaker_id: 'speaker_2', start: 3, end: 4 },
  ])).toEqual([
    { speaker: 'speaker_1', text: 'Draw a calendar', start: 1, end: 2 },
    { speaker: 'speaker_2', text: 'Approved', start: 3, end: 4 },
  ]);
});