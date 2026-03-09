-- =====================================================
-- Migration: Fix CHECK constraints blocking AI tracking
-- Date: 2026-03-08
--
-- Problem 1: credit_transactions_type_check rejects 'consumption'
-- Problem 2: opportunity_analyses_status_check rejects 'done'
--
-- Solution: Drop old constraints and recreate with correct values
-- =====================================================

-- 1. Fix credit_transactions type CHECK
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('purchase', 'subscription', 'bonus', 'consumption', 'refund', 'expiry', 'admin'));

-- 2. Fix opportunity_analyses status CHECK
ALTER TABLE public.opportunity_analyses
  DROP CONSTRAINT IF EXISTS opportunity_analyses_status_check;

ALTER TABLE public.opportunity_analyses
  ADD CONSTRAINT opportunity_analyses_status_check
  CHECK (status IN ('pending', 'processing', 'done', 'completed', 'failed', 'error'));
