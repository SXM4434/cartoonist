-- Keep a room's clear and drawing batches in one database order.
CREATE OR REPLACE FUNCTION public.canvas_events_append(
  p_room uuid, p_rows jsonb, p_expected_clear uuid, p_seed boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE v_clear uuid;
BEGIN
  IF NOT public.is_live_room(p_room) THEN RAISE EXCEPTION 'Room is not live'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 100 OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Invalid canvas batch';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_room::text, 0));
  SELECT id INTO v_clear FROM public.canvas_events
    WHERE room_id = p_room AND op->>'kind' = 'clear'
    ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_clear IS DISTINCT FROM p_expected_clear THEN RETURN false; END IF;
  IF p_seed AND EXISTS (
    SELECT 1 FROM public.canvas_events WHERE room_id = p_room AND source <> 'participant'
  ) THEN RETURN false; END IF;
  INSERT INTO public.canvas_events (room_id, op, t_offset_ms, source, transcript_span, confidence, thread_id)
  SELECT p_room, x.op, COALESCE(x.t_offset_ms, 0), x.source, x.transcript_span, x.confidence, x.thread_id
    FROM jsonb_to_recordset(p_rows) AS x(
      op jsonb, t_offset_ms integer, source text, transcript_span jsonb, confidence real, thread_id text
    );
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.canvas_events_append(uuid, jsonb, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_events_append(uuid, jsonb, uuid, boolean) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.canvas_events_clear(p_room uuid, p_row jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE v_id uuid; v_at timestamptz;
BEGIN
  IF NOT public.is_live_room(p_room) THEN RAISE EXCEPTION 'Room is not live'; END IF;
  IF p_row->'op'->>'kind' IS DISTINCT FROM 'clear' THEN RAISE EXCEPTION 'Invalid clear'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_room::text, 0));
  INSERT INTO public.canvas_events (room_id, op, t_offset_ms, source, transcript_span, confidence)
  VALUES (p_room, p_row->'op', COALESCE((p_row->>'t_offset_ms')::integer, 0),
    'clear', p_row->'transcript_span', 1)
  RETURNING id, created_at INTO v_id, v_at;
  RETURN jsonb_build_object('id', v_id, 'created_at', v_at);
END;
$$;
REVOKE ALL ON FUNCTION public.canvas_events_clear(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_events_clear(uuid, jsonb) TO anon, authenticated, service_role;

-- Room links can read a live canvas, including unsigned-in guests.
CREATE OR REPLACE FUNCTION public.canvas_events_page(
  p_room uuid, p_after_at timestamptz DEFAULT NULL, p_after_id uuid DEFAULT NULL, p_limit integer DEFAULT 500
)
RETURNS TABLE (id uuid, op jsonb, source text, transcript_span jsonb,
  thread_id text, t_offset_ms integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.op, c.source, c.transcript_span, c.thread_id, c.t_offset_ms, c.created_at
  FROM public.canvas_events c
  WHERE c.room_id = p_room AND public.is_live_room(p_room)
    AND (p_after_at IS NULL OR (c.created_at, c.id) > (p_after_at, p_after_id))
  ORDER BY c.created_at, c.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500)
$$;
