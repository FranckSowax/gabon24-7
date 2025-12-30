-- Migration: Création de la table pricing_config pour la gestion des tarifs
-- Date: 2024-12-06

-- Table de configuration des tarifs
CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key VARCHAR(100) UNIQUE NOT NULL,
  feature_name VARCHAR(255) NOT NULL,
  feature_description TEXT,
  credits_cost INTEGER NOT NULL DEFAULT 0,
  ai_model VARCHAR(100),
  estimated_api_cost_usd DECIMAL(10, 6),
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_pricing_config_feature_key ON pricing_config(feature_key);
CREATE INDEX IF NOT EXISTS idx_pricing_config_category ON pricing_config(category);
CREATE INDEX IF NOT EXISTS idx_pricing_config_is_active ON pricing_config(is_active);

-- Table des paramètres de l'application
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour app_settings
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Insertion des tarifs par défaut
INSERT INTO pricing_config (feature_key, feature_name, feature_description, credits_cost, ai_model, estimated_api_cost_usd, category, is_active) VALUES
  -- Business & Projets
  ('initial_analysis', 'Analyse Initiale', 'Analyse IA d''une opportunité business à partir d''un article', 25, 'gpt-4o', 0.04, 'business', true),
  ('re_analysis', 'Ré-analyse Contextuelle', 'Nouvelle analyse avec contexte enrichi', 25, 'gpt-4o', 0.05, 'business', true),
  ('action_plan', 'Plan d''Action', 'Génération d''un plan d''action détaillé', 25, 'gpt-4o', 0.04, 'business', true),
  ('skill_test', 'Test de Compétences', 'Évaluation des compétences pour un projet', 30, 'gpt-4o', 0.03, 'business', true),
  ('custom_training', 'Formation Personnalisée', 'Génération d''un parcours de formation sur mesure', 50, 'gpt-4o', 0.08, 'business', true),
  ('business_plan', 'Business Plan Complet', 'Génération d''un business plan professionnel', 100, 'gpt-4o', 0.15, 'business', true),
  ('motivation_letter', 'Lettre de Motivation', 'Génération d''une lettre de motivation/candidature', 20, 'gpt-4o-mini', 0.01, 'business', true),
  
  -- Articles & Contenu
  ('article_premium', 'Article Premium', 'Déverrouillage d''un article premium', 1, NULL, 0, 'content', true),
  ('audio_summary', 'Résumé Audio', 'Génération d''un résumé audio de l''article', 5, 'tts-1', 0.02, 'content', true),
  ('ai_analysis', 'Analyse IA Article', 'Analyse approfondie d''un article par IA', 10, 'gpt-4o-mini', 0.01, 'content', true),
  
  -- Veille & Alertes
  ('veille_report', 'Rapport de Veille', 'Rapport complet de veille sectorielle', 20, 'gpt-4o', 0.06, 'veille', true),
  ('custom_alert', 'Alerte Personnalisée', 'Création d''une alerte de veille personnalisée', 3, NULL, 0, 'veille', true),
  ('opportunity_analysis', 'Analyse d''Opportunité', 'Analyse d''une opportunité détectée', 15, 'gpt-4o-mini', 0.02, 'veille', true),
  
  -- Chat & Assistant
  ('chat_message', 'Message Chat IA', 'Un message dans le chat assistant projet', 2, 'gpt-4o-mini', 0.005, 'chat', true),
  ('document_analysis', 'Analyse Document', 'Analyse d''un document uploadé', 15, 'gpt-4o', 0.03, 'chat', true)
ON CONFLICT (feature_key) DO NOTHING;

-- Insertion de la valeur par défaut du crédit
INSERT INTO app_settings (key, value, description) VALUES
  ('credit_value_fcfa', '10', 'Valeur d''un crédit en FCFA')
ON CONFLICT (key) DO NOTHING;

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour pricing_config
DROP TRIGGER IF EXISTS update_pricing_config_updated_at ON pricing_config;
CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour app_settings
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Commentaires
COMMENT ON TABLE pricing_config IS 'Configuration des tarifs en crédits pour chaque fonctionnalité';
COMMENT ON TABLE app_settings IS 'Paramètres globaux de l''application';
COMMENT ON COLUMN pricing_config.feature_key IS 'Clé unique de la fonctionnalité (utilisée dans le code)';
COMMENT ON COLUMN pricing_config.credits_cost IS 'Coût en crédits pour utiliser cette fonctionnalité';
COMMENT ON COLUMN pricing_config.ai_model IS 'Modèle IA utilisé (gpt-4o, gpt-4o-mini, claude-3-sonnet, etc.)';
COMMENT ON COLUMN pricing_config.estimated_api_cost_usd IS 'Coût estimé de l''API en USD par utilisation';
