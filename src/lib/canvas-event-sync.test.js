import { expect, test } from "bun:test";
import { ParticipantBatch, applyCanvasEvent, shouldFitRoomOnPhone, shouldPublishChange, shouldSeedCanvas } from "./canvas-event-sync";
import { existingParticipantId } from "./participant-identity";

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

test("a returning person reuses their room row", () => {
  const rows = [{ id: "ana", display_name: "SyncTest Ana" }, { id: "ben", display_name: "SyncTest Ben" }];
  expect(existingParticipantId(rows, "ana", "SyncTest Ana")).toBe("ana");
  expect(existingParticipantId(rows, null, " synctest ana ")).toBe("ana");
  expect(existingParticipantId(rows, null, "New Guest")).toBeNull();
});

test("clear removes AI and participant drawings during replay", () => {
  const ai = new Map();
  const participant = new Map();
  applyCanvasEvent(ai, participant, { source: "seed", op: { id: "seed_goal", type: "note" } });
  applyCanvasEvent(ai, participant, { source: "participant", op: { kind: "participant_upsert", id: "shape:stroke", record: { id: "shape:stroke", typeName: "shape" } } });
  applyCanvasEvent(ai, participant, { source: "clear", op: { kind: "clear" } });
  expect(ai.size).toBe(0);
  expect(participant.get("shape:stroke")).toBeNull();
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
