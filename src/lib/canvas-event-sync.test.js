import { expect, test } from "bun:test";
import { ParticipantBatch, applyCanvasEvent, phoneRoomCamera, shouldFitRoomOnPhone, shouldPublishChange, shouldSeedCanvas } from "./canvas-event-sync";
import * as sync from "./canvas-event-sync";
import { existingParticipantId } from "./participant-identity";
import * as identity from "./participant-identity";

test("remote changes and our own event echoes never publish", () => {
  expect(shouldPublishChange("remote", false)).toBe(false);
  expect(shouldPublishChange("user", true)).toBe(false);
  expect(shouldPublishChange("user", false)).toBe(true);
});

test("many updates to one stroke become one final event", () => {
  const batch = new ParticipantBatch();
  for (let point = 1; point <= 80; point++) {
    batch.add({ kind: "participant_upsert", id: "shape:stroke", record: { id: "shape:stroke", typeName: "shape", props: { point } } });
  }
  expect(batch.drain()).toEqual([{ kind: "participant_upsert", id: "shape:stroke", record: { id: "shape:stroke", typeName: "shape", props: { point: 80 } } }]);
  batch.add({ kind: "participant_upsert", id: "shape:stroke", record: { id: "shape:stroke", typeName: "shape" } });
  batch.add({ kind: "participant_remove", id: "shape:stroke" });
  expect(batch.drain()).toEqual([{ kind: "participant_remove", id: "shape:stroke" }]);
});

test("reloading ordered events rebuilds AI and participant drawings", () => {
  const ai = new Map();
  const participant = new Map();
  const events = [
    { source: "mediator", op: { id: "ai-1", type: "rect", x: 1 } },
    { source: "participant", op: { kind: "participant_upsert", id: "shape:pen", record: { id: "shape:pen", typeName: "shape", x: 1 } } },
    { source: "participant", op: { kind: "participant_upsert", id: "shape:pen", record: { id: "shape:pen", typeName: "shape", x: 3 } } },
    { source: "mediator", op: { kind: "edit", id: "ai-1", patch: { x: 5 } } },
  ];
  for (const row of events) applyCanvasEvent(ai, participant, row);
  expect([...ai.values()]).toEqual([{ id: "ai-1", type: "rect", x: 5 }]);
  expect([...participant.values()]).toEqual([{ id: "shape:pen", typeName: "shape", x: 3 }]);
  applyCanvasEvent(ai, participant, { source: "participant", op: { kind: "participant_remove", id: "shape:pen" } });
  expect(participant.get("shape:pen")).toBeNull();
});

test("the session brief waits for event replay before seeding", () => {
  expect(shouldSeedCanvas(false, false, 0, true)).toBe(false);
  expect(shouldSeedCanvas(true, false, 1, true)).toBe(false);
  expect(shouldSeedCanvas(true, false, 0, true)).toBe(true);
  expect(shouldSeedCanvas(true, false, 0, true, true)).toBe(false);
});

test("a brand-new room seeds after an empty event replay", () => {
  const events = [];
  const ai = new Map();
  const participant = new Map();
  for (const row of events) applyCanvasEvent(ai, participant, row);
  expect(shouldSeedCanvas(true, false, ai.size, true, events.length > 0)).toBe(true);
});

test("the initial room fit waits for loaded content and runs only once below 768 px", () => {
  expect(shouldFitRoomOnPhone(390, false, true, false)).toBe(false);
  expect(shouldFitRoomOnPhone(390, true, false, false)).toBe(false);
  expect(shouldFitRoomOnPhone(390, true, true, false)).toBe(true);
  expect(shouldFitRoomOnPhone(390, true, true, true)).toBe(false);
  expect(shouldFitRoomOnPhone(768, true, true, false)).toBe(false);
  expect(shouldFitRoomOnPhone(1440, true, true, false)).toBe(false);
});

test("phone camera fits and centers content inside the measured visible canvas", () => {
  const camera = phoneRoomCamera({ x: 100, y: 200, w: 300, h: 200 }, { x: 0, y: 96, w: 390, h: 500 });
  expect(camera).toEqual({ x: -55, y: 46, z: 1 });
  expect((100 + camera.x) * camera.z).toBe(45);
  expect((200 + camera.y) * camera.z).toBe(246);
});

