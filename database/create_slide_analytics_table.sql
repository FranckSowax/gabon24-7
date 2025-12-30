-- Table pour les analytics détaillées des slides publicitaires
CREATE TABLE IF NOT EXISTS slide_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slide_id UUID NOT NULL REFERENCES promotional_slides(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('view', 'click')),
    user_ip INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_slide_analytics_slide_id ON slide_analytics(slide_id);
CREATE INDEX IF NOT EXISTS idx_slide_analytics_event_type ON slide_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_slide_analytics_created_at ON slide_analytics(created_at);

-- RLS (Row Level Security)
ALTER TABLE slide_analytics ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'insertion publique (tracking)
CREATE POLICY "Allow public insert for tracking" ON slide_analytics
    FOR INSERT WITH CHECK (true);

-- Politique pour permettre la lecture aux admins seulement
CREATE POLICY "Allow admin read access" ON slide_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email LIKE '%@admin.%'
        )
    );

-- Commentaires
COMMENT ON TABLE slide_analytics IS 'Analytics détaillées pour le tracking des vues et clics sur les slides publicitaires';
COMMENT ON COLUMN slide_analytics.slide_id IS 'Référence vers le slide publicitaire';
COMMENT ON COLUMN slide_analytics.event_type IS 'Type d''événement: view ou click';
COMMENT ON COLUMN slide_analytics.user_ip IS 'Adresse IP de l''utilisateur';
COMMENT ON COLUMN slide_analytics.user_agent IS 'User-Agent du navigateur';
COMMENT ON COLUMN slide_analytics.referrer IS 'Page de référence';
