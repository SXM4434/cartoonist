import { describe, expect, test } from "bun:test";
import { guardExpensiveRoute } from "./room-guard.server.ts";

describe("optional room guard", () => {
  test("allows onboarding without a room ID", async () => {
    const response = await guardExpensiveRoute(new Request("https://test.local"), {
      route: "optional-room-test-missing", maxBytes: 100, limit: 10, requireRoom: false,
    });
    expect(response).toBeNull();
  });

  test("rejects a supplied malformed room ID", async () => {
    const response = await guardExpensiveRoute(new Request("https://test.local"), {
      route: "optional-room-test-malformed", maxBytes: 100, limit: 10,
      requireRoom: false, roomId: "wrong-room",
    });
    expect(response?.status).toBe(400);
  });
});
