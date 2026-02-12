-- =====================================================
-- Migration: E-Billing Payment System (DriveBy Africa)
-- Remplace le système PVIT par E-Billing (billing-easy.com)
-- Date: 2026-02-12
-- =====================================================

-- 1. Table principale des paiements E-Billing
CREATE TABLE IF NOT EXISTS ebilling_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference VARCHAR(20) NOT NULL UNIQUE,
  bill_id VARCHAR(255),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payment_type VARCHAR(50) NOT NULL,
  -- Crédits
  package_id UUID,
  credits_to_add INTEGER DEFAULT 0,
  bonus_credits INTEGER DEFAULT 0,
  -- Abonnement
  plan_slug VARCHAR(100),
  plan_duration INTEGER,
  -- Quiz
  quiz_id UUID,
  -- Campagnes
  campaign_ids UUID[],
  -- Réponses E-Billing
  ebilling_response JSONB,
  ebilling_status_data JSONB,
  callback_data JSONB,
  metadata JSONB,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_payment_type CHECK (payment_type IN ('credits', 'subscription', 'quiz', 'campaign')),
  CONSTRAINT positive_amount CHECK (amount >= 100)
);

-- 2. Table de logs des callbacks E-Billing
CREATE TABLE IF NOT EXISTS ebilling_callback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id VARCHAR(255),
  reference VARCHAR(255),
  status VARCHAR(50),
  raw_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index pour performance
CREATE INDEX IF NOT EXISTS idx_ebilling_payments_user_id ON ebilling_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_ebilling_payments_reference ON ebilling_payments(reference);
CREATE INDEX IF NOT EXISTS idx_ebilling_payments_bill_id ON ebilling_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_ebilling_payments_status ON ebilling_payments(status);
CREATE INDEX IF NOT EXISTS idx_ebilling_payments_created_at ON ebilling_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebilling_callback_logs_bill_id ON ebilling_callback_logs(bill_id);
CREATE INDEX IF NOT EXISTS idx_ebilling_callback_logs_reference ON ebilling_callback_logs(reference);

-- 4. RLS (Row Level Security)
ALTER TABLE ebilling_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebilling_callback_logs ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour ebilling_payments
CREATE POLICY "Users can view own payments"
  ON ebilling_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on ebilling_payments"
  ON ebilling_payments FOR ALL
  USING (auth.role() = 'service_role');

-- Politiques RLS pour ebilling_callback_logs (service_role seulement)
CREATE POLICY "Service role full access on ebilling_callback_logs"
  ON ebilling_callback_logs FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Fonction de mise à jour automatique updated_at
CREATE OR REPLACE FUNCTION update_ebilling_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ebilling_payments_updated_at
  BEFORE UPDATE ON ebilling_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_ebilling_payments_updated_at();
