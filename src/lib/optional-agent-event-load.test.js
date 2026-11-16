import { test, expect, spyOn } from "bun:test";
import { loadOptionalAgentEvents } from "./optional-agent-event-load.ts";

test("missing agent events function leaves the room error unset", async () => {
  const failure = new Error("Could not find the function public.agent_events_list(p_room) in the schema cache");
  const logged = spyOn(console, "error").mockImplementation(() => {});
  let roomError = null;
  try {
    await loadOptionalAgentEvents(
      () => Promise.reject(failure),
      () => { roomError = "Room error"; },
      () => true,
      "advocate",
    );
    expect(roomError).toBeNull();
    expect(logged).toHaveBeenCalledWith("[advocate] could not load agent events", failure);
  } finally {
    logged.mockRestore();
  }
});
