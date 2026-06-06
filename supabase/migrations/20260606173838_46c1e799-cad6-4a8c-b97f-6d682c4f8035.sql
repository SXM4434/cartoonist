
-- ROOMS
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled meeting',
  host_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms read all" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms insert all" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms update all" ON public.rooms FOR UPDATE USING (true) WITH CHECK (true);

-- PARTICIPANTS
CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL,
  role text,
  personality text,
  color text,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO anon, authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants all" ON public.participants FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX participants_room_idx ON public.participants(room_id);

-- TRANSCRIPT CHUNKS
CREATE TABLE public.transcript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  text text NOT NULL,
  t_offset_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transcript_chunks TO anon, authenticated;
GRANT ALL ON public.transcript_chunks TO service_role;
ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transcript all read" ON public.transcript_chunks FOR SELECT USING (true);
CREATE POLICY "transcript all insert" ON public.transcript_chunks FOR INSERT WITH CHECK (true);
CREATE INDEX transcript_room_idx ON public.transcript_chunks(room_id, created_at);

-- CANVAS EVENTS (for scrub replay)
CREATE TABLE public.canvas_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  op jsonb NOT NULL,
  t_offset_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.canvas_events TO anon, authenticated;
GRANT ALL ON public.canvas_events TO service_role;
ALTER TABLE public.canvas_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canvas read" ON public.canvas_events FOR SELECT USING (true);
CREATE POLICY "canvas insert" ON public.canvas_events FOR INSERT WITH CHECK (true);
CREATE INDEX canvas_events_room_idx ON public.canvas_events(room_id, created_at);

-- AUDIO CLIPS
CREATE TABLE public.audio_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audio_clips TO anon, authenticated;
GRANT ALL ON public.audio_clips TO service_role;
ALTER TABLE public.audio_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audio read" ON public.audio_clips FOR SELECT USING (true);
CREATE POLICY "audio insert" ON public.audio_clips FOR INSERT WITH CHECK (true);
