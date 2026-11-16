import { describe, expect, test } from "bun:test";
import { assertTeamAccount, teamActionSchema } from "./team-access.ts";

const owner = "11111111-1111-4111-8111-111111111111";

describe("team action boundary", () => {
  test("requires a signed-in account rather than a guest or anonymous identity", () => {
    expect(() => assertTeamAccount(null, null)).toThrow();
    expect(() => assertTeamAccount(owner, { is_anonymous: true })).toThrow();
    expect(() => assertTeamAccount("guest", {})).toThrow();
    expect(() => assertTeamAccount(owner, { is_anonymous: false })).not.toThrow();
  });

  test("accepts only a valid invitation token and team action arguments", () => {
    expect(teamActionSchema.safeParse({ action: "accept", token: owner }).success).toBe(true);
    expect(teamActionSchema.safeParse({ action: "accept", token: "missing" }).success).toBe(false);
    expect(teamActionSchema.safeParse({ action: "remove", team: owner, user: "missing" }).success).toBe(false);
    expect(teamActionSchema.parse({ action: "invite", team: owner, role: "owner" })).toEqual({ action: "invite", team: owner });
  });
});
