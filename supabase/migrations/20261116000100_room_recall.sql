CREATE TABLE IF NOT EXISTS public.room_recall (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES public.rooms(id), question text NOT NULL, answer text NOT NULL, quotes jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.room_recall TO service_role;
ALTER TABLE public.room_recall ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.recall_list(p_room uuid) RETURNS SETOF public.room_recall LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT * FROM public.room_recall WHERE room_id=p_room AND EXISTS(SELECT 1 FROM public.rooms WHERE id=p_room) ORDER BY created_at DESC LIMIT 50 $$;
REVOKE ALL ON FUNCTION public.recall_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recall_list(uuid) TO anon, authenticated;
CREATE INDEX IF NOT EXISTS room_recall_room_created ON public.room_recall(room_id,created_at DESC);
