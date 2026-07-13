
CREATE TABLE public.ai_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  stage TEXT NOT NULL DEFAULT 'renderer',
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_calls_room_id_idx ON public.ai_calls(room_id, created_at DESC);
GRANT SELECT ON public.ai_calls TO anon, authenticated;
GRANT ALL ON public.ai_calls TO service_role;
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_calls readable by anyone with room link"
  ON public.ai_calls FOR SELECT
  USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_calls;
