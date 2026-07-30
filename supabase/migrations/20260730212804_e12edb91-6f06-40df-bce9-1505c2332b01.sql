CREATE TABLE public.participant_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pattern',
  text TEXT NOT NULL,
  source_quote TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX participant_insights_room_idx ON public.participant_insights (room_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.participant_insights TO anon, authenticated;
GRANT ALL ON public.participant_insights TO service_role;

ALTER TABLE public.participant_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights read" ON public.participant_insights FOR SELECT USING (true);
CREATE POLICY "insights insert" ON public.participant_insights FOR INSERT WITH CHECK (true);
CREATE POLICY "insights update" ON public.participant_insights FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "insights delete" ON public.participant_insights FOR DELETE USING (true);