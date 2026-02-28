-- =====================================================
-- Migration: Add missing columns to user_credits
-- Date: 2026-02-28
-- The add_credits / consume_credits RPC functions reference
-- columns that were never added to the original table.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_credits' AND column_name='bonus_balance') THEN
    ALTER TABLE public.user_credits ADD COLUMN bonus_balance INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_credits' AND column_name='total_earned') THEN
    ALTER TABLE public.user_credits ADD COLUMN total_earned INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_credits' AND column_name='total_spent') THEN
    ALTER TABLE public.user_credits ADD COLUMN total_spent INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_credits' AND column_name='last_purchase_at') THEN
    ALTER TABLE public.user_credits ADD COLUMN last_purchase_at TIMESTAMPTZ;
  END IF;
END $$;

-- Backfill total_earned from existing balance where possible
UPDATE public.user_credits
SET total_earned = COALESCE(balance, 0)
WHERE total_earned = 0 AND COALESCE(balance, 0) > 0;
