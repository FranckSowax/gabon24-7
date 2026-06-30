-- =====================================================
-- Aligner le modèle de la "Formation sur mesure" (/training)
-- sur gemini-3-pro dans pricing_config (prime sur le code).
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

INSERT INTO pricing_config
  (feature_key, feature_name, feature_description, credits_cost, ai_model, category, is_active)
VALUES
  ('custom_training', 'Formation Personnalisée',
   'Génération d''un parcours de formation sur mesure', 50, 'gemini-3-pro', 'business', TRUE)
ON CONFLICT (feature_key) DO UPDATE
  SET ai_model = 'gemini-3-pro',
      is_active = TRUE,
      updated_at = NOW();
-- NB : credits_cost n'est PAS écrasé sur conflit (conserve la valeur en place).

-- Vérification
SELECT feature_key, ai_model, credits_cost, is_active
FROM pricing_config WHERE feature_key = 'custom_training';
