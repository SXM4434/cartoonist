ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS voice_sample_path text;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS voice_sample_transcript text;