export type ParticipantOp =
  | { kind: "participant_upsert"; id: string; record: { id: string; typeName: string } }
  | { kind: "participant_remove"; id: string };

export function shouldPublishChange(source: string, applyingRemote: boolean): boolean {
  return source === "user" && !applyingRemote;
}

export function shouldSeedCanvas(eventsLoaded: boolean, seeded: boolean, shapeCount: number, hasGoal: boolean, hasCanvasHistory = false): boolean {
  return eventsLoaded && !seeded && !hasCanvasHistory && shapeCount === 0 && hasGoal;
}

export function shouldFitRoomOnPhone(viewportWidth: number, eventsLoaded: boolean, hasContent: boolean, alreadyFitted: boolean): boolean {
  return viewportWidth < 768 && eventsLoaded && hasContent && !alreadyFitted;
}

type Rect = { x: number; y: number; w: number; h: number };

export function phoneRoomCamera(bounds: Rect, visible: Rect, padding = 16, readableFloor = 0.65): { x: number; y: number; z: number } {
  const fitZoom = Math.min(1, (visible.w - padding * 2) / bounds.w, (visible.h - padding * 2) / bounds.h);
  const z = Math.max(readableFloor, fitZoom);
  if (fitZoom < readableFloor) {
    return { x: (visible.x + padding) / z - bounds.x, y: (visible.y + padding) / z - bounds.y, z };
  }
  return {
    x: (visible.x + (visible.w - bounds.w * z) / 2) / z - bounds.x,
    y: (visible.y + (visible.h - bounds.h * z) / 2) / z - bounds.y,
    z,
  };
}

// The last version of a shape wins while the pen is moving. A completed stroke
// or drag therefore sends one record rather than every pointer sample.
export class ParticipantBatch {
  private pending = new Map<string, ParticipantOp>();

  add(op: ParticipantOp): void {
    this.pending.set(op.id, op);
  }

  drain(): ParticipantOp[] {
    const rows = [...this.pending.values()];
    this.pending.clear();
    return rows;
  }
}

export function applyCanvasEvent<A extends { id: string; type: string }, P extends { id: string; typeName: string }>(
  ai: Map<string, A>,
  participant: Map<string, P | null>,
  row: { source: string | null; op: unknown },
): void {
  if (!row.op || typeof row.op !== "object") return;
  const op = row.op as Record<string, unknown>;
  if (op.kind === "clear") {
    ai.clear();
    for (const id of participant.keys()) participant.set(id, null);
    return;
  }
  if (typeof op.id !== "string") return;
  if (row.source === "participant") {
    if (op.kind === "participant_remove") participant.set(op.id, null);
    if (op.kind === "participant_upsert" && op.record && typeof op.record === "object") {
      const record = op.record as Record<string, unknown>;
      if (record.id === op.id && ["shape", "asset", "binding"].includes(String(record.typeName))) participant.set(op.id, record as P);
    }
    return;
  }
  if (op.kind === "remove") {
    ai.delete(op.id);
  } else if (op.kind === "edit" && op.patch && typeof op.patch === "object") {
    const before = ai.get(op.id);
    if (before) ai.set(op.id, { ...before, ...(op.patch as object), id: before.id, type: before.type });
  } else if (typeof op.type === "string") {
    ai.set(op.id, op as A);
  }
}
