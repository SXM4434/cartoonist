-- A live room link is the guest capability. Historical data requires membership
-- in the room's workspace. Room IDs alone never expose ended personal rooms.
CREATE OR REPLACE FUNCTION public.room_member_access(p_room uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.workspaces w ON w.id = r.workspace_id
    JOIN public.team_members m ON m.team_id = w.team_id
    WHERE r.id = p_room AND m.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.room_can_read(p_room uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_live_room(p_room) OR public.room_member_access(p_room)
$$;

REVOKE ALL ON FUNCTION public.room_member_access(uuid), public.room_can_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.room_member_access(uuid), public.room_can_read(uuid) TO anon, authenticated, service_role;

-- The host is set by the database, never by a client-supplied user ID.
CREATE OR REPLACE FUNCTION public.room_create(
  p_name text, p_goal text, p_outputs text[], p_facilitation text,
  p_host_role text, p_mode text, p_session_type text)
RETURNS TABLE (id uuid, join_code text, name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.rooms (name, goal, outputs, facilitation, host_role, mode, session_type, host_id)
  VALUES (left(coalesce(nullif(trim(p_name), ''), 'Untitled meeting'), 200),
          left(coalesce(p_goal, ''), 2000), p_outputs, p_facilitation,
          left(coalesce(p_host_role, ''), 200), p_mode, p_session_type, auth.uid())
  RETURNING rooms.id, rooms.join_code, rooms.name;
END $$;

-- A team meeting is created and attached in one transaction. Failure leaves no
-- personal room behind and the membership check cannot be skipped by the UI.
CREATE FUNCTION public.workspace_create_room(
  p_workspace uuid, p_name text, p_goal text, p_outputs text[],
  p_facilitation text, p_host_role text, p_mode text, p_session_type text)
RETURNS TABLE (id uuid, join_code text, name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
     OR NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace AND public.team_has_access(w.team_id)) THEN
    RAISE EXCEPTION 'Workspace membership required';
  END IF;
  RETURN QUERY
  INSERT INTO public.rooms (name, goal, outputs, facilitation, host_role, mode, session_type, host_id, workspace_id)
  VALUES (left(coalesce(nullif(trim(p_name), ''), 'Untitled meeting'), 200),
          left(coalesce(p_goal, ''), 2000), p_outputs, p_facilitation,
          left(coalesce(p_host_role, ''), 200), p_mode, p_session_type, auth.uid(), p_workspace)
  RETURNING rooms.id, rooms.join_code, rooms.name;
END $$;
REVOKE ALL ON FUNCTION public.workspace_create_room(uuid,text,text,text[],text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workspace_create_room(uuid,text,text,text[],text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.room_by_code(p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id FROM public.rooms r
  WHERE p_code IS NOT NULL AND length(trim(p_code)) BETWEEN 4 AND 12
    AND upper(r.join_code) = upper(trim(p_code)) AND public.is_live_room(r.id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.room_get(p_id uuid)
RETURNS TABLE (id uuid, name text, goal text, outputs text[], facilitation text,
               host_role text, join_code text, ended_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.goal, r.outputs, r.facilitation, r.host_role, r.join_code, r.ended_at
  FROM public.rooms r WHERE r.id = p_id AND public.room_can_read(r.id)
$$;

CREATE OR REPLACE FUNCTION public.rooms_by_ids(p_ids uuid[])
RETURNS TABLE (id uuid, name text, goal text, ended_at timestamptz, join_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.goal, r.ended_at, r.join_code FROM public.rooms r
  WHERE r.id = ANY(coalesce(p_ids, '{}'::uuid[]))
    AND coalesce(array_length(p_ids, 1), 0) <= 200
    AND public.room_can_read(r.id)
$$;

CREATE OR REPLACE FUNCTION public.session_stats(p_ids uuid[])
RETURNS TABLE (room_id uuid, participants bigint, shapes bigint, messages bigint, last_activity timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id,
    (SELECT count(*) FROM public.participants p WHERE p.room_id = r.id),
    (SELECT count(*) FROM public.canvas_events c WHERE c.room_id = r.id),
    (SELECT count(*) FROM public.transcript_chunks t WHERE t.room_id = r.id),
    greatest((SELECT max(c.created_at) FROM public.canvas_events c WHERE c.room_id = r.id),
             (SELECT max(t.created_at) FROM public.transcript_chunks t WHERE t.room_id = r.id))
  FROM public.rooms r
  WHERE r.id = ANY(coalesce(p_ids, '{}'::uuid[]))
    AND coalesce(array_length(p_ids, 1), 0) <= 200
    AND public.room_can_read(r.id)
$$;

CREATE OR REPLACE FUNCTION public.canvas_events_for_room(p_room uuid, p_limit int DEFAULT 2000)
RETURNS TABLE (op jsonb, source text, transcript_span jsonb, thread_id text, t_offset_ms int, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.op, c.source, c.transcript_span, c.thread_id, c.t_offset_ms, c.created_at
  FROM public.canvas_events c
  WHERE c.room_id = p_room AND public.room_can_read(p_room)
  ORDER BY c.created_at ASC
  LIMIT least(greatest(coalesce(p_limit, 2000), 0), 4000)
$$;

CREATE OR REPLACE FUNCTION public.recall_list(p_room uuid)
RETURNS SETOF public.room_recall LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rr.* FROM public.room_recall rr
  WHERE rr.room_id = p_room AND public.room_can_read(p_room)
  ORDER BY rr.created_at DESC LIMIT 50
$$;

-- Memory never accepts a device's room list as proof. Every returned room must
-- belong to a workspace of which the caller is a member.
CREATE OR REPLACE FUNCTION public.memory_index(p_room_ids uuid[], p_exclude uuid)
RETURNS TABLE (room_id uuid, room_name text, thread_id text, transcript_span jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.room_id, r.name, c.thread_id, c.transcript_span, c.created_at
  FROM public.canvas_events c JOIN public.rooms r ON r.id = c.room_id
  WHERE c.room_id = ANY(coalesce(p_room_ids, '{}'::uuid[]))
    AND coalesce(array_length(p_room_ids, 1), 0) <= 200
    AND (p_exclude IS NULL OR c.room_id <> p_exclude)
    AND public.room_member_access(c.room_id)
    AND (p_exclude IS NULL OR EXISTS (
      SELECT 1 FROM public.rooms current_room
      WHERE current_room.id = p_exclude AND current_room.workspace_id = r.workspace_id
        AND public.room_member_access(current_room.id)))
    AND c.thread_id IS NOT NULL
  ORDER BY c.created_at DESC LIMIT 1200
$$;

CREATE OR REPLACE FUNCTION public.relations_list(p_room uuid)
RETURNS TABLE (to_room_id uuid, to_thread_id text, relation text, confidence numeric, reason text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cr.to_room_id, cr.to_thread_id, cr.relation, cr.confidence, cr.reason, cr.created_at
  FROM public.canvas_relations cr
  JOIN public.rooms source_room ON source_room.id = cr.from_room_id
  JOIN public.rooms target_room ON target_room.id = cr.to_room_id
  WHERE cr.from_room_id = p_room AND source_room.workspace_id = target_room.workspace_id
    AND public.room_member_access(p_room) AND public.room_member_access(cr.to_room_id)
  ORDER BY cr.created_at DESC LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.relation_add(
  p_from_room uuid, p_from_thread text, p_to_room uuid, p_to_thread text,
  p_relation text, p_confidence numeric, p_reason text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_live_room(p_from_room) OR NOT public.room_member_access(p_from_room)
     OR NOT public.room_member_access(p_to_room)
     OR NOT EXISTS (SELECT 1 FROM public.rooms a JOIN public.rooms b ON b.id = p_to_room
                    WHERE a.id = p_from_room AND a.workspace_id = b.workspace_id) THEN
    RAISE EXCEPTION 'Workspace access required';
  END IF;
  INSERT INTO public.canvas_relations (from_room_id, from_thread_id, to_room_id, to_thread_id, relation, confidence, reason)
  VALUES (p_from_room, left(p_from_thread, 120), p_to_room, left(p_to_thread, 120),
          coalesce(nullif(p_relation, ''), 'references'), least(greatest(coalesce(p_confidence, 0.5), 0), 1),
          left(coalesce(p_reason, ''), 2000));
END $$;

-- Keep Realtime reads limited to active meetings. The link remains the guest
-- capability during that meeting; no anon policy exposes historical rows.
DROP POLICY IF EXISTS "participants read live" ON public.participants;
CREATE POLICY "participants read live" ON public.participants FOR SELECT TO anon, authenticated USING (public.is_live_room(room_id));
DROP POLICY IF EXISTS "transcript read live" ON public.transcript_chunks;
CREATE POLICY "transcript read live" ON public.transcript_chunks FOR SELECT TO anon, authenticated USING (public.is_live_room(room_id));
DROP POLICY IF EXISTS "canvas read live" ON public.canvas_events;
CREATE POLICY "canvas read live" ON public.canvas_events FOR SELECT TO anon, authenticated USING (public.is_live_room(room_id));
DROP POLICY IF EXISTS "speaker_map read live" ON public.speaker_map;
CREATE POLICY "speaker_map read live" ON public.speaker_map FOR SELECT TO anon, authenticated USING (public.is_live_room(room_id));
DROP POLICY IF EXISTS "ai_calls read live" ON public.ai_calls;
CREATE POLICY "ai_calls read live" ON public.ai_calls FOR SELECT TO anon, authenticated USING (public.is_live_room(room_id));
DROP POLICY IF EXISTS "session summaries read live" ON public.session_summaries;
CREATE POLICY "session summaries read live" ON public.session_summaries FOR SELECT TO anon, authenticated USING (public.is_live_room(room_id));

-- The copied storage migration removes the old anon read policy. Reassert its
-- ownership condition here so later policy drift cannot restore public reads.
DROP POLICY IF EXISTS "voice samples read" ON storage.objects;
CREATE POLICY "voice samples read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-samples' AND owner_id = (SELECT auth.uid()::text));