test("phone camera anchors oversized content at the readable floor", () => {
  const camera = phoneRoomCamera({ x: 100, y: 200, w: 1000, h: 700 }, { x: 0, y: 96, w: 390, h: 500 });
  expect(camera.z).toBe(0.65);
  expect((100 + camera.x) * camera.z).toBeCloseTo(16);
  expect((200 + camera.y) * camera.z).toBeCloseTo(112);
  expect((1100 + camera.x) * camera.z).toBeGreaterThan(390);
});

test("a returning person reuses their room row", () => {
  const rows = [{ id: "ana", display_name: "SyncTest Ana" }, { id: "ben", display_name: "SyncTest Ben" }];
  expect(existingParticipantId(rows, "ana", "SyncTest Ana")).toBe("ana");
  expect(existingParticipantId(rows, null, " synctest ana ")).toBeNull();
  expect(existingParticipantId(rows, null, "New Guest")).toBeNull();
});

test("clear removes AI and participant drawings during replay", () => {
  const ai = new Map();
  const participant = new Map();
  applyCanvasEvent(ai, participant, { source: "seed", op: { id: "seed_goal", type: "note" } });
  applyCanvasEvent(ai, participant, { source: "participant", op: { kind: "participant_upsert", id: "shape:stroke", record: { id: "shape:stroke", typeName: "shape" } } });
  applyCanvasEvent(ai, participant, { source: "clear", op: { kind: "clear" } });
  expect(ai.size).toBe(0);
  expect(participant.has("shape:stroke")).toBe(false);
  applyCanvasEvent(ai, participant, { source: "risk", op: { id: "risk-1", type: "note" } });
  expect([...ai.keys()]).toEqual(["risk-1"]);
});

test("related tldraw assets and bindings replay with shapes", () => {
  const ai = new Map();
  const records = new Map();
  applyCanvasEvent(ai, records, { source: "participant", op: { kind: "participant_upsert", id: "asset:1", record: { id: "asset:1", typeName: "asset" } } });
  applyCanvasEvent(ai, records, { source: "participant", op: { kind: "participant_upsert", id: "binding:1", record: { id: "binding:1", typeName: "binding" } } });
  expect([...records.keys()]).toEqual(["asset:1", "binding:1"]);
});


test("1: cursor paging starts after the last event, even when another insert arrives", () => {
  expect(sync.canvasPageCursor({ id: "event-2", created_at: "2026-11-16T12:00:00Z" })).toEqual({
    p_after_at: "2026-11-16T12:00:00Z", p_after_id: "event-2",
  });
});

test("missing canvas functions select the direct table fallback", () => {
  expect(sync.isMissingCanvasRpc({ code: "PGRST202" })).toBe(true);
  expect(sync.isMissingCanvasRpc({ code: "42883" })).toBe(true);
  expect(sync.isMissingCanvasRpc({ code: "42501" })).toBe(false);
  expect(sync.isMissingCanvasRpc({ code: "PGRST116" })).toBe(false);
  expect(sync.isMissingCanvasRpc(null)).toBe(false);
});

test("2: a matching name never claims another browser's participant row", () => {
  expect(existingParticipantId([{ id: "alex", display_name: "Alex" }], null, "Alex")).toBeNull();
  expect(existingParticipantId([{ id: "alex", display_name: "Alex" }], "alex", "New name")).toBe("alex");
});

test("3: concurrent mounts reserve one participant id and insert once", async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let inserts = 0;
  const insert = async () => { inserts++; await Promise.resolve(); };
  const find = async () => false;
  const [a, b] = await Promise.all([
    identity.joinParticipant("race-room", storage, insert, find, () => "reserved-id"),
    identity.joinParticipant("race-room", storage, insert, find, () => "different-id"),
  ]);
  expect([a, b]).toEqual(["reserved-id", "reserved-id"]);
  expect(inserts).toBe(1);
  expect(storage.getItem("cartoonist_participant_race-room")).toBe("reserved-id");
});

test("4: replayed remote delete wins over an older local shape", () => {
  expect(sync.mergeHydrated(new Map(), [{ id: "deleted", type: "note" }], new Set(["deleted"]), false)).toEqual([]);
  expect(sync.mergeHydrated(new Map(), [{ id: "local", type: "note" }], new Set(), true)).toEqual([]);
});

