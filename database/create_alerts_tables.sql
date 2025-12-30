-- ============================================================================
-- Gabon 24/7 - Module Veille & Alertes Intelligentes
-- Tables pour le système d'alertes intelligentes
-- ============================================================================

-- Table des alertes utilisateur
CREATE TABLE IF NOT EXISTS user_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    keywords TEXT[] NOT NULL, -- Mots-clés saisis par l'utilisateur
    extracted_keywords TEXT[], -- Mots-clés extraits par IA
    semantic_keywords TEXT[], -- Mots-clés sémantiques générés
    categories TEXT[] DEFAULT '{}', -- Catégories d'articles ciblées
    sources TEXT[] DEFAULT '{}', -- Sources RSS spécifiques
    is_active BOOLEAN DEFAULT true,
    delivery_frequency VARCHAR(20) DEFAULT 'immediate', -- immediate, daily, weekly
    delivery_channels JSONB DEFAULT '{"email": true, "whatsapp": false}'::jsonb,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des correspondances d'alertes
CREATE TABLE IF NOT EXISTS alert_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    alert_id UUID REFERENCES user_alerts(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    matched_keywords TEXT[] NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL, -- Score de confiance 0.00-1.00
    matching_type VARCHAR(20) NOT NULL, -- exact, semantic, ai_enhanced
    notification_sent BOOLEAN DEFAULT false,
    notification_channels JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des modèles d'alertes prédéfinis
CREATE TABLE IF NOT EXISTS alert_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    keywords TEXT[] NOT NULL,
    categories TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des statistiques d'usage
CREATE TABLE IF NOT EXISTS alert_usage_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES user_alerts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    matches_count INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0, -- Appels OpenAI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des logs de traitement des alertes
CREATE TABLE IF NOT EXISTS alert_processing_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_type VARCHAR(50) NOT NULL, -- scheduled_immediate, scheduled_daily, scheduled_weekly, manual
    articles_processed INTEGER DEFAULT 0,
    matches_found INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    errors JSONB DEFAULT NULL,
    duration_ms INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_active ON user_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alert_matches_alert_id ON alert_matches(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_matches_article_id ON alert_matches(article_id);
CREATE INDEX IF NOT EXISTS idx_alert_matches_created_at ON alert_matches(created_at);
CREATE INDEX IF NOT EXISTS idx_alert_usage_stats_user_id ON alert_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_usage_stats_date ON alert_usage_stats(date);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_user_alerts_updated_at 
    BEFORE UPDATE ON user_alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_templates_updated_at 
    BEFORE UPDATE ON alert_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir les statistiques d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_alert_stats(p_user_id UUID)
RETURNS TABLE (
    total_alerts INTEGER,
    active_alerts INTEGER,
    total_matches INTEGER,
    notifications_sent INTEGER,
    avg_confidence DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM user_alerts WHERE user_id = p_user_id),
        (SELECT COUNT(*)::INTEGER FROM user_alerts WHERE user_id = p_user_id AND is_active = true),
        (SELECT COUNT(*)::INTEGER 
         FROM alert_matches am 
         JOIN user_alerts ua ON am.alert_id = ua.id 
         WHERE ua.user_id = p_user_id),
        (SELECT COUNT(*)::INTEGER 
         FROM alert_matches am 
         JOIN user_alerts ua ON am.alert_id = ua.id 
         WHERE ua.user_id = p_user_id AND am.notification_sent = true),
        (SELECT COALESCE(AVG(confidence_score), 0)::DECIMAL 
         FROM alert_matches am 
         JOIN user_alerts ua ON am.alert_id = ua.id 
         WHERE ua.user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les alertes récentes d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_recent_matches(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    match_id UUID,
    alert_name VARCHAR,
    article_title VARCHAR,
    article_url VARCHAR,
    matched_keywords TEXT[],
    confidence_score DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        am.id,
        ua.name,
        a.title,
        a.url,
        am.matched_keywords,
        am.confidence_score,
        am.created_at
    FROM alert_matches am
    JOIN user_alerts ua ON am.alert_id = ua.id
    JOIN articles a ON am.article_id = a.id
    WHERE ua.user_id = p_user_id
    ORDER BY am.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Politiques RLS (Row Level Security)
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_usage_stats ENABLE ROW LEVEL SECURITY;

-- Politiques pour user_alerts
CREATE POLICY "Users can view their own alerts" ON user_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own alerts" ON user_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" ON user_alerts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" ON user_alerts
    FOR DELETE USING (auth.uid() = user_id);

-- Politiques pour alert_matches
CREATE POLICY "Users can view matches for their alerts" ON alert_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_alerts ua 
            WHERE ua.id = alert_matches.alert_id 
            AND ua.user_id = auth.uid()
        )
    );

-- Politiques pour alert_templates
CREATE POLICY "Everyone can view public templates" ON alert_templates
    FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create templates" ON alert_templates
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own templates" ON alert_templates
    FOR UPDATE USING (auth.uid() = created_by);

-- Politiques pour alert_usage_stats
CREATE POLICY "Users can view their own stats" ON alert_usage_stats
    FOR SELECT USING (auth.uid() = user_id);

-- Insertion de modèles d'alertes par défaut
INSERT INTO alert_templates (name, description, keywords, categories, is_public, created_by)
VALUES 
    ('Économie Gabonaise', 'Surveillance de l''actualité économique du Gabon', 
     ARRAY['économie', 'PIB', 'croissance', 'investissement', 'budget', 'finances'], 
     ARRAY['économie', 'politique'], true, NULL),
    
    ('Secteur Pétrolier', 'Actualités du secteur pétrolier et énergétique', 
     ARRAY['pétrole', 'Total', 'Shell', 'énergie', 'raffinage', 'exploration'], 
     ARRAY['économie', 'énergie'], true, NULL),
    
    ('Politique Nationale', 'Suivi de la vie politique gabonaise', 
     ARRAY['gouvernement', 'Assemblée nationale', 'élections', 'ministre', 'président'], 
     ARRAY['politique'], true, NULL),
    
    ('Santé Publique', 'Actualités de la santé au Gabon', 
     ARRAY['santé', 'hôpital', 'médecine', 'épidémie', 'vaccin', 'CHU'], 
     ARRAY['société', 'santé'], true, NULL),
    
    ('Éducation', 'Nouvelles du secteur éducatif', 
     ARRAY['éducation', 'université', 'école', 'formation', 'étudiant', 'enseignement'], 
     ARRAY['société', 'éducation'], true, NULL)

ON CONFLICT (name) DO NOTHING;

-- Commentaires
COMMENT ON TABLE user_alerts IS 'Table des alertes configurées par les utilisateurs';
COMMENT ON TABLE alert_matches IS 'Table des correspondances entre alertes et articles';
COMMENT ON TABLE alert_templates IS 'Modèles d''alertes prédéfinis pour faciliter la création';
COMMENT ON TABLE alert_usage_stats IS 'Statistiques d''usage des alertes pour optimisation';

COMMENT ON COLUMN user_alerts.keywords IS 'Mots-clés originaux saisis par l''utilisateur';
COMMENT ON COLUMN user_alerts.extracted_keywords IS 'Mots-clés extraits et enrichis par OpenAI';
COMMENT ON COLUMN user_alerts.semantic_keywords IS 'Mots-clés sémantiques générés pour matching avancé';
COMMENT ON COLUMN alert_matches.confidence_score IS 'Score de confiance du matching (0.00 à 1.00)';
COMMENT ON COLUMN alert_matches.matching_type IS 'Type de correspondance: exact, semantic, ai_enhanced';
