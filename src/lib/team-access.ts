import { z } from "zod";

export const teamActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80) }),
  z.object({ action: z.literal("invite"), team: z.string().uuid() }),
  z.object({ action: z.literal("accept"), token: z.string().uuid() }),
  z.object({ action: z.literal("remove"), team: z.string().uuid(), user: z.string().uuid() }),
]);

export function assertTeamAccount(userId: unknown, claims: Record<string, unknown> | null): void {
  if (typeof userId !== "string" || !z.string().uuid().safeParse(userId).success || claims?.is_anonymous === true) {
    throw new Error("Sign in with an account to manage a team.");
  }
}
