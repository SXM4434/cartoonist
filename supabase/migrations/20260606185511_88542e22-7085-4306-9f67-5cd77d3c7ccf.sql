-- Auto-generate join_code on insert
CREATE OR REPLACE FUNCTION public.gen_join_code() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  code text;
  tries int := 0;
BEGIN
  LOOP
    code := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=lIO01', 'ABCDEFGH'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE join_code = code);
    tries := tries + 1;
    IF tries > 10 THEN EXIT; END IF;
  END LOOP;
  RETURN code;
END $$;

ALTER TABLE public.rooms ALTER COLUMN join_code SET DEFAULT public.gen_join_code();
UPDATE public.rooms SET join_code = public.gen_join_code() WHERE join_code IS NULL OR join_code = '';
CREATE UNIQUE INDEX IF NOT EXISTS rooms_join_code_idx ON public.rooms(join_code);