import { expect, test } from "bun:test";
import { ParticipantBatch, applyCanvasEvent, shouldPublishChange, shouldSeedCanvas } from "./canvas-event-sync";

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
});

test("related tldraw assets and bindings replay with shapes", () => {
  const ai = new Map();
  const records = new Map();
  applyCanvasEvent(ai, records, { source: "participant", op: { kind: "participant_upsert", id: "asset:1", record: { id: "asset:1", typeName: "asset" } } });
  applyCanvasEvent(ai, records, { source: "participant", op: { kind: "participant_upsert", id: "binding:1", record: { id: "binding:1", typeName: "binding" } } });
  expect([...records.keys()]).toEqual(["asset:1", "binding:1"]);
});
