-- Migration: Ajouter tous les types d'abonnement utilisés
-- Date: 2026-01-03
--
-- Types utilisés dans l'application:
-- - free/freemium : Utilisateurs gratuits
-- - discovery : Plan Premium (300 crédits/mois) - utilisé dans le frontend
-- - premium : Alias pour discovery (legacy)
-- - pro : Plan Professionnel (1000 crédits/mois)
-- - enterprise : Utilisateurs admin/entreprise
-- - journalist : Legacy, pour compatibilité

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_type_check;

-- 2. Ajouter la nouvelle contrainte avec TOUS les types utilisés
ALTER TABLE users ADD CONSTRAINT users_subscription_type_check
  CHECK (subscription_type IN (
    'free',        -- Plan gratuit
    'freemium',    -- Alias pour free
    'discovery',   -- Plan Premium (utilisé par le frontend)
    'premium',     -- Alias pour discovery (legacy)
    'pro',         -- Plan Professionnel
    'enterprise',  -- Entreprise/Admin
    'journalist'   -- Legacy
  ));

-- 3. Mettre à jour l'utilisateur admin en 'pro'
UPDATE users
SET subscription_type = 'pro', updated_at = NOW()
WHERE email = 'sowaxcom@gmail.com';
