-- Migration: Corriger les prix des plans d'abonnement
-- Date: 2026-01-03
--
-- Prix officiels:
-- - Freemium: 0 FCFA
-- - Premium (discovery): 3 000 FCFA/mois, 30 000 FCFA/an
-- - Professionnel (pro): 12 000 FCFA/mois, 120 000 FCFA/an

-- 1. Mettre à jour le plan Freemium
UPDATE subscription_plans
SET
  price_monthly = 0,
  price_yearly = 0,
  monthly_credits = 0,
  updated_at = NOW()
WHERE slug IN ('free', 'freemium');

-- 2. Mettre à jour le plan Premium/Discovery
UPDATE subscription_plans
SET
  price_monthly = 3000,
  price_yearly = 30000,
  monthly_credits = 300,
  updated_at = NOW()
WHERE slug IN ('discovery', 'premium');

-- 3. Mettre à jour le plan Professionnel
UPDATE subscription_plans
SET
  price_monthly = 12000,
  price_yearly = 120000,
  monthly_credits = 1000,
  updated_at = NOW()
WHERE slug = 'pro';

-- 4. S'assurer que tous les plans ont les bons noms
UPDATE subscription_plans SET name = 'Freemium' WHERE slug = 'free';
UPDATE subscription_plans SET name = 'Premium' WHERE slug = 'discovery';
UPDATE subscription_plans SET name = 'Professionnel' WHERE slug = 'pro';

-- 5. Vérifier les résultats
SELECT slug, name, price_monthly, price_yearly, monthly_credits
FROM subscription_plans
ORDER BY sort_order;
