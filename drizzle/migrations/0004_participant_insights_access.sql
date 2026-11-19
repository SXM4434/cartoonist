-- Insight RPCs run as their owner, so each one must check the room explicitly.
CREATE OR REPLACE FUNCTION public.insights_list(p_room uuid)
RETURNS TABLE (id uuid, subject_name text, kind text, text text, source_quote text, confidence numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.subject_name, i.kind, i.text, i.source_quote, i.confidence
  FROM public.participant_insights i
  WHERE i.room_id = p_room AND i.dismissed = false
    AND public.room_can_read(p_room)
  ORDER BY i.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.insights_add(p_room uuid, p_rows jsonb)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.room_can_read(p_room)
     OR NOT (public.is_live_room(p_room) OR public.room_member_access(p_room)) THEN
    RAISE EXCEPTION 'Room access required';
  END IF;
  INSERT INTO public.participant_insights (room_id, subject_name, kind, text, source_quote, confidence)
  SELECT p_room,
         left(coalesce(e->>'subject_name', 'team'), 120),
         left(coalesce(e->>'kind', 'pattern'), 60),
         left(coalesce(e->>'text', ''), 1000),
         left(coalesce(e->>'source_quote', ''), 2000),
         least(greatest(coalesce((e->>'confidence')::numeric, 0.5), 0), 1)
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e
  WHERE coalesce(e->>'text', '') <> ''
  LIMIT 20;
END $$;

CREATE OR REPLACE FUNCTION public.insights_dismiss(p_room uuid, p_id uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.participant_insights SET dismissed = true
  WHERE id = p_id AND room_id = p_room
    AND public.room_can_read(p_room)
    AND (public.is_live_room(p_room) OR public.room_member_access(p_room))
$$;