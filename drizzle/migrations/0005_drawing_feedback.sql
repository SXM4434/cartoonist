-- Human outcomes on drawings generated in this room. Match the original
-- mediator event so stored feedback keeps its drawing context.
CREATE TABLE public.drawing_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  shape_id text NOT NULL,
  action_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('kept', 'edited', 'deleted')),
  original_thread_id text NOT NULL,
  original_span jsonb NOT NULL,
  original_op jsonb NOT NULL,
  result_record jsonb CHECK (result_record IS NULL OR pg_column_size(result_record) <= 65536),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, shape_id, outcome, action_id)
);

CREATE INDEX drawing_feedback_room_created_idx ON public.drawing_feedback(room_id, created_at DESC);
ALTER TABLE public.drawing_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drawing_feedback FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.drawing_feedback TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drawing_feedback TO service_role;

CREATE POLICY drawing_feedback_original_event ON public.drawing_feedback
  FOR INSERT TO anon, authenticated WITH CHECK (
    public.is_live_room(room_id)
    AND EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id AND p.room_id = drawing_feedback.room_id
    )
    AND EXISTS (
      SELECT 1 FROM public.canvas_events e
      WHERE e.room_id = drawing_feedback.room_id
        AND e.source = 'mediator'
        AND e.op->>'id' = drawing_feedback.shape_id
        AND e.thread_id = drawing_feedback.original_thread_id
        AND e.transcript_span = drawing_feedback.original_span
        AND e.op = drawing_feedback.original_op
    )
  );

-- Cursor paging lets a room reload every drawing event while new inserts
-- continue. The existing room-link access model is retained here.
CREATE INDEX canvas_events_room_cursor_idx ON public.canvas_events(room_id, created_at, id);
CREATE FUNCTION public.canvas_events_page(
  p_room uuid,
  p_after_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  id uuid, op jsonb, source text, transcript_span jsonb,
  thread_id text, t_offset_ms integer, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.op, c.source, c.transcript_span,
         c.thread_id, c.t_offset_ms, c.created_at
  FROM public.canvas_events c
  WHERE c.room_id = p_room
    AND (p_after_at IS NULL OR (c.created_at, c.id) > (p_after_at, p_after_id))
  ORDER BY c.created_at, c.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 500)
$$;
REVOKE ALL ON FUNCTION public.canvas_events_page(uuid, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_events_page(uuid, timestamptz, uuid, integer) TO anon, authenticated, service_role;