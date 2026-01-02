-- =====================================================
-- MIGRATION: Mise à jour des packages de crédits
-- Date: 2026-01-02
-- Description: Cohérence avec les abonnements (Premium=300/5000, Pro=1000/10000)
-- =====================================================

-- Logique tarifaire:
-- - Abonnement Premium: 300 crédits/mois pour 5000 FCFA = ~16.67 FCFA/crédit
-- - Abonnement Pro: 1000 crédits/mois pour 10000 FCFA = 10 FCFA/crédit
-- - Achat ponctuel: ~20 FCFA/crédit (légèrement plus cher pour inciter l'abonnement)
-- - Bonus: Plus le pack est gros, plus le bonus est généreux

-- Supprimer les anciens packages
DELETE FROM credit_packages;

-- Insérer les nouveaux packages cohérents
INSERT INTO credit_packages (name, slug, credits, bonus_credits, price_xaf, price_usd, discount_percentage, is_popular, sort_order, description, features) VALUES

-- Pack Découverte (50 crédits - Pour essayer)
('Découverte', 'decouverte', 50, 0, 1000, 1.65, 0, false, 1,
'Idéal pour découvrir nos services IA',
'["50 crédits", "~2 analyses IA", "Valable 6 mois", "Support email"]'::jsonb),

-- Pack Standard (300 crédits - Équivalent 1 mois Premium)
('Standard', 'standard', 300, 50, 5000, 8.25, 0, true, 2,
'Le meilleur rapport qualité-prix',
'["300 crédits + 50 bonus", "Équivalent 1 mois Premium", "~14 analyses IA", "Valable 1 an", "Support prioritaire"]'::jsonb),

-- Pack Premium (650 crédits - Plus avantageux)
('Premium', 'premium', 650, 150, 10000, 16.50, 15, false, 3,
'Pour les utilisateurs réguliers',
'["650 crédits + 150 bonus", "Économie de 15%", "~32 analyses IA", "Valable 1 an", "Support VIP"]'::jsonb),

-- Pack Business (1750 crédits - Pour professionnels)
('Business', 'business', 1750, 500, 25000, 41.25, 25, false, 4,
'Solution professionnelle complète',
'["1750 crédits + 500 bonus", "Économie de 25%", "~90 analyses IA", "Valable 2 ans", "Support dédié", "Accès API"]'::jsonb);

-- =====================================================
-- Mise à jour du ratio affiché
-- =====================================================

-- Ajouter un commentaire pour référence
COMMENT ON TABLE credit_packages IS 'Packages de crédits à l''achat. Ratio: ~20 FCFA/crédit. Abonnements: Premium 300cr/5000F, Pro 1000cr/10000F';

-- =====================================================
-- Résumé des nouveaux packages
-- =====================================================
-- | Pack        | Crédits | Bonus | Total | Prix FCFA | Prix/crédit |
-- |-------------|---------|-------|-------|-----------|-------------|
-- | Découverte  | 50      | 0     | 50    | 1,000     | 20 FCFA     |
-- | Standard    | 300     | 50    | 350   | 5,000     | 14.3 FCFA   |
-- | Premium     | 650     | 150   | 800   | 10,000    | 12.5 FCFA   |
-- | Business    | 1750    | 500   | 2250  | 25,000    | 11.1 FCFA   |
-- =====================================================
