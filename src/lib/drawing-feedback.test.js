import { expect, test } from "bun:test";
import { FeedbackDeduper, workspaceExamples } from "./drawing-feedback";

test("records each real outcome once per original generated shape", () => {
  const deduper = new FeedbackDeduper();
  expect(deduper.accept("room", "shape", "edited")).toBe(true);
  expect(deduper.accept("room", "shape", "edited")).toBe(false);
  expect(deduper.accept("room", "shape", "deleted")).toBe(true);
  expect(deduper.accept("room", "other", "edited")).toBe(true);
  expect(deduper.accept("room", "shape", "edited", "second-drag")).toBe(true);
  expect(deduper.accept("room", "shape", "edited", "second-drag")).toBe(false);
});

test("prompt examples use only recorded outcomes and original context", () => {
  expect(workspaceExamples([{ outcome: "kept", original_span: { latest: "Sketch a calendar" }, original_thread_id: "thread-1", original_op: { type: "rect", label: "Calendar" } }])).toContain("rect / Calendar");
  expect(workspaceExamples([{ outcome: "invented", original_span: { latest: "bad" }, original_thread_id: "thread-2" }])).toBe("");
});
