import type { SketchPrimitive } from "./sketch-types";
import { bboxOf, translatePrimitives } from "./sketch-layout";

/**
 * v1 Phase 2.3 — Storyboard frames.
 * The canvas grows left→right in fixed-width frames. Each new topic opens a
 * new frame with a title strip; drawings land inside the active frame instead
 * of marching endlessly to the right of whatever happened to be there.
 */
export const FRAME_W = 1200;
export const FRAME_GAP = 200;
export const FRAME_X0 = 80;
export const FRAME_TOP = 40;
export const FRAME_PAD = 48;
/** Content starts below the title strip. */
const SMALL_W = 420;
const SMALL_H = 320;
const ROW_GAP = 32;
export const FRAME_CONTENT_TOP = FRAME_TOP + 96;

export type StoryFrame = {
  index: number;
  topic: string;
  at: number;
  x: number;
  shapeIds: string[];
};

export function frameOriginX(index: number): number {
  return FRAME_X0 + index * (FRAME_W + FRAME_GAP);
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Title strip for a frame: number · timestamp · topic, plus a hairline rule. */
export function frameTitlePrimitives(index: number, topic: string, elapsedMs: number): SketchPrimitive[] {
  const x = frameOriginX(index) + FRAME_PAD;
  const label = `Frame ${index + 1} · ${clock(elapsedMs)} · ${topic}`.slice(0, 90);
  return [
    {
      type: "text",
      id: `sb_title_${index}`,
      x,
      y: FRAME_TOP + 8,
      text: label,
      size: 22,
      weight: "bold",
      align: "left",
      style: "ui",
    } as SketchPrimitive,
    {
      type: "line",
      id: `sb_rule_${index}`,
      x1: x,
      y1: FRAME_TOP + 52,
      x2: frameOriginX(index) + FRAME_W - FRAME_PAD,
      y2: FRAME_TOP + 52,
      style: "ui",
    } as SketchPrimitive,
  ];
}

/**
 * Place a fresh batch inside the given frame: left-aligned to the frame's
 * content column, stacked under whatever the frame already holds.
 */
export function placeInFrame(
  incoming: SketchPrimitive[],
  index: number,
  frameShapes: SketchPrimitive[],
): SketchPrimitive[] {
  const b = bboxOf(incoming);
  if (!b) return incoming;
  const originX = frameOriginX(index) + FRAME_PAD;
  const content = frameShapes.filter((s) => !s.id.startsWith("sb_"));
  const occupied = bboxOf(content);
  // Small marks (a note, a quick sketch) sit side by side in a row instead of
  // each starting a new row, so a run of notes reads as a group, not a ladder.
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  if (occupied && w <= SMALL_W && h <= SMALL_H) {
    const marks = content.flatMap((s) => { const box = bboxOf([s]); return box ? [{ s, box }] : []; });
    const boxes = marks.map((m) => m.box);
    // The last row starts at the top of the bottom-most mark.
    const bottom = boxes.reduce((lo, x) => (x.maxY > lo.maxY ? x : lo), boxes[0]!);
    const rowTop = bottom.minY - 8;
    const row = boxes.filter((x) => x.minY >= rowTop);
    const crossesIn = boxes.some((x) => x.minY < rowTop && x.maxY > rowTop + 16);
    const rowBox = bboxOf(marks.filter((m) => m.box.minY >= rowTop).map((m) => m.s));
    if (!crossesIn && row.length && rowBox && rowBox.maxY - rowBox.minY <= SMALL_H) {
      const x = rowBox.maxX + ROW_GAP;
      if (x + w <= frameOriginX(index) + FRAME_W - FRAME_PAD) {
        return translatePrimitives(incoming, x - b.minX, rowBox.minY - b.minY);
      }
    }
  }
  const originY = occupied ? occupied.maxY + 120 : FRAME_CONTENT_TOP;
  return translatePrimitives(incoming, originX - b.minX, originY - b.minY);
}

/** Which frame does a shape belong to, by x position? */
export function frameIndexOfShape(s: SketchPrimitive): number {
  const b = bboxOf([s]);
  if (!b) return 0;
  const rel = b.minX - FRAME_X0;
  if (rel < 0) return 0;
  return Math.max(0, Math.floor(rel / (FRAME_W + FRAME_GAP)));
}

/** Normalise a topic string for change detection. */
export function topicKey(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}
