ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS strengths text[],
  ADD COLUMN IF NOT EXISTS contribution_modes text[],
  ADD COLUMN IF NOT EXISTS feedback_style text
    CHECK (feedback_style IS NULL OR feedback_style IN ('direct','gentle','ask-first','written-only')),
  ADD COLUMN IF NOT EXISTS role_today text,
  ADD COLUMN IF NOT EXISTS blockers text,
  ADD COLUMN IF NOT EXISTS needs_today text,
  ADD COLUMN IF NOT EXISTS can_help_with text,
  ADD COLUMN IF NOT EXISTS share_blockers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_layer_complete boolean NOT NULL DEFAULT false;