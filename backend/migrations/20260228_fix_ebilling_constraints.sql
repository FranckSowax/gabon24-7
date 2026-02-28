-- =====================================================
-- Migration: Fix ebilling_payments constraints
-- 1. Extend reference column from VARCHAR(20) to VARCHAR(50)
-- 2. Add 'veille_subscription' to valid_payment_type constraint
-- Date: 2026-02-28
-- =====================================================

-- 1. Extend reference column
ALTER TABLE ebilling_payments
  ALTER COLUMN reference TYPE VARCHAR(50);

-- 2. Drop and recreate payment_type constraint to include veille_subscription
ALTER TABLE ebilling_payments
  DROP CONSTRAINT IF EXISTS valid_payment_type;

ALTER TABLE ebilling_payments
  ADD CONSTRAINT valid_payment_type
  CHECK (payment_type IN ('credits', 'subscription', 'quiz', 'campaign', 'veille_subscription'));
