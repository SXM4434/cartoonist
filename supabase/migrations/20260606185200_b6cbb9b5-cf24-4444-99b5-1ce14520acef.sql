ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS goal text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS facilitation text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS host_role text;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;