export type ParticipantOp =
  | { kind: "participant_upsert"; id: string; record: { id: string; typeName: string } }
  | { kind: "participant_remove"; id: string };

export function shouldPublishChange(source: string, applyingRemote: boolean): boolean {
  return source === "user" && !applyingRemote;
}

export function shouldSeedCanvas(eventsLoaded: boolean, seeded: boolean, shapeCount: number, hasGoal: boolean, hasCanvasHistory = false): boolean {
  return eventsLoaded && !seeded && !hasCanvasHistory && shapeCount === 0 && hasGoal;
}

export function canvasPageCursor(after: { id: string; created_at: string } | undefined) {
  return { p_after_at: after?.created_at ?? null, p_after_id: after?.id ?? null };
}

export function isMissingCanvasRpc(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export function mergeReplayRows<T extends { id: string; created_at: string }>(page: T[], received: T[]): T[] {
  return [...new Map([...page, ...received].map((row) => [row.id, row])).values()]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id));
}

export function mergeHydrated<T extends { id: string }>(
  replayed: ReadonlyMap<string, T>, current: readonly T[], touched: ReadonlySet<string>, cleared: boolean,
): T[] {
  const merged = new Map(replayed);
  if (!cleared) for (const item of current) if (!touched.has(item.id)) merged.set(item.id, item);
  return [...merged.values()];
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

  remove(id: string): void { this.pending.delete(id); }
}

export function shouldApplyParticipantRecord<T>(previous: T | undefined, incoming: T, localOwned: boolean): boolean {
  return previous !== incoming && !localOwned;
}

export function isOverridden<T>(records: ReadonlyMap<string, T | null>, localIds: ReadonlySet<string>, id: string): boolean {
  return records.has(id) || localIds.has(id);
}

/** Serializes local writes and rejects batches made before a later clear. */
export type ClearCursor = { id: string; created_at: string };

function newerClear(a: ClearCursor, b: ClearCursor | null): boolean {
  if (!b) return true;
  const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  return delta > 0 || (delta === 0 && a.id > b.id);
}

export class CanvasEventWriter<Row> {
  private tail: Promise<void> = Promise.resolve();
  private generation = 0;
  private lastClear: ClearCursor | null = null;
  private localClearPending = false;
  private remoteDuringLocal: ClearCursor | null = null;

  constructor(
    private append: (rows: Row[], clearId: string | null, seed: boolean) => Promise<boolean>,
    private insertClear: (row: Row) => Promise<ClearCursor>,
  ) {}

  setLastClear(clear: ClearCursor | null): void { this.lastClear = clear; }
  remoteClear(clear: ClearCursor): void {
    if (this.localClearPending) {
      if (newerClear(clear, this.remoteDuringLocal)) this.remoteDuringLocal = clear;
    } else if (newerClear(clear, this.lastClear)) {
      this.generation++;
      this.lastClear = clear;
    }
  }
  idle(): Promise<void> { return this.tail; }

  enqueue(rows: Row[], seed = false): Promise<boolean> {
    const generation = this.generation;
    const task = this.tail.then(() => generation === this.generation
      ? this.append(rows, this.lastClear?.id ?? null, seed) : false);
    this.tail = task.then(() => {}, () => {});
    return task;
  }

  clear(row: Row): Promise<string> {
    this.generation++;
    this.localClearPending = true;
    const task = this.tail.then(async () => {
      const clear = await this.insertClear(row);
      if (newerClear(clear, this.lastClear)) this.lastClear = clear;
      this.localClearPending = false;
      if (this.remoteDuringLocal && newerClear(this.remoteDuringLocal, clear)) {
        this.generation++;
        this.lastClear = this.remoteDuringLocal;
      }
      this.remoteDuringLocal = null;
      return clear.id;
    }).catch((error) => {
      this.localClearPending = false;
      this.remoteDuringLocal = null;
      throw error;
    });
    this.tail = task.then(() => {}, () => {});
    return task;
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
    participant.clear();
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
