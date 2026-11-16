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

CREATE OR REPLACE FUNCTION public.reference_list(p_room uuid)
RETURNS SETOF public.room_references
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.room_references
  WHERE room_id = p_room
    AND public.room_can_read(p_room)
  ORDER BY created_at DESC
  LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.reference_save(
  p_room uuid,
  p_query text,
  p_title text,
  p_url text,
  p_snippet text,
  p_source text,
  p_shape_id text
)
RETURNS SETOF public.room_references
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A live room is enough for a guest. After it ends, only a workspace member can pin.
  IF NOT (public.is_live_room(p_room) OR public.room_member_access(p_room)) THEN
    RAISE EXCEPTION 'Room access required';
  END IF;
  IF length(trim(p_title)) < 1 OR length(trim(p_url)) < 8 THEN
    RAISE EXCEPTION 'A title and URL are required';
  END IF;
  RETURN QUERY
  INSERT INTO public.room_references (room_id, query, title, url, snippet, source, shape_id)
  VALUES (
    p_room,
    left(trim(p_query), 300),
    left(trim(p_title), 200),
    left(trim(p_url), 500),
    left(coalesce(p_snippet, ''), 600),
    left(coalesce(p_source, ''), 120),
    nullif(trim(coalesce(p_shape_id, '')), '')
  )
  ON CONFLICT (room_id, url) DO UPDATE SET
    title = excluded.title,
    snippet = excluded.snippet,
    source = excluded.source,
    shape_id = coalesce(excluded.shape_id, public.room_references.shape_id),
    query = excluded.query
  RETURNING *;
END
$$;

REVOKE ALL ON FUNCTION public.reference_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reference_save(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reference_list(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reference_save(uuid, text, text, text, text, text, text) TO anon, authenticated;
