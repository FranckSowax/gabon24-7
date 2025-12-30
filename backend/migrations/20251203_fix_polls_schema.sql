-- Migration: Fix Polls Schema for Anonymous Voting
-- Date: 2025-12-03
-- Description: Creates missing tables and adjusts user_id type for fingerprint support

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table polls
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    category TEXT,
    source TEXT,
    audio_summary_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table poll_questions
CREATE TABLE IF NOT EXISTS public.poll_questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    question_text TEXT,
    question_type TEXT DEFAULT 'multiple_choice',
    question_order INT DEFAULT 0,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table poll_options
CREATE TABLE IF NOT EXISTS public.poll_options (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question_id UUID REFERENCES public.poll_questions(id) ON DELETE CASCADE,
    option_text TEXT,
    option_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table poll_votes (Corrected for anonymous fingerprints)
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT, -- Changed from UUID to TEXT to support Fingerprints
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.poll_questions(id) ON DELETE CASCADE,
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Alter existing table if needed (idempotent logic)
DO $$ 
BEGIN
    -- Drop foreign key if it exists (from legacy schema)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'poll_votes_user_id_fkey') THEN
        ALTER TABLE public.poll_votes DROP CONSTRAINT poll_votes_user_id_fkey;
    END IF;

    -- Change column type to TEXT if it's UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'poll_votes' AND column_name = 'user_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.poll_votes ALTER COLUMN user_id TYPE TEXT;
    END IF;
END $$;

-- 7. RLS Policies
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Policies (Drop and Recreate to ensure correctness)
DROP POLICY IF EXISTS "Public polls are viewable by everyone" ON public.polls;
CREATE POLICY "Public polls are viewable by everyone" ON public.polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public questions are viewable by everyone" ON public.poll_questions;
CREATE POLICY "Public questions are viewable by everyone" ON public.poll_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public options are viewable by everyone" ON public.poll_options;
CREATE POLICY "Public options are viewable by everyone" ON public.poll_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own votes" ON public.poll_votes; -- Old policy
DROP POLICY IF EXISTS "Anyone can vote" ON public.poll_votes; -- New policy
CREATE POLICY "Anyone can vote" ON public.poll_votes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view votes" ON public.poll_votes;
CREATE POLICY "Public can view votes" ON public.poll_votes FOR SELECT USING (true);
