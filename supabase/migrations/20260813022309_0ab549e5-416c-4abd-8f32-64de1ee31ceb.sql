-- ============ helpers ============
create or replace function public.is_live_room(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room
      and r.ended_at is null
      and r.created_at > now() - interval '24 hours'
  )
$$;

-- ============ rooms: no enumeration ============
drop policy if exists "rooms read all" on public.rooms;
drop policy if exists "rooms insert all" on public.rooms;
revoke all on public.rooms from anon, authenticated;
grant all on public.rooms to service_role;

create or replace function public.room_create(
  p_name text, p_goal text, p_outputs text[], p_facilitation text,
  p_host_role text, p_mode text, p_session_type text)
returns table (id uuid, join_code text, name text)
language plpgsql volatile security definer set search_path = public as $$
begin
  return query
  insert into public.rooms (name, goal, outputs, facilitation, host_role, mode, session_type)
  values (left(coalesce(nullif(trim(p_name), ''), 'Untitled meeting'), 200),
          left(coalesce(p_goal, ''), 2000), p_outputs, p_facilitation,
          left(coalesce(p_host_role, ''), 200), p_mode, p_session_type)
  returning rooms.id, rooms.join_code, rooms.name;
end $$;

create or replace function public.room_by_code(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select r.id from public.rooms r
  where p_code is not null and length(trim(p_code)) between 4 and 12
    and upper(r.join_code) = upper(trim(p_code))
  limit 1
$$;

create or replace function public.room_get(p_id uuid)
returns table (id uuid, name text, goal text, outputs text[], facilitation text,
               host_role text, join_code text, ended_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.goal, r.outputs, r.facilitation, r.host_role, r.join_code, r.ended_at
  from public.rooms r where r.id = p_id
$$;

create or replace function public.rooms_by_ids(p_ids uuid[])
returns table (id uuid, name text, goal text, ended_at timestamptz, join_code text)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.goal, r.ended_at, r.join_code
  from public.rooms r
  where r.id = any(coalesce(p_ids, '{}')::uuid[])
    and coalesce(array_length(p_ids, 1), 0) <= 200
$$;

-- ============ live-room scoping on session tables ============
drop policy if exists "participants all" on public.participants;
create policy "participants read live" on public.participants for select using (public.is_live_room(room_id));
create policy "participants insert live" on public.participants for insert with check (public.is_live_room(room_id));
create policy "participants update live" on public.participants for update using (public.is_live_room(room_id)) with check (public.is_live_room(room_id));

drop policy if exists "transcript all read" on public.transcript_chunks;
drop policy if exists "transcript all insert" on public.transcript_chunks;
create policy "transcript read live" on public.transcript_chunks for select using (public.is_live_room(room_id));
create policy "transcript insert live" on public.transcript_chunks for insert with check (public.is_live_room(room_id));

drop policy if exists "canvas read" on public.canvas_events;
drop policy if exists "canvas insert" on public.canvas_events;
create policy "canvas read live" on public.canvas_events for select using (public.is_live_room(room_id));
create policy "canvas insert live" on public.canvas_events for insert with check (public.is_live_room(room_id));

drop policy if exists "speaker_map read all" on public.speaker_map;
drop policy if exists "speaker_map insert all" on public.speaker_map;
drop policy if exists "speaker_map update all" on public.speaker_map;
create policy "speaker_map read live" on public.speaker_map for select using (public.is_live_room(room_id));
create policy "speaker_map insert live" on public.speaker_map for insert with check (public.is_live_room(room_id));
create policy "speaker_map update live" on public.speaker_map for update using (public.is_live_room(room_id)) with check (public.is_live_room(room_id));

drop policy if exists "ai_calls readable by anyone with room link" on public.ai_calls;
create policy "ai_calls read live" on public.ai_calls for select using (public.is_live_room(room_id));
revoke insert, update, delete on public.ai_calls from anon, authenticated;
grant all on public.ai_calls to service_role;

-- ============ tables anon must not touch directly ============
drop policy if exists "audio read" on public.audio_clips;
drop policy if exists "audio insert" on public.audio_clips;
revoke all on public.audio_clips from anon, authenticated;
grant all on public.audio_clips to service_role;

drop policy if exists "insights read" on public.participant_insights;
drop policy if exists "insights insert" on public.participant_insights;
drop policy if exists "insights update" on public.participant_insights;
drop policy if exists "insights delete" on public.participant_insights;
revoke all on public.participant_insights from anon, authenticated;
grant all on public.participant_insights to service_role;

drop policy if exists "canvas_relations readable" on public.canvas_relations;
drop policy if exists "canvas_relations insertable" on public.canvas_relations;
revoke all on public.canvas_relations from anon, authenticated;
grant all on public.canvas_relations to service_role;

-- ============ gated capability RPCs (caller must already know the room id) ============
create or replace function public.session_stats(p_ids uuid[])
returns table (room_id uuid, participants bigint, shapes bigint, messages bigint, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  with ids as (
    select unnest(coalesce(p_ids, '{}')::uuid[]) as id
    where coalesce(array_length(p_ids, 1), 0) <= 200
  )
  select i.id,
    (select count(*) from public.participants p where p.room_id = i.id),
    (select count(*) from public.canvas_events c where c.room_id = i.id),
    (select count(*) from public.transcript_chunks t where t.room_id = i.id),
    greatest(
      (select max(c.created_at) from public.canvas_events c where c.room_id = i.id),
      (select max(t.created_at) from public.transcript_chunks t where t.room_id = i.id)
    )
  from ids i
$$;

create or replace function public.canvas_events_for_room(p_room uuid, p_limit int default 2000)
returns table (op jsonb, source text, transcript_span jsonb, thread_id text, t_offset_ms int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.op, c.source, c.transcript_span, c.thread_id, c.t_offset_ms, c.created_at
  from public.canvas_events c
  where c.room_id = p_room
  order by c.created_at asc
  limit least(coalesce(p_limit, 2000), 4000)
$$;

create or replace function public.memory_index(p_room_ids uuid[], p_exclude uuid)
returns table (room_id uuid, room_name text, thread_id text, transcript_span jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.room_id, r.name, c.thread_id, c.transcript_span, c.created_at
  from public.canvas_events c
  join public.rooms r on r.id = c.room_id
  where c.room_id = any(coalesce(p_room_ids, '{}')::uuid[])
    and coalesce(array_length(p_room_ids, 1), 0) <= 200
    and (p_exclude is null or c.room_id <> p_exclude)
    and c.thread_id is not null
  order by c.created_at desc
  limit 1200
$$;

create or replace function public.relations_list(p_room uuid)
returns table (to_room_id uuid, to_thread_id text, relation text, confidence numeric, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select cr.to_room_id, cr.to_thread_id, cr.relation, cr.confidence, cr.reason, cr.created_at
  from public.canvas_relations cr
  where cr.from_room_id = p_room
  order by cr.created_at desc
  limit 20
$$;

create or replace function public.relation_add(
  p_from_room uuid, p_from_thread text, p_to_room uuid, p_to_thread text,
  p_relation text, p_confidence numeric, p_reason text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_live_room(p_from_room) then
    raise exception 'source session is not live';
  end if;
  insert into public.canvas_relations (from_room_id, from_thread_id, to_room_id, to_thread_id, relation, confidence, reason)
  values (p_from_room, left(p_from_thread, 120), p_to_room, left(p_to_thread, 120),
          coalesce(nullif(p_relation, ''), 'references'), least(greatest(coalesce(p_confidence, 0.5), 0), 1),
          left(coalesce(p_reason, ''), 2000));
end $$;

create or replace function public.insights_list(p_room uuid)
returns table (id uuid, subject_name text, kind text, text text, source_quote text, confidence numeric)
language sql stable security definer set search_path = public as $$
  select i.id, i.subject_name, i.kind, i.text, i.source_quote, i.confidence
  from public.participant_insights i
  where i.room_id = p_room and i.dismissed = false
  order by i.created_at desc
$$;

create or replace function public.insights_add(p_room uuid, p_rows jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_live_room(p_room) then
    raise exception 'session is not live';
  end if;
  insert into public.participant_insights (room_id, subject_name, kind, text, source_quote, confidence)
  select p_room,
         left(coalesce(e->>'subject_name', 'team'), 120),
         left(coalesce(e->>'kind', 'pattern'), 60),
         left(coalesce(e->>'text', ''), 1000),
         left(coalesce(e->>'source_quote', ''), 2000),
         least(greatest(coalesce((e->>'confidence')::numeric, 0.5), 0), 1)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) e
  where coalesce(e->>'text', '') <> ''
  limit 20;
end $$;

create or replace function public.insights_dismiss(p_room uuid, p_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update public.participant_insights set dismissed = true
  where id = p_id and room_id = p_room
$$;

revoke all on function public.is_live_room(uuid) from public;
grant execute on function public.is_live_room(uuid) to anon, authenticated, service_role;
grant execute on function public.room_create(text, text, text[], text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.room_by_code(text) to anon, authenticated, service_role;
grant execute on function public.room_get(uuid) to anon, authenticated, service_role;
grant execute on function public.rooms_by_ids(uuid[]) to anon, authenticated, service_role;
grant execute on function public.session_stats(uuid[]) to anon, authenticated, service_role;
grant execute on function public.canvas_events_for_room(uuid, int) to anon, authenticated, service_role;
grant execute on function public.memory_index(uuid[], uuid) to anon, authenticated, service_role;
grant execute on function public.relations_list(uuid) to anon, authenticated, service_role;
grant execute on function public.relation_add(uuid, text, uuid, text, text, numeric, text) to anon, authenticated, service_role;
grant execute on function public.insights_list(uuid) to anon, authenticated, service_role;
grant execute on function public.insights_add(uuid, jsonb) to anon, authenticated, service_role;
grant execute on function public.insights_dismiss(uuid, uuid) to anon, authenticated, service_role;