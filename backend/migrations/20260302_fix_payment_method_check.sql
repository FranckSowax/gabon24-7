-- =====================================================
-- Migration: Fix payment_method CHECK constraint on credit_transactions
-- Date: 2026-03-02
-- The CHECK constraint blocks 'ebilling' payment method.
-- Drop it and re-create with all valid payment methods.
-- =====================================================

-- Drop the existing constraint (may have been added manually)
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_payment_method_check;

-- Re-create with all valid payment methods including 'ebilling'
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN (
    'ebilling', 'mobile_money', 'pvit', 'card', 'manual', 'system', 'subscription'
  ));
