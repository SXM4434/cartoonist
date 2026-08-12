import type { SketchPrimitive } from "./sketch-types";

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function pointsOf(s: SketchPrimitive): Array<[number, number]> {
  switch (s.type) {
    case "arrow":
    case "line":
      return [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ];
    case "path":
    case "stroke":
      return s.points ?? [];
    case "text":
      return [
        [s.x, s.y],
        [s.x + 160, s.y + (s.size ?? 16)],
      ];
    case "icon":
      return [
        [s.x, s.y],
        [s.x + (s.size ?? 24), s.y + (s.size ?? 24)],
      ];
    case "note":
      return [
        [s.x, s.y],
        [s.x + (s.w ?? 180), s.y + (s.h ?? 140)],
      ];
    default:
      return [
        [s.x, s.y],
        [s.x + (s.w ?? 0), s.y + (s.h ?? 0)],
      ];
  }
}

export function bboxOf(shapes: SketchPrimitive[]): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of shapes) {
    for (const [px, py] of pointsOf(s)) {
      const x = num(px);
      const y = num(py);
      if (x === null || y === null) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { minX, minY, maxX, maxY };
}

export function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  return a.minX - pad < b.maxX && b.minX - pad < a.maxX && a.minY - pad < b.maxY && b.minY - pad < a.maxY;
}

/** Shift a batch of primitives by (dx, dy). Returns new objects. */
export function translatePrimitives(shapes: SketchPrimitive[], dx: number, dy: number): SketchPrimitive[] {
  if (!dx && !dy) return shapes;
  return shapes.map((s) => {
    switch (s.type) {
      case "arrow":
      case "line":
        return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
      case "path":
      case "stroke":
        return { ...s, points: (s.points ?? []).map(([x, y]) => [x + dx, y + dy] as [number, number]) };
      default:
        return { ...s, x: s.x + dx, y: s.y + dy };
    }
  });
}

/**
 * Deterministic no-overlap placement: if a fresh batch lands on top of what is
 * already on the canvas, slide it into open space to the right (or below when
 * the canvas is already very wide).
 */
export function placeBatchClear(existing: SketchPrimitive[], incoming: SketchPrimitive[], gap = 280): SketchPrimitive[] {
  const a = bboxOf(existing);
  const b = bboxOf(incoming);
  if (!a || !b || !boxesOverlap(a, b, 16)) return incoming;
  const canvasW = a.maxX - a.minX;
  const canvasH = a.maxY - a.minY;
  if (canvasW > canvasH * 2.2) {
    return translatePrimitives(incoming, 0, a.maxY + gap - b.minY);
  }
  return translatePrimitives(incoming, a.maxX + gap - b.minX, 0);
}
