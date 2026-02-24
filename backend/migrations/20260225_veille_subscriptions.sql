-- =====================================================
-- Migration: Veille & Alertes - Subscription System
-- Service independant avec abonnement Particulier/Entreprise
-- Date: 2026-02-25
-- =====================================================

-- 1. Table des plans Veille
CREATE TABLE IF NOT EXISTS veille_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL,
  price_yearly INTEGER,
  max_alerts INTEGER NOT NULL DEFAULT 5,
  max_keywords_per_alert INTEGER NOT NULL DEFAULT 3,
  max_whatsapp_numbers INTEGER NOT NULL DEFAULT 1,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed plans
INSERT INTO veille_plans (slug, name, description, price_monthly, max_alerts, max_keywords_per_alert, max_whatsapp_numbers, features, sort_order)
VALUES
  ('particulier', 'Particulier', 'Veille personnalisee pour individus', 2000, 5, 3, 1,
   '["5 alertes actives", "3 mots-cles par alerte", "1 numero WhatsApp", "Notifications carrousel WhatsApp", "Surveillance horaire 7h-22h"]'::jsonb, 1),
  ('entreprise', 'Entreprise', 'Veille complete pour organisations', 15000, -1, -1, 10,
   '["Alertes illimitees", "Mots-cles illimites", "Jusqu''a 10 numeros WhatsApp", "Notifications carrousel WhatsApp", "Surveillance horaire 7h-22h", "Rapport hebdomadaire PDF", "Support prioritaire"]'::jsonb, 2)
ON CONFLICT (slug) DO NOTHING;

-- 2. Table des abonnements Veille
CREATE TABLE IF NOT EXISTS veille_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES veille_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  whatsapp_number VARCHAR(20) NOT NULL,
  payment_method VARCHAR(50),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_veille_status CHECK (status IN ('active', 'trial', 'expired', 'cancelled'))
);

-- Index
CREATE INDEX IF NOT EXISTS idx_veille_subscriptions_user_id ON veille_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_veille_subscriptions_status ON veille_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_veille_subscriptions_period_end ON veille_subscriptions(current_period_end);

-- 3. Table des demos/trials 24h
CREATE TABLE IF NOT EXISTS veille_demo_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number VARCHAR(20) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  trial_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  is_expired BOOLEAN DEFAULT false,
  converted_to_subscription BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un seul trial par numero WhatsApp
CREATE UNIQUE INDEX IF NOT EXISTS idx_veille_demo_whatsapp ON veille_demo_trials(whatsapp_number);

-- 4. Etendre ebilling_payments pour supporter veille_subscription
ALTER TABLE ebilling_payments DROP CONSTRAINT IF EXISTS valid_payment_type;
ALTER TABLE ebilling_payments ADD CONSTRAINT valid_payment_type
  CHECK (payment_type IN ('credits', 'subscription', 'quiz', 'campaign', 'veille_subscription'));

ALTER TABLE ebilling_payments ADD COLUMN IF NOT EXISTS veille_plan_slug VARCHAR(50);
ALTER TABLE ebilling_payments ADD COLUMN IF NOT EXISTS veille_whatsapp_number VARCHAR(20);

-- 5. RLS
ALTER TABLE veille_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_demo_trials ENABLE ROW LEVEL SECURITY;

-- Plans: lecture publique
CREATE POLICY "Anyone can view active veille plans"
  ON veille_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role full access on veille_plans"
  ON veille_plans FOR ALL
  USING (auth.role() = 'service_role');

-- Subscriptions: user voit les siens, service_role full access
CREATE POLICY "Users can view own veille subscriptions"
  ON veille_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on veille_subscriptions"
  ON veille_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Demo trials: service_role seulement
CREATE POLICY "Service role full access on veille_demo_trials"
  ON veille_demo_trials FOR ALL
  USING (auth.role() = 'service_role');
