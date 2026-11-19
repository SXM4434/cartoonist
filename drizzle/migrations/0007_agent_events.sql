-- A room event claims one agent job. Its result or failure survives reloads.
CREATE TABLE public.meeting_agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (length(event_key) BETWEEN 1 AND 240),
  agent text NOT NULL CHECK (agent IN ('scribe','historian','drafter','facilitator','advocate','librarian')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (room_id, event_key)
);
CREATE INDEX meeting_agent_events_room_idx ON public.meeting_agent_events(room_id, created_at DESC);
ALTER TABLE public.meeting_agent_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_agent_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_agent_events TO service_role;

CREATE FUNCTION public.agent_event_claim(p_room uuid, p_key text, p_agent text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.meeting_agent_events%ROWTYPE;
DECLARE v_claimed boolean := false;
BEGIN
  IF NOT public.is_live_room(p_room) THEN RAISE EXCEPTION 'Room is not live'; END IF;
  IF p_agent NOT IN ('scribe','historian','drafter','facilitator','advocate','librarian')
    OR length(p_key) NOT BETWEEN 1 AND 240 OR p_key NOT LIKE p_agent || ':%'
  THEN RAISE EXCEPTION 'Invalid agent event'; END IF;
  INSERT INTO public.meeting_agent_events(room_id,event_key,agent)
    VALUES (p_room,p_key,p_agent) ON CONFLICT (room_id,event_key) DO NOTHING
    RETURNING * INTO v_row;
  IF FOUND THEN v_claimed := true;
  ELSE SELECT * INTO v_row FROM public.meeting_agent_events WHERE room_id=p_room AND event_key=p_key;
  END IF;
  RETURN jsonb_build_object('claimed',v_claimed,'status',v_row.status,
    'result',v_row.result,'error',v_row.error,'token',CASE WHEN v_claimed THEN v_row.claim_token ELSE NULL END);
END $$;

CREATE FUNCTION public.agent_event_finish(p_room uuid, p_key text, p_token uuid, p_status text, p_result jsonb DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'Invalid event status'; END IF;
  UPDATE public.meeting_agent_events SET status=p_status, result=p_result,
    error=left(p_error,500), finished_at=now()
  WHERE room_id=p_room AND event_key=p_key AND claim_token=p_token AND status='running';
  RETURN FOUND;
END $$;

CREATE FUNCTION public.agent_events_list(p_room uuid)
RETURNS TABLE(agent text, event_key text, status text, result jsonb, error text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.agent,e.event_key,e.status,e.result,e.error,e.created_at
  FROM public.meeting_agent_events e
  WHERE e.room_id=p_room AND EXISTS (SELECT 1 FROM public.rooms r WHERE r.id=p_room)
  ORDER BY e.created_at DESC LIMIT 100
$$;
REVOKE ALL ON FUNCTION public.agent_event_claim(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_event_finish(uuid,text,uuid,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_events_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_event_claim(uuid,text,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.agent_event_finish(uuid,text,uuid,text,jsonb,text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.agent_events_list(uuid) TO anon,authenticated,service_role;