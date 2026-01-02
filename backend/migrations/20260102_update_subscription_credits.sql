-- =====================================================
-- MIGRATION: Mise à jour des crédits mensuels des abonnements
-- Date: 2026-01-02
-- Description: Augmentation des crédits Premium (200→300) et Pro (600→1000)
-- =====================================================

-- Ajouter la colonne monthly_credits si elle n'existe pas
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS monthly_credits INTEGER DEFAULT 0;

-- Mettre à jour les crédits pour chaque plan
-- Freemium: 0 crédits (gratuit)
UPDATE subscription_plans
SET monthly_credits = 0,
    features = jsonb_set(
      COALESCE(features, '[]'::jsonb),
      '{0}',
      '"0 crédits / mois"'
    ),
    updated_at = NOW()
WHERE slug = 'free';

-- Premium (Discovery): 300 crédits/mois (ancien: 200)
UPDATE subscription_plans
SET monthly_credits = 300,
    features = '["Tout du plan Freemium", "300 crédits / mois", "Accès chaîne WhatsApp Gabon Insight", "Générateur de Business Plan IA", "Formation & Quiz sur mesure"]'::jsonb,
    updated_at = NOW()
WHERE slug IN ('premium', 'discovery');

-- Professionnel (Pro): 1000 crédits/mois (ancien: 600)
UPDATE subscription_plans
SET monthly_credits = 1000,
    features = '["Tout du plan Premium", "1 000 crédits / mois (Best Value)", "Déblocage complet Outils (Audio, Veille, Actu+)", "Accès Publicités & Sondages", "Réception WhatsApp des veilles et Alerte", "Analyse d''Opportunités de marché", "Support prioritaire"]'::jsonb,
    updated_at = NOW()
WHERE slug = 'pro';

-- Créer un index pour optimiser les requêtes sur monthly_credits
CREATE INDEX IF NOT EXISTS idx_subscription_plans_credits ON subscription_plans(monthly_credits);

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON COLUMN subscription_plans.monthly_credits IS 'Nombre de crédits IA offerts par mois avec cet abonnement';
