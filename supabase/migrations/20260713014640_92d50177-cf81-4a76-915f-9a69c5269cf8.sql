
ALTER TABLE public.canvas_events
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS transcript_span jsonb,
  ADD COLUMN IF NOT EXISTS confidence real,
  ADD COLUMN IF NOT EXISTS thread_id text;

CREATE INDEX IF NOT EXISTS canvas_events_thread_id_idx ON public.canvas_events(thread_id);
CREATE INDEX IF NOT EXISTS canvas_events_source_idx ON public.canvas_events(source);
