-- =====================================================
-- Migration: Subscription lifecycle improvements
-- Date: 2026-02-28
-- - Add credits_granted flag to prevent double credit grants
-- - Add indexes for subscription expiry queries
-- - Add reminder tracking columns
-- =====================================================

-- 1. Add credits_granted flag to ebilling_payments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ebilling_payments' AND column_name='credits_granted') THEN
    ALTER TABLE public.ebilling_payments ADD COLUMN credits_granted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Add reminder tracking to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name='reminder_7d_sent') THEN
    ALTER TABLE public.subscriptions ADD COLUMN reminder_7d_sent BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name='reminder_1d_sent') THEN
    ALTER TABLE public.subscriptions ADD COLUMN reminder_1d_sent BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscriptions' AND column_name='expired_notified') THEN
    ALTER TABLE public.subscriptions ADD COLUMN expired_notified BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 3. Indexes for lifecycle queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expiry
  ON public.subscriptions(current_period_end)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_ebilling_credits_granted
  ON public.ebilling_payments(credits_granted)
  WHERE credits_granted = false AND status = 'completed';

-- 4. Service role full access on subscriptions
DROP POLICY IF EXISTS "Service role full access on subscriptions" ON public.subscriptions;
CREATE POLICY "Service role full access on subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');
