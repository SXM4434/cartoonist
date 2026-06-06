
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS input_mode text NOT NULL DEFAULT 'voice'
    CHECK (input_mode IN ('voice','chat','both')),
  ADD COLUMN IF NOT EXISTS linked_participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL;

ALTER TABLE public.transcript_chunks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'voice'
    CHECK (source IN ('voice','chat'));

CREATE INDEX IF NOT EXISTS participants_room_name_idx
  ON public.participants (room_id, lower(trim(display_name)));

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transcript_chunks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
