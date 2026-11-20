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
  if (/\b(draft|generate|write|create|update|edit|revise|change)\b.*\b(prd|documents?|action items|decisions|summary|notes)\b/i.test(query)) return "documents";
  // Questions about the past go to Recall; anything visual goes to the board.
  if (/^(what|when|who|why|did|was|were|how did|remind)\b/i.test(query) && !/\b(draw|sketch|show me)\b/i.test(query)) return "recall";
  if (/\b(draw|wireframe|sketch|diagram|map|chart|graph|mockup|mock up|flow|flowchart|timeline|outline|visuali[sz]e|show|lay out|layout|screen|table|matrix|tree|journey|board|plot|add|put)\b/i.test(query)) return "draw";
  if (/^(make|create|build|give me)\b/i.test(query)) return "draw";
  return "recall";
}

export function pauseNudge(lastUtterance: string, silentMs: number, enabled: boolean): string | null {
  if (!enabled || silentMs < 6000 || !/(\?|\b(should we|can we|what next|any questions|what do you think)\b)/i.test(lastUtterance)) return null;
  return "Would you like me to capture the decisions or draw the next step?";
}

const ARTIFACT = /\b(outlines?|drawings?|sketch(?:es)?|wireframes?|mock ?ups?|(?:mobile |app |phone )*screens?|diagrams?|flow ?charts?|flows?|timelines?|charts?|graphs?|maps?|storyboards?|tables?|roadmaps?|org charts?|illustrations?|pictures?)\b/i;
const VERB_START = /^(?:(?:and|also|then|plus|so|um|uh|okay|ok|now)[\s,]+)*(?:(?:can|could|would) you|please|let'?s|i want you to|i need you to)?\s*(?:also\s+)?(?:draw|make|create|build|sketch|design|give|show|wireframe|mock|map|lay|do|add|generate)\b/i;

function isRequest(segment: string): boolean {
  const trimmed = segment.trim();
  const artifactLed = /^(?:(?:and|then|also|uh|um)[\s,]+)*(?:(?:a|an|one|some)\s+)?(?:(?:nice|quick|simple|physical|rough)\s+)?/i.exec(trimmed);
  const rest = trimmed.slice(artifactLed?.[0].length ?? 0);
  return ARTIFACT.test(segment) && (VERB_START.test(trimmed) || /\b(draw|wireframe|sketch)\b/i.test(segment) || ARTIFACT.exec(rest)?.index === 0);
}

/**
 * A pause after a busy drawing often delivers several asks in one blob
 * ("make an outline … and also draw the activation … and a mobile app screen").
 * The drafter only answers one per call, so split them into ordered requests.
 * Returns the original text when it holds zero or one request.
 */
export function splitDrawRequests(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const pieces: string[] = [];
  for (const sentence of sentences) {
    // Break before a new verb-led ask joined by "and / also / then".
    const verbParts = sentence.split(/[\s,]+(?=(?:and|also|then|plus)[\s,]+(?:(?:also|then)[\s,]+)?(?:(?:can|could|would) you\s+|please\s+)?(?:draw|make|create|build|sketch|design|give|show|wireframe|mock|do|add|generate)\b)/i);
    const thenParts = verbParts.flatMap((v) => v.split(/[\s,]+(?=(?:and\s+)?then[\s,]+(?:(?:uh|um)[\s,]+)*(?:a |an |one )?(?:mobile|app|phone|wireframe|outline|diagram|timeline|flow ?chart|storyboard)\b)/i));
    for (const part of thenParts) {
      // A list of different artifacts behind one verb: "an outline, a drawing and a mobile app screen".
      const listParts = part.split(/,\s*(?:and\s+)?(?=(?:also\s+)?(?:a|an|one|some|the)\s)|\s+and\s+(?:also\s+)?(?=(?:a|an|one|some)\s)/i);
      const allArtifacts = listParts.length > 1 && listParts.every((p) => ARTIFACT.test(p));
      if (allArtifacts) {
        const verb = /\b(draw|make|create|build|sketch|design|give us|give me|show)\b/i.exec(listParts[0] ?? "")?.[1] ?? "make";
        listParts.forEach((p, i) => pieces.push(i === 0 ? p.trim() : `${verb} ${p.trim()}`));
      } else {
        pieces.push(part.trim());
      }
    }
  }
  const requests = pieces.filter(isRequest).map((p) => {
    const stripped = p.replace(/^(?:(?:and|also|then|plus|uh|um)[\s,]+)+/i, "").trim();
    return VERB_START.test(stripped) ? stripped : `make ${stripped}`;
  });
  return requests.length > 1 ? requests : [clean];
}
