CREATE TABLE public.canvas_relations (
  id uuid primary key default gen_random_uuid(),
  from_room_id uuid not null references public.rooms(id) on delete cascade,
  from_thread_id text not null,
  to_room_id uuid not null references public.rooms(id) on delete cascade,
  to_thread_id text not null,
  relation text not null default 'references',
  confidence numeric not null default 0.5,
  reason text,
  created_at timestamptz not null default now()
);
CREATE INDEX canvas_relations_from_idx ON public.canvas_relations (from_room_id, created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canvas_relations TO authenticated;
GRANT SELECT, INSERT ON public.canvas_relations TO anon;
GRANT ALL ON public.canvas_relations TO service_role;
ALTER TABLE public.canvas_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canvas_relations readable" ON public.canvas_relations FOR SELECT USING (true);
CREATE POLICY "canvas_relations insertable" ON public.canvas_relations FOR INSERT WITH CHECK (true);