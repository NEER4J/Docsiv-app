-- Onboarding preferences on users (team size, doc types, hear about us)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS preferred_doc_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hear_about_us text;

COMMENT ON COLUMN public.users.team_size IS 'Onboarding: team size (solo, 2-5, 6-20, 20+)';
COMMENT ON COLUMN public.users.preferred_doc_types IS 'Onboarding: selected doc type ids as JSON array';
COMMENT ON COLUMN public.users.hear_about_us IS 'Onboarding: where they heard about us';