test("5: an event received while replay reads is applied once in order", () => {
  const page = [{ id: "a", created_at: "2026-11-16T12:00:00Z" }];
  const received = [
    { id: "b", created_at: "2026-11-16T12:00:01Z" },
    { id: "a", created_at: "2026-11-16T12:00:00Z" },
  ];
  expect(sync.mergeReplayRows(page, received).map((row) => row.id)).toEqual(["a", "b"]);
});

test("6: a remote edit removes the stale queued local op", () => {
  const pending = new ParticipantBatch();
  pending.add({ kind: "participant_upsert", id: "shape:one", record: { id: "shape:one", typeName: "shape", x: 1 } });
  pending.add({ kind: "participant_upsert", id: "shape:two", record: { id: "shape:two", typeName: "shape", x: 1 } });
  pending.remove("shape:one");
  expect(pending.drain().map((op) => op.id)).toEqual(["shape:two"]);
});

test("7: seed batches are flagged so the atomic database check can admit only one", async () => {
  let seeded = false;
  const accepted = [];
  const writer = new sync.CanvasEventWriter(async (rows, _clear, seed) => {
    if (seed && seeded) return false;
    if (seed) seeded = true;
    accepted.push(rows);
    return true;
  }, async () => ({ id: "clear-id", created_at: "2026-11-16T12:00:00Z" }));
  expect(await writer.enqueue([{ id: "seed_goal" }], true)).toBe(true);
  expect(await writer.enqueue([{ id: "seed_goal" }], true)).toBe(false);
  expect(accepted).toHaveLength(1);
});

test("8: an echoed local snapshot cannot replace a newer live stroke", () => {
  const older = { id: "stroke", x: 1 };
  expect(sync.shouldApplyParticipantRecord(undefined, older, true)).toBe(false);
  expect(sync.shouldApplyParticipantRecord(undefined, older, false)).toBe(true);
});

test("9: clear releases tombstones and local overrides for a recreated AI id", () => {
  const ai = new Map();
  const participant = new Map([["seed_goal", null]]);
  const local = new Set();
  applyCanvasEvent(ai, participant, { source: "clear", op: { kind: "clear" } });
  expect(sync.isOverridden(participant, local, "seed_goal")).toBe(false);
});

test("10: feedback waits until the drawing event write settles", async () => {
  let finish;
  let persisted = false;
  const writer = new sync.CanvasEventWriter(async () => {
    await new Promise((resolve) => { finish = resolve; });
    persisted = true;
    return true;
  }, async () => ({ id: "clear-id", created_at: "2026-11-16T12:00:00Z" }));
  writer.enqueue([{ id: "drawing" }]);
  const feedback = writer.idle().then(() => persisted);
  expect(persisted).toBe(false);
  await Promise.resolve();
  finish();
  expect(await feedback).toBe(true);
});

test("11: a remote clear drops queued batches made before it", async () => {
  let finish;
  const written = [];
  const writer = new sync.CanvasEventWriter(async (rows) => {
    if (rows[0].id === "first") await new Promise((resolve) => { finish = resolve; });
    written.push(rows[0].id);
    return true;
  }, async () => ({ id: "clear-id", created_at: "2026-11-16T12:00:00Z" }));
  const first = writer.enqueue([{ id: "first" }]);
  const stale = writer.enqueue([{ id: "stale" }]);
  await Promise.resolve();
  writer.remoteClear({ id: "remote-clear", created_at: "2026-11-16T12:01:00Z" });
  finish();
  await Promise.all([first, stale]);
  expect(written).toEqual(["first"]);
});

test("a delayed older remote clear does not cancel a drawing after the local clear", async () => {
  let finishClear;
  const written = [];
  const writer = new sync.CanvasEventWriter(async (rows, clearId) => {
    written.push([rows[0].id, clearId]);
    return true;
  }, async () => new Promise((resolve) => { finishClear = resolve; }));
  const clearing = writer.clear({ id: "clear" });
  await Promise.resolve();
  writer.remoteClear({ id: "older", created_at: "2026-11-16T12:00:00Z" });
  const drawing = writer.enqueue([{ id: "after" }]);
  finishClear({ id: "newer", created_at: "2026-11-16T12:01:00Z" });
  await clearing;
  expect(await drawing).toBe(true);
  expect(written).toEqual([["after", "newer"]]);
});
