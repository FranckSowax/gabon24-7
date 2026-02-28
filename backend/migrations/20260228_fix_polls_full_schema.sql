-- =====================================================
-- Migration: Ensure polls table has all required columns
-- for generate-daily-poll, poll-publisher, and frontend
-- Date: 2026-02-28
-- =====================================================

-- Add missing columns to polls table (idempotent)
DO $$
BEGIN
  -- question TEXT (used as poll title/question display)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='question') THEN
    ALTER TABLE public.polls ADD COLUMN question TEXT;
  END IF;

  -- poll_type TEXT (series, yes_no, mcq)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='poll_type') THEN
    ALTER TABLE public.polls ADD COLUMN poll_type TEXT DEFAULT 'mcq';
  END IF;

  -- options JSONB (array of option strings for mcq)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='options') THEN
    ALTER TABLE public.polls ADD COLUMN options JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- expires_at TIMESTAMPTZ
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='expires_at') THEN
    ALTER TABLE public.polls ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;

  -- status TEXT (draft, published, expired)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='status') THEN
    ALTER TABLE public.polls ADD COLUMN status TEXT DEFAULT 'draft';
  END IF;

  -- scheduled_publish_at TIMESTAMPTZ
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='scheduled_publish_at') THEN
    ALTER TABLE public.polls ADD COLUMN scheduled_publish_at TIMESTAMPTZ;
  END IF;

  -- published_at TIMESTAMPTZ
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='published_at') THEN
    ALTER TABLE public.polls ADD COLUMN published_at TIMESTAMPTZ;
  END IF;

  -- is_manual BOOLEAN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='is_manual') THEN
    ALTER TABLE public.polls ADD COLUMN is_manual BOOLEAN DEFAULT false;
  END IF;

  -- total_votes INTEGER
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='polls' AND column_name='total_votes') THEN
    ALTER TABLE public.polls ADD COLUMN total_votes INTEGER DEFAULT 0;
  END IF;
END $$;

-- Normalize existing status values before adding constraint
UPDATE public.polls SET status = 'expired'
  WHERE status IS NOT NULL AND status NOT IN ('draft', 'published', 'expired');
UPDATE public.polls SET status = 'draft'
  WHERE status IS NULL;

-- Add/update status check constraint (drop old one if exists)
ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_status_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_status_check
  CHECK (status IN ('draft', 'published', 'expired'));

-- Add options column to poll_questions if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='poll_questions' AND column_name='options') THEN
    ALTER TABLE public.poll_questions ADD COLUMN options JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_polls_status ON public.polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_scheduled_publish ON public.polls(scheduled_publish_at);
CREATE INDEX IF NOT EXISTS idx_polls_is_active ON public.polls(is_active);

-- Allow service_role to manage polls
DROP POLICY IF EXISTS "Service role full access on polls" ON public.polls;
CREATE POLICY "Service role full access on polls"
  ON public.polls FOR ALL
  USING (auth.role() = 'service_role');
