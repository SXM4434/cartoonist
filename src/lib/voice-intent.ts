export function wakeQuery(text: string): string | null {
  const match = /\bhey[\s,]+cartoonist\b[\s,:.!-]*(.*)/i.exec(text);
  return match ? match[1].trim() : null;
}

export function wakeFromStream(previous: string, incoming: string): string | null {
  const overlap = previous.slice(-32);
  const joined = overlap + incoming;
  for (const match of joined.matchAll(/\bhey[\s,]+cartoonist\b[\s,:.!-]*/gi)) {
    if (match.index + match[0].length > overlap.length) return joined.slice(match.index + match[0].length).trim();
  }
  return null;
}

export function interruptPlayback(speaking: boolean, audio: { pause(): void } | null, cancelBrowserVoice: () => void): boolean {
  if (!speaking) return false;
  audio?.pause();
  cancelBrowserVoice();
  return true;
}

export function voiceAction(query: string): "draw" | "documents" | "recall" {
  if (/\b(draw|wireframe|sketch|diagram|map|chart|mockup)\b/i.test(query)) return "draw";
  if (/\b(draft|generate|write|create|update|edit|revise|change)\b.*\b(prd|document|action items|decisions|journey)\b/i.test(query)) return "documents";
  return "recall";
}

export function pauseNudge(lastUtterance: string, silentMs: number, enabled: boolean): string | null {
  if (!enabled || silentMs < 6000 || !/(\?|\b(should we|can we|what next|any questions|what do you think)\b)/i.test(lastUtterance)) return null;
  return "Would you like me to capture the decisions or draw the next step?";
}
