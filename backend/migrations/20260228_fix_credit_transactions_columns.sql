-- =====================================================
-- Migration: Add missing columns to credit_transactions
-- Date: 2026-02-28
-- The add_credits / consume_credits RPC functions reference
-- columns that were never added to the table definition.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='balance_after') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN balance_after INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='bonus_balance_after') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN bonus_balance_after INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='service_name') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN service_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='package_id') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN package_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='payment_method') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN payment_method TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='payment_reference') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN payment_reference TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='price_paid_xaf') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN price_paid_xaf INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_transactions' AND column_name='status') THEN
    ALTER TABLE public.credit_transactions ADD COLUMN status TEXT DEFAULT 'completed';
  END IF;
END $$;

-- Index for service_name queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_service ON public.credit_transactions(service_name);
