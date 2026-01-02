-- =====================================================
-- MIGRATION: pricing_config - Tarification dynamique
-- Date: 2026-01-02
-- Description: Système centralisé de tarification pour toutes les fonctionnalités IA
-- =====================================================

-- Table principale de tarification
CREATE TABLE IF NOT EXISTS pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(100) UNIQUE NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    feature_description TEXT,
    credits_cost INTEGER NOT NULL DEFAULT 10,
    ai_model VARCHAR(100),
    estimated_api_cost_usd DECIMAL(10, 6),
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_pricing_config_feature_key ON pricing_config(feature_key);
CREATE INDEX IF NOT EXISTS idx_pricing_config_category ON pricing_config(category);
CREATE INDEX IF NOT EXISTS idx_pricing_config_active ON pricing_config(is_active);

-- Table app_settings pour la valeur du crédit
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valeur par défaut du crédit
INSERT INTO app_settings (key, value, description)
VALUES ('credit_value_fcfa', '10', '1 crédit = X FCFA')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- DONNÉES INITIALES - Tarification par défaut
-- =====================================================

-- Business & Projets
INSERT INTO pricing_config (feature_key, feature_name, feature_description, credits_cost, ai_model, estimated_api_cost_usd, category) VALUES
('initial_analysis', 'Analyse Initiale', 'Analyse IA d''une opportunité business à partir d''un article', 25, 'gemini-2.0-flash', 0.001, 'business'),
('re_analysis', 'Ré-analyse Contextuelle', 'Nouvelle analyse avec contexte enrichi', 25, 'gemini-2.0-flash', 0.001, 'business'),
('action_plan', 'Plan d''Action', 'Génération d''un plan d''action détaillé', 25, 'gemini-2.0-flash', 0.001, 'business'),
('skill_test', 'Test de Compétences', 'Évaluation des compétences pour un projet', 30, 'gemini-2.0-flash', 0.001, 'business'),
('custom_training', 'Formation Personnalisée', 'Génération d''un parcours de formation sur mesure', 50, 'gemini-2.0-flash', 0.002, 'business'),
('business_plan', 'Business Plan Complet', 'Génération d''un business plan professionnel', 100, 'gpt-4-turbo', 0.15, 'business'),
('motivation_letter', 'Lettre de Motivation', 'Génération d''une lettre de motivation/candidature', 20, 'gemini-2.0-flash', 0.001, 'business'),
('sponsored_article', 'Article Sponsorisé', 'Génération d''un article sponsorisé professionnel', 50, 'gemini-2.0-flash', 0.002, 'business'),
('generate_article', 'Génération Article IA', 'Génération complète d''un article par IA', 50, 'gemini-2.0-flash', 0.002, 'business'),
('generate_description', 'Génération Description', 'Génération de description de bannière/produit', 10, 'gemini-2.0-flash', 0.0005, 'business'),
('generate_titles', 'Suggestions de Titres', 'Génération de suggestions de titres', 5, 'gemini-2.0-flash', 0.0003, 'business'),
('generate_document', 'Génération Document', 'Génération d''un document business', 15, 'gemini-2.0-flash', 0.001, 'business')
ON CONFLICT (feature_key) DO UPDATE SET
    credits_cost = EXCLUDED.credits_cost,
    ai_model = EXCLUDED.ai_model,
    estimated_api_cost_usd = EXCLUDED.estimated_api_cost_usd,
    updated_at = NOW();

-- Articles & Contenu
INSERT INTO pricing_config (feature_key, feature_name, feature_description, credits_cost, ai_model, estimated_api_cost_usd, category) VALUES
('article_premium', 'Article Premium', 'Déverrouillage d''un article premium', 1, NULL, 0, 'content'),
('audio_summary', 'Résumé Audio', 'Génération d''un résumé audio de l''article (OpenAI TTS)', 20, 'tts-1', 0.02, 'content'),
('ai_analysis', 'Analyse IA Article', 'Analyse approfondie d''un article par IA', 10, 'gemini-2.0-flash', 0.0005, 'content'),
('tldr_summary', 'Résumé TL;DR', 'Génération d''un résumé court de l''article', 0, 'gemini-2.0-flash', 0.0001, 'content'),
('improve_text', 'Amélioration Texte', 'Amélioration et correction d''un texte', 10, 'gemini-2.0-flash', 0.0005, 'content'),
('analyze_text', 'Analyse Texte', 'Analyse de sentiment et ton d''un texte', 10, 'gemini-2.0-flash', 0.0005, 'content')
ON CONFLICT (feature_key) DO UPDATE SET
    credits_cost = EXCLUDED.credits_cost,
    ai_model = EXCLUDED.ai_model,
    estimated_api_cost_usd = EXCLUDED.estimated_api_cost_usd,
    updated_at = NOW();

