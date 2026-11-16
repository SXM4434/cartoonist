import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { workspaceExamples } from "./drawing-feedback";

// A room UUID alone does not authorize cross-meeting examples. Authenticate
// the caller and check membership against protected database rows first.
export async function authorizedDrawingExamples(request: Request, roomId: string): Promise<string> {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!token || !url || !key) return "";
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data: identity, error: authError } = await client.auth.getUser(token);
    if (authError || !identity.user) return "";

    const { data: room, error: roomError } = await supabaseAdmin.from("rooms").select("workspace_id").eq("id", roomId).maybeSingle();
    const workspaceId = (room as { workspace_id?: string | null } | null)?.workspace_id;
    if (roomError || !workspaceId) return "";
    const { data: workspace, error: workspaceError } = await supabaseAdmin.from("workspaces").select("team_id").eq("id", workspaceId).maybeSingle();
    const teamId = (workspace as { team_id?: string } | null)?.team_id;
    if (workspaceError || !teamId) return "";
    const { data: member, error: memberError } = await supabaseAdmin.from("team_members")
      .select("user_id").eq("team_id", teamId).eq("user_id", identity.user.id).maybeSingle();
    if (memberError || !member) return "";

    const { data: rooms, error: roomsError } = await supabaseAdmin.from("rooms")
      .select("id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
    if (roomsError || !rooms?.length) return "";
    const ids = rooms.map((row) => row.id);
    const { data: feedback, error: feedbackError } = await supabaseAdmin.from("drawing_feedback" as never)
      .select("outcome,original_span,original_thread_id,original_op,result_record").in("room_id", ids)
      .order("created_at", { ascending: false }).limit(20);
    if (feedbackError || !feedback) return "";
    return workspaceExamples(feedback as Array<{ outcome: string; original_span: unknown; original_thread_id: string; original_op: unknown; result_record: unknown }>);
  } catch (error) {
    console.warn("[drawing-feedback] workspace examples unavailable", error);
    return "";
  }
}
