CREATE TABLE public.speaker_map (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL,
  cluster_label text NOT NULL,
  participant_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (room_id, cluster_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaker_map TO anon, authenticated;
GRANT ALL ON public.speaker_map TO service_role;

ALTER TABLE public.speaker_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speaker_map read all" ON public.speaker_map FOR SELECT USING (true);
CREATE POLICY "speaker_map insert all" ON public.speaker_map FOR INSERT WITH CHECK (true);
CREATE POLICY "speaker_map update all" ON public.speaker_map FOR UPDATE USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.speaker_map;