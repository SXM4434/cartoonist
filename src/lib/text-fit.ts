/**
 * Text measurement for deterministic layouts. Canvas text wraps by words, so
 * layouts must know how many lines a label takes before placing the next
 * element. Estimates are deliberately generous so text never spills.
 */
export const LINE_HEIGHT = 1.35;
const CHAR_EM = 0.53;

export function wrapLines(value: string, width: number, size: number): string[] {
  const perLine = Math.max(4, Math.floor(width / (size * CHAR_EM)));
  const out: string[] = [];
  for (const para of value.split("\n")) {
    let line = "";
    for (const raw of para.split(/\s+/).filter(Boolean)) {
      // Break words longer than a full line so nothing wraps letter-by-letter.
      let word = raw;
      while (word.length > perLine) {
        if (line) { out.push(line); line = ""; }
        out.push(word.slice(0, perLine - 1) + "-");
        word = word.slice(perLine - 1);
      }
      const next = line ? `${line} ${word}` : word;
      if (next.length > perLine) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

/** Clamp text to `maxLines` at the given width, ending with an ellipsis. */
export function fitText(value: string, width: number, size: number, maxLines = 2): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const lines = wrapLines(clean, width, size);
  if (lines.length <= maxLines) return lines.join(" ").replace(/- /g, "");
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = (last.length > 8 ? last.replace(/\s+\S*$/, "") : last).replace(/[\s,;:.-]+$/, "") + "…";
  return kept.join(" ").replace(/- /g, "");
}

export function textHeight(value: string, width: number, size: number): number {
  return Math.ceil(wrapLines(value, width, size).length * size * LINE_HEIGHT);
}
