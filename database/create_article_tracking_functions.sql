-- Tables pour le tracking des articles
CREATE TABLE IF NOT EXISTS article_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT,
    article_url TEXT,
    source TEXT DEFAULT 'rss',
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contrainte unique pour éviter les doublons par utilisateur et article
    CONSTRAINT unique_user_article_view UNIQUE(user_id, article_id)
);

CREATE TABLE IF NOT EXISTS reading_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT NOT NULL,
    article_content TEXT,
    article_summary TEXT,
    article_url TEXT,
    article_source TEXT DEFAULT 'rss',
    article_category TEXT,
    article_published_at TIMESTAMP WITH TIME ZONE,
    reading_duration INTEGER, -- en secondes
    device_type TEXT DEFAULT 'web',
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_favorite BOOLEAN DEFAULT FALSE,
    is_bookmarked BOOLEAN DEFAULT FALSE,
    
    -- Index unique pour éviter les doublons
    UNIQUE(user_id, article_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_article_views_user_id ON article_views(user_id);
CREATE INDEX IF NOT EXISTS idx_article_views_viewed_at ON article_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_read_at ON reading_history(read_at DESC);

-- RLS (Row Level Security)
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour article_views
DROP POLICY IF EXISTS "Users can view their own article views" ON article_views;
DROP POLICY IF EXISTS "Users can insert their own article views" ON article_views;

CREATE POLICY "Users can view their own article views" ON article_views
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own article views" ON article_views
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques RLS pour reading_history
DROP POLICY IF EXISTS "Users can view their own reading history" ON reading_history;
DROP POLICY IF EXISTS "Users can insert their own reading history" ON reading_history;
DROP POLICY IF EXISTS "Users can update their own reading history" ON reading_history;

CREATE POLICY "Users can view their own reading history" ON reading_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading history" ON reading_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading history" ON reading_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Fonction pour enregistrer une vue d'article
DROP FUNCTION IF EXISTS record_article_view(UUID, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION record_article_view(
    p_user_id UUID,
    p_article_id TEXT,
    p_article_title TEXT DEFAULT NULL,
    p_article_url TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'rss'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insérer ou ignorer si déjà vu aujourd'hui
    INSERT INTO article_views (user_id, article_id, article_title, article_url, source)
    VALUES (p_user_id, p_article_id, p_article_title, p_article_url, p_source)
    ON CONFLICT (user_id, article_id) DO NOTHING;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour enregistrer un article lu avec contenu complet
DROP FUNCTION IF EXISTS record_article_read_with_content(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION record_article_read_with_content(
    p_user_id UUID,
    p_article_id TEXT,
    p_article_title TEXT,
    p_article_content TEXT DEFAULT NULL,
    p_article_summary TEXT DEFAULT NULL,
    p_article_url TEXT DEFAULT NULL,
    p_article_source TEXT DEFAULT 'rss',
    p_article_category TEXT DEFAULT NULL,
    p_article_published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_reading_duration INTEGER DEFAULT NULL,
    p_device_type TEXT DEFAULT 'web'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insérer ou mettre à jour l'historique de lecture
    INSERT INTO reading_history (
        user_id, article_id, article_title, article_content, article_summary,
        article_url, article_source, article_category, article_published_at,
        reading_duration, device_type
    )
    VALUES (
        p_user_id, p_article_id, p_article_title, p_article_content, p_article_summary,
        p_article_url, p_article_source, p_article_category, p_article_published_at,
        p_reading_duration, p_device_type
    )
    ON CONFLICT (user_id, article_id) 
    DO UPDATE SET
        article_content = EXCLUDED.article_content,
        article_summary = EXCLUDED.article_summary,
        reading_duration = EXCLUDED.reading_duration,
        read_at = NOW();
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour récupérer le nombre d'articles lus par un utilisateur
DROP FUNCTION IF EXISTS get_user_articles_read_count(UUID);
CREATE OR REPLACE FUNCTION get_user_articles_read_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(DISTINCT article_id)
        FROM article_views
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour récupérer l'historique de lecture d'un utilisateur
DROP FUNCTION IF EXISTS get_user_reading_history(UUID, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION get_user_reading_history(
    user_uuid UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0,
    filter_source TEXT DEFAULT NULL,
    filter_category TEXT DEFAULT NULL,
    filter_favorites BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    article_id TEXT,
    article_title TEXT,
    article_summary TEXT,
    article_url TEXT,
    article_source TEXT,
    article_category TEXT,
    article_published_at TIMESTAMP WITH TIME ZONE,
    reading_duration INTEGER,
    device_type TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    is_favorite BOOLEAN,
    is_bookmarked BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rh.id, rh.article_id, rh.article_title, rh.article_summary,
        rh.article_url, rh.article_source, rh.article_category,
        rh.article_published_at, rh.reading_duration, rh.device_type,
        rh.read_at, rh.is_favorite, rh.is_bookmarked
    FROM reading_history rh
    WHERE rh.user_id = user_uuid
        AND (filter_source IS NULL OR rh.article_source = filter_source)
        AND (filter_category IS NULL OR rh.article_category = filter_category)
        AND (filter_favorites IS NULL OR rh.is_favorite = filter_favorites)
    ORDER BY rh.read_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour récupérer les statistiques de lecture d'un utilisateur
DROP FUNCTION IF EXISTS get_user_reading_stats(UUID);
CREATE OR REPLACE FUNCTION get_user_reading_stats(user_uuid UUID)
RETURNS TABLE(
    total_articles_read INTEGER,
    total_reading_time INTEGER,
    favorite_articles INTEGER,
    bookmarked_articles INTEGER,
    most_read_source TEXT,
    most_read_category TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT rh.article_id)::INTEGER as total_articles_read,
        COALESCE(SUM(rh.reading_duration), 0)::INTEGER as total_reading_time,
        COUNT(CASE WHEN rh.is_favorite THEN 1 END)::INTEGER as favorite_articles,
        COUNT(CASE WHEN rh.is_bookmarked THEN 1 END)::INTEGER as bookmarked_articles,
        (
            SELECT rh2.article_source
            FROM reading_history rh2
            WHERE rh2.user_id = user_uuid
            GROUP BY rh2.article_source
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as most_read_source,
        (
            SELECT rh3.article_category
            FROM reading_history rh3
            WHERE rh3.user_id = user_uuid AND rh3.article_category IS NOT NULL
            GROUP BY rh3.article_category
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ) as most_read_category
    FROM reading_history rh
    WHERE rh.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour toggle favori
DROP FUNCTION IF EXISTS toggle_article_favorite(UUID, TEXT);
CREATE OR REPLACE FUNCTION toggle_article_favorite(
    user_uuid UUID,
    p_article_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_favorite BOOLEAN;
BEGIN
    -- Récupérer l'état actuel
    SELECT is_favorite INTO current_favorite
    FROM reading_history
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    -- Si l'article n'existe pas dans l'historique, ne rien faire
    IF current_favorite IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Toggle le statut favori
    UPDATE reading_history
    SET is_favorite = NOT current_favorite
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    RETURN NOT current_favorite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour toggle bookmark
DROP FUNCTION IF EXISTS toggle_article_bookmark(UUID, TEXT);
CREATE OR REPLACE FUNCTION toggle_article_bookmark(
    user_uuid UUID,
    p_article_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    current_bookmark BOOLEAN;
BEGIN
    -- Récupérer l'état actuel
    SELECT is_bookmarked INTO current_bookmark
    FROM reading_history
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    -- Si l'article n'existe pas dans l'historique, ne rien faire
    IF current_bookmark IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Toggle le statut bookmark
    UPDATE reading_history
    SET is_bookmarked = NOT current_bookmark
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    RETURN NOT current_bookmark;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires pour la documentation
COMMENT ON TABLE article_views IS 'Table pour tracker les vues d''articles par utilisateur';
COMMENT ON TABLE reading_history IS 'Table pour l''historique complet de lecture avec contenu';
COMMENT ON FUNCTION record_article_view IS 'Enregistre une vue d''article (une par jour max)';
COMMENT ON FUNCTION record_article_read_with_content IS 'Enregistre un article lu avec contenu complet';
COMMENT ON FUNCTION get_user_articles_read_count IS 'Retourne le nombre d''articles lus par un utilisateur';
COMMENT ON FUNCTION get_user_reading_history IS 'Retourne l''historique de lecture d''un utilisateur avec filtres';
COMMENT ON FUNCTION get_user_reading_stats IS 'Retourne les statistiques de lecture d''un utilisateur';
COMMENT ON FUNCTION toggle_article_favorite IS 'Toggle le statut favori d''un article';
COMMENT ON FUNCTION toggle_article_bookmark IS 'Toggle le statut bookmark d''un article';
