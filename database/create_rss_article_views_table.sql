-- Table pour tracker les vues des articles RSS
CREATE TABLE IF NOT EXISTS rss_article_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    article_id VARCHAR(255) NOT NULL UNIQUE,
    title TEXT,
    source VARCHAR(255),
    url TEXT,
    view_count INTEGER DEFAULT 1,
    first_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_rss_article_views_article_id ON rss_article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_rss_article_views_source ON rss_article_views(source);
CREATE INDEX IF NOT EXISTS idx_rss_article_views_last_viewed ON rss_article_views(last_viewed_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_rss_article_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rss_article_views_updated_at
    BEFORE UPDATE ON rss_article_views
    FOR EACH ROW
    EXECUTE FUNCTION update_rss_article_views_updated_at();

-- Commentaires pour documentation
COMMENT ON TABLE rss_article_views IS 'Table pour tracker les vues des articles RSS avec comptage réel';
COMMENT ON COLUMN rss_article_views.article_id IS 'ID unique de l''article (hash MD5 ou format rss-timestamp-index)';
COMMENT ON COLUMN rss_article_views.view_count IS 'Nombre total de vues de l''article';
COMMENT ON COLUMN rss_article_views.first_viewed_at IS 'Date de la première vue';
COMMENT ON COLUMN rss_article_views.last_viewed_at IS 'Date de la dernière vue';
