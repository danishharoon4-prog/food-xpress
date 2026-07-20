ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS police_verification_url TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;