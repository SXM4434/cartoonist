/** Provider sound captions are not participant speech. */
export function isNonSpeechTranscript(text: string): boolean {
  return /^\s*\[(?:silence|heartbeat|background noise|music|outro jingle|bell dings?|birds chirping|door squeaking)\]\s*$/i.test(text);
}

export type TranscriptWord = { text: string; start?: number; end?: number; speaker_id?: string; type?: string };
export type SpeechSegment = { speaker: string; text: string; start: number; end: number };

export function speechSegments(words: TranscriptWord[]): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  for (const word of words) {
    if (!word.text?.trim() || word.type === 'spacing' || word.type === 'audio_event' || isNonSpeechTranscript(word.text)) continue;
    const speaker = word.speaker_id ?? 'speaker_0';
    const last = segments.at(-1);
    if (last?.speaker === speaker) {
      last.text += (/^[.,!?;:']/.test(word.text) ? '' : ' ') + word.text;
      last.end = word.end ?? last.end;
    } else segments.push({ speaker, text: word.text, start: word.start ?? 0, end: word.end ?? 0 });
  }
  return segments;
}