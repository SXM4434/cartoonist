import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export const uploadVoiceSample = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("A recording is required.");
    const file = data.get("file");
    const roomId = data.get("roomId");
    if (!(file instanceof Blob) || file.size < 2000 || file.size > 5_000_000 || !/^audio\/(webm|ogg|wav|mp4|mpeg)/.test(file.type)) throw new Error("Use an audio recording under 5 MB.");
    if (typeof roomId !== "string" || !/^[0-9a-f-]{36}$/i.test(roomId)) throw new Error("A valid meeting is required.");
    return data;
  })
  .handler(async ({ data }) => {
    const roomId = String(data.get("roomId"));
    const file = data.get("file");
    if (!(file instanceof Blob)) throw new Error("Recording missing.");
    const authorization = getRequest().headers.get("authorization");
    let owner: string | null = null;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Recording storage is unavailable.");
    const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: authorization ? { Authorization: authorization } : {} } });
    if (authorization) {
      const { data: user, error } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
      if (error || !user.user) throw new Error("Sign in again before saving a recording.");
      owner = user.user.id;
    }
    const { data: rooms, error: roomError } = await client.rpc("room_get", { p_id: roomId });
    if (roomError || !rooms?.length || rooms[0].ended_at) throw new Error("This meeting is unavailable.");
    const path = `${owner ?? "guests"}/${roomId}/${crypto.randomUUID()}.webm`;
    if (owner) {
      const { error } = await client.storage.from("voice-samples").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error("Could not save your recording.");
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.storage.from("voice-samples").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error("Could not save the guest recording.");
    }
    return { path };
  });