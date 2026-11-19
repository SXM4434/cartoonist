CREATE TABLE public.room_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  query text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  snippet text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  shape_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.room_references TO service_role;
ALTER TABLE public.room_references ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX room_references_room_url ON public.room_references(room_id, url);
CREATE INDEX room_references_room_created ON public.room_references(room_id, created_at DESC);

CREATE FUNCTION public.reference_list(p_room uuid)
RETURNS SETOF public.room_references
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.room_references
  WHERE room_id = p_room
    AND EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room)
  ORDER BY created_at DESC
  LIMIT 50
$$;

CREATE FUNCTION public.reference_save(
  p_room uuid,
  p_query text,
  p_title text,
  p_url text,
  p_snippet text,
  p_source text,
  p_shape_id text
)
RETURNS SETOF public.room_references
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room) THEN
    RAISE EXCEPTION 'Unknown room';
  END IF;
  IF length(trim(p_title)) < 1 OR length(trim(p_url)) < 8 THEN
    RAISE EXCEPTION 'A title and URL are required';
  END IF;
  RETURN QUERY
  INSERT INTO public.room_references (room_id, query, title, url, snippet, source, shape_id)
  VALUES (
    p_room,
    left(trim(p_query), 300),
    left(trim(p_title), 200),
    left(trim(p_url), 500),
    left(coalesce(p_snippet, ''), 600),
    left(coalesce(p_source, ''), 120),
    nullif(trim(coalesce(p_shape_id, '')), '')
  )
  ON CONFLICT (room_id, url) DO UPDATE SET
    title = excluded.title,
    snippet = excluded.snippet,
    source = excluded.source,
    shape_id = coalesce(excluded.shape_id, public.room_references.shape_id),
    query = excluded.query
  RETURNING *;
END
$$;

REVOKE ALL ON FUNCTION public.reference_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reference_save(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reference_list(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reference_save(uuid, text, text, text, text, text, text) TO anon, authenticated;