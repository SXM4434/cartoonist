-- Run after all migrations with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/room_access.sql
-- This script rolls back every fixture. It needs a local Postgres with Supabase roles.
BEGIN;

INSERT INTO public.teams(id, name, created_by) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Access test team', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Other team', '20000000-0000-4000-8000-000000000003');
INSERT INTO public.team_members(team_id, user_id, role) VALUES
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'member'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'owner');
INSERT INTO public.workspaces(id, team_id, name) VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Studio'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Other studio');
INSERT INTO public.team_invites(team_id, token, created_by) VALUES
  ('10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
INSERT INTO public.rooms(id, name, workspace_id, host_id, ended_at) VALUES
  ('40000000-0000-4000-8000-000000000001', 'Live invited room', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', NULL),
  ('40000000-0000-4000-8000-000000000002', 'Ended team room', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', now()),
  ('40000000-0000-4000-8000-000000000003', 'Ended private room', NULL, NULL, now()),
  ('40000000-0000-4000-8000-000000000004', 'Other team room', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', now());
INSERT INTO public.canvas_events(room_id, op, thread_id, transcript_span) VALUES
  ('40000000-0000-4000-8000-000000000002', '{}', 'thread-a', '{"latest":"A prior team decision"}'),
  ('40000000-0000-4000-8000-000000000004', '{}', 'thread-b', '{"latest":"Another team decision"}');
INSERT INTO public.room_recall(room_id, question, answer) VALUES
  ('40000000-0000-4000-8000-000000000002', 'Prior question', 'Team answer'),
  ('40000000-0000-4000-8000-000000000003', 'Private question', 'Private answer');
INSERT INTO public.canvas_relations(from_room_id, from_thread_id, to_room_id, to_thread_id) VALUES
  ('40000000-0000-4000-8000-000000000002', 'thread-a', '40000000-0000-4000-8000-000000000004', 'thread-b');
INSERT INTO storage.buckets(id, name, public) VALUES ('voice-samples', 'voice-samples', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.objects(id, bucket_id, name, owner_id) VALUES
  ('60000000-0000-4000-8000-000000000001', 'voice-samples', '20000000-0000-4000-8000-000000000001/test.webm', '20000000-0000-4000-8000-000000000001');

SET LOCAL ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.room_get('40000000-0000-4000-8000-000000000001')) <> 1 THEN RAISE EXCEPTION 'live guest room link failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_get('40000000-0000-4000-8000-000000000002')) THEN RAISE EXCEPTION 'ended team room leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_get('40000000-0000-4000-8000-000000000003')) THEN RAISE EXCEPTION 'ended private room leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.rooms_by_ids(ARRAY['40000000-0000-4000-8000-000000000002']::uuid[])) THEN RAISE EXCEPTION 'room list leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.recall_list('40000000-0000-4000-8000-000000000002')) THEN RAISE EXCEPTION 'Recall leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.canvas_events_for_room('40000000-0000-4000-8000-000000000002')) THEN RAISE EXCEPTION 'canvas history leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.session_stats(ARRAY['40000000-0000-4000-8000-000000000002']::uuid[])) THEN RAISE EXCEPTION 'session counts leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.canvas_events WHERE room_id = '40000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'ended table rows leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.memory_index(ARRAY['40000000-0000-4000-8000-000000000002']::uuid[], NULL)) THEN RAISE EXCEPTION 'memory leaked'; END IF;
  IF EXISTS (SELECT 1 FROM public.relations_list('40000000-0000-4000-8000-000000000002')) THEN RAISE EXCEPTION 'relations leaked'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE id = '60000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'guest read voice recording'; END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.room_get('40000000-0000-4000-8000-000000000002')) <> 1 THEN RAISE EXCEPTION 'member history failed'; END IF;
  IF (SELECT count(*) FROM public.recall_list('40000000-0000-4000-8000-000000000002')) <> 1 THEN RAISE EXCEPTION 'member Recall failed'; END IF;
  IF (SELECT count(*) FROM public.memory_index(ARRAY['40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004']::uuid[], '40000000-0000-4000-8000-000000000001')) <> 1 THEN RAISE EXCEPTION 'workspace memory boundary failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_get('40000000-0000-4000-8000-000000000004')) THEN RAISE EXCEPTION 'other workspace leaked'; END IF;
  BEGIN
    PERFORM public.team_invite_create('10000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'member created invitation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'member created invitation' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.team_member_remove('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'member removed owner';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'member removed owner' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE invite_token uuid; BEGIN
  invite_token := public.team_invite_create('10000000-0000-4000-8000-000000000001');
  IF invite_token IS NULL THEN RAISE EXCEPTION 'owner invitation failed'; END IF;
  IF (SELECT count(*) FROM public.workspace_rooms()) <> 2 THEN RAISE EXCEPTION 'workspace room listing failed'; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE id = '60000000-0000-4000-8000-000000000001') <> 1 THEN RAISE EXCEPTION 'owner cannot read voice recording'; END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.team_invite_accept('50000000-0000-4000-8000-000000000001')
     <> '10000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'invitation acceptance failed'; END IF;
  IF (SELECT count(*) FROM public.workspace_rooms()) <> 2 THEN RAISE EXCEPTION 'new member cannot see rooms'; END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT public.team_member_remove('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000004', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.workspace_rooms()) THEN RAISE EXCEPTION 'non-member saw workspace rooms'; END IF;
  IF EXISTS (SELECT 1 FROM public.recall_list('40000000-0000-4000-8000-000000000002')) THEN RAISE EXCEPTION 'non-member saw Recall'; END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE id = '60000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'other account read voice recording'; END IF;
  BEGIN
    PERFORM public.workspace_create_room('30000000-0000-4000-8000-000000000001', 'Wrong team', '', '{}', '', '', '', '');
    RAISE EXCEPTION 'non-member created team room';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'non-member created team room' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'voice samples read' AND 'anon' = ANY(roles)
  ) THEN RAISE EXCEPTION 'anonymous voice recording read is open'; END IF;
END $$;
ROLLBACK;
