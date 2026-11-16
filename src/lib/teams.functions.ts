import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertTeamAccount, teamActionSchema } from "@/lib/team-access";

export const teamOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  assertTeamAccount(context.userId, context.claims);
  const [teams, workspaces, members] = await Promise.all([
    context.supabase.from("teams").select("id,name"),
    context.supabase.from("workspaces").select("id,name,team_id"),
    context.supabase.from("team_members").select("team_id,user_id,role"),
  ]);
  if (teams.error || workspaces.error || members.error) throw new Error("Could not load teams.");
  return { teams: teams.data, workspaces: workspaces.data, members: members.data, userId: context.userId };
});

export const teamAction = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(teamActionSchema)
  .handler(async ({ data, context }) => {
    assertTeamAccount(context.userId, context.claims);
    const result = data.action === "create" ? await context.supabase.rpc("team_create", { p_name: data.name })
      : data.action === "invite" ? await context.supabase.rpc("team_invite_create", { p_team: data.team })
      : data.action === "accept" ? await context.supabase.rpc("team_invite_accept", { p_token: data.token })
      : await context.supabase.rpc("team_member_remove", { p_team: data.team, p_user: data.user });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
