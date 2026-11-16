create table if not exists public.session_summaries (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  summary text not null default '',
  topics text[] not null default '{}',
  decisions text[] not null default '{}',
  open_questions text[] not null default '{}',
  entities text[] not null default '{}',
  chars_covered integer not null default 0,
  updated_at timestamptz not null default now()
);

grant select on public.session_summaries to anon, authenticated;
grant all on public.session_summaries to service_role;

alter table public.session_summaries enable row level security;

drop policy if exists "session summaries read live" on public.session_summaries;
create policy "session summaries read live" on public.session_summaries
  for select using (public.is_live_room(room_id));