
-- Add session config + join code to rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS session_type TEXT,
  ADD COLUMN IF NOT EXISTS mode TEXT,
  ADD COLUMN IF NOT EXISTS outputs TEXT[];

-- Backfill join_codes for existing rows
UPDATE public.rooms SET join_code = UPPER(SUBSTRING(REPLACE(id::text,'-',''),1,6)) WHERE join_code IS NULL;

-- Index for join_code lookup
CREATE INDEX IF NOT EXISTS rooms_join_code_idx ON public.rooms(join_code);

-- Ensure anon/auth can read+insert rooms (already public app, no auth)
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