-- Veille & Alertes
INSERT INTO pricing_config (feature_key, feature_name, feature_description, credits_cost, ai_model, estimated_api_cost_usd, category) VALUES
('veille_report', 'Rapport de Veille', 'Rapport complet de veille sectorielle', 20, 'gpt-4-turbo', 0.06, 'veille'),
('custom_alert', 'Alerte Personnalisée', 'Création d''une alerte de veille personnalisée', 3, NULL, 0, 'veille'),
('opportunity_analysis', 'Analyse d''Opportunité', 'Analyse d''une opportunité détectée', 15, 'gemini-2.0-flash', 0.001, 'veille')
ON CONFLICT (feature_key) DO UPDATE SET
    credits_cost = EXCLUDED.credits_cost,
    ai_model = EXCLUDED.ai_model,
    estimated_api_cost_usd = EXCLUDED.estimated_api_cost_usd,
    updated_at = NOW();

-- Chat & Assistant
INSERT INTO pricing_config (feature_key, feature_name, feature_description, credits_cost, ai_model, estimated_api_cost_usd, category) VALUES
('chat_message', 'Message Chat IA', 'Un message dans le chat assistant projet', 2, 'gpt-4o-mini', 0.0006, 'chat'),
('document_analysis', 'Analyse Document', 'Analyse d''un document uploadé', 15, 'gpt-4-turbo', 0.03, 'chat'),
('rag_query', 'Question Insight Gab', 'Question au chatbot RAG Insight Gab', 5, 'gemini-2.0-flash', 0.001, 'chat')
ON CONFLICT (feature_key) DO UPDATE SET
    credits_cost = EXCLUDED.credits_cost,
    ai_model = EXCLUDED.ai_model,
    estimated_api_cost_usd = EXCLUDED.estimated_api_cost_usd,
    updated_at = NOW();

-- =====================================================
-- TRIGGER pour updated_at automatique
-- =====================================================

CREATE OR REPLACE FUNCTION update_pricing_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pricing_config_updated_at ON pricing_config;
CREATE TRIGGER trigger_pricing_config_updated_at
    BEFORE UPDATE ON pricing_config
    FOR EACH ROW
    EXECUTE FUNCTION update_pricing_config_updated_at();

-- =====================================================
-- PERMISSIONS RLS (Row Level Security)
-- =====================================================

-- Activer RLS
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique (tout le monde peut voir les tarifs)
DROP POLICY IF EXISTS pricing_config_read_policy ON pricing_config;
CREATE POLICY pricing_config_read_policy ON pricing_config
    FOR SELECT
    USING (true);

-- Politique d'écriture (service_role seulement)
DROP POLICY IF EXISTS pricing_config_write_policy ON pricing_config;
CREATE POLICY pricing_config_write_policy ON pricing_config
    FOR ALL
    USING (auth.role() = 'service_role');

-- Même chose pour app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read_policy ON app_settings;
CREATE POLICY app_settings_read_policy ON app_settings
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS app_settings_write_policy ON app_settings;
CREATE POLICY app_settings_write_policy ON app_settings
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON TABLE pricing_config IS 'Configuration centralisée des tarifs en crédits pour chaque fonctionnalité IA';
COMMENT ON COLUMN pricing_config.feature_key IS 'Clé unique du service (ex: audio_summary, action_plan)';
COMMENT ON COLUMN pricing_config.credits_cost IS 'Coût en crédits (0 = gratuit)';
COMMENT ON COLUMN pricing_config.ai_model IS 'Modèle IA utilisé (gemini-2.0-flash, gpt-4-turbo, tts-1, etc.)';
COMMENT ON COLUMN pricing_config.estimated_api_cost_usd IS 'Coût API estimé en USD par utilisation';
COMMENT ON COLUMN pricing_config.category IS 'Catégorie: business, content, veille, chat';
COMMENT ON COLUMN pricing_config.is_active IS 'Si false, le service est désactivé';
