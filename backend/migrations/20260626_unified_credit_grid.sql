-- =====================================================
-- Grille de crédits UNIFIÉE "1 contenu = 1 prix"
-- Ancre: Infographie = 40 crédits | BP & Formation = 2× (80)
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

-- Mise à jour des tarifs existants
UPDATE pricing_config SET credits_cost = 25 WHERE feature_key = 'opportunity_analysis';
UPDATE pricing_config SET credits_cost = 60 WHERE feature_key = 'action_plan';
UPDATE pricing_config SET credits_cost = 35 WHERE feature_key = 'skill_test';
UPDATE pricing_config SET credits_cost = 80 WHERE feature_key = 'custom_training';
UPDATE pricing_config SET credits_cost = 80, ai_model = 'gpt-4.1-mini' WHERE feature_key = 'business_plan';
UPDATE pricing_config SET credits_cost = 15 WHERE feature_key = 'motivation_letter';

-- Aligner les modèles (fin de gpt-4-turbo)
UPDATE pricing_config SET ai_model = 'gpt-4.1-mini' WHERE feature_key IN ('veille_report', 'document_analysis');

-- Visuels IA (gpt-image-2) — ajout s'ils n'existent pas
INSERT INTO pricing_config (feature_key, feature_name, credits_cost, ai_model, category, is_active)
VALUES
  ('illustration_logo',        'Logo IA',        25, 'gpt-image-2', 'business', true),
  ('illustration_flyer',       'Flyer IA',       30, 'gpt-image-2', 'business', true),
  ('illustration_infographic', 'Infographie IA', 40, 'gpt-image-2', 'business', true)
ON CONFLICT (feature_key) DO UPDATE
  SET credits_cost = EXCLUDED.credits_cost,
      ai_model = EXCLUDED.ai_model,
      is_active = true;

-- Vérification
SELECT feature_key, credits_cost, ai_model
FROM pricing_config
WHERE feature_key IN (
  'opportunity_analysis','action_plan','skill_test','custom_training','business_plan',
  'motivation_letter','illustration_logo','illustration_flyer','illustration_infographic'
)
ORDER BY credits_cost;
