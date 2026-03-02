-- =====================================================
-- Migration: Fix payment_method CHECK constraint on credit_transactions
-- Date: 2026-03-02
-- The CHECK constraint blocks 'ebilling' payment method.
-- Simply drop it — payment_method is a free-form TEXT column.
-- =====================================================

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_payment_method_check;
