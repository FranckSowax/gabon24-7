-- Table pour l'historique complet des articles lus par les utilisateurs
-- Stocke l'article complet avec la date de lecture

-- Créer la table user_reading_history
CREATE TABLE IF NOT EXISTS user_reading_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id VARCHAR(255) NOT NULL,
    article_title TEXT NOT NULL,
    article_content TEXT, -- Contenu complet de l'article
    article_summary TEXT, -- Résumé de l'article
    article_url TEXT,
    article_source VARCHAR(100),
    article_category VARCHAR(100),
    article_published_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reading_duration INTEGER, -- Durée de lecture estimée en secondes
    is_favorite BOOLEAN DEFAULT FALSE,
    is_bookmarked BOOLEAN DEFAULT FALSE,
    reading_progress INTEGER DEFAULT 100, -- Pourcentage de lecture (100 = article lu complètement)
    device_type VARCHAR(50), -- mobile, desktop, tablet
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_user_reading_history_user_id ON user_reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reading_history_read_at ON user_reading_history(read_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reading_history_article_id ON user_reading_history(article_id);
CREATE INDEX IF NOT EXISTS idx_user_reading_history_source ON user_reading_history(article_source);
CREATE INDEX IF NOT EXISTS idx_user_reading_history_category ON user_reading_history(article_category);
CREATE INDEX IF NOT EXISTS idx_user_reading_history_favorites ON user_reading_history(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_reading_history_bookmarks ON user_reading_history(user_id, is_bookmarked) WHERE is_bookmarked = TRUE;

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_user_reading_history_user_date ON user_reading_history(user_id, read_at DESC);

-- Contrainte unique pour éviter les doublons (un utilisateur ne peut lire le même article qu'une fois)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reading_history_unique ON user_reading_history(user_id, article_id);

-- Activer RLS (Row Level Security)
ALTER TABLE user_reading_history ENABLE ROW LEVEL SECURITY;

-- Politique RLS : Les utilisateurs ne peuvent voir que leur propre historique
CREATE POLICY "Users can view their own reading history" ON user_reading_history
    FOR SELECT USING (auth.uid() = user_id);

-- Politique RLS : Les utilisateurs ne peuvent insérer que dans leur propre historique
CREATE POLICY "Users can insert their own reading history" ON user_reading_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique RLS : Les utilisateurs peuvent mettre à jour leur propre historique
CREATE POLICY "Users can update their own reading history" ON user_reading_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Politique RLS : Les utilisateurs peuvent supprimer leur propre historique
CREATE POLICY "Users can delete their own reading history" ON user_reading_history
    FOR DELETE USING (auth.uid() = user_id);

-- Politique pour le service role (backend)
CREATE POLICY "Service role can manage all reading history" ON user_reading_history
    FOR ALL USING (auth.role() = 'service_role');

-- Fonction pour enregistrer un article lu avec contenu complet
CREATE OR REPLACE FUNCTION record_article_read_with_content(
    p_user_id UUID,
    p_article_id VARCHAR(255),
    p_article_title TEXT,
    p_article_content TEXT DEFAULT NULL,
    p_article_summary TEXT DEFAULT NULL,
    p_article_url TEXT DEFAULT NULL,
    p_article_source VARCHAR(100) DEFAULT 'rss',
    p_article_category VARCHAR(100) DEFAULT NULL,
    p_article_published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_reading_duration INTEGER DEFAULT NULL,
    p_device_type VARCHAR(50) DEFAULT 'web'
) RETURNS BOOLEAN AS $$
BEGIN
    -- Insérer ou mettre à jour l'historique de lecture
    INSERT INTO user_reading_history (
        user_id,
        article_id,
        article_title,
        article_content,
        article_summary,
        article_url,
        article_source,
        article_category,
        article_published_at,
        reading_duration,
        device_type,
        read_at
    ) VALUES (
        p_user_id,
        p_article_id,
        p_article_title,
        p_article_content,
        p_article_summary,
        p_article_url,
        p_article_source,
        p_article_category,
        p_article_published_at,
        p_reading_duration,
        p_device_type,
        NOW()
    )
    ON CONFLICT (user_id, article_id) 
    DO UPDATE SET
        read_at = NOW(),
        reading_duration = COALESCE(p_reading_duration, user_reading_history.reading_duration),
        updated_at = NOW();
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir l'historique de lecture d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_reading_history(
    user_uuid UUID,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0,
    filter_source VARCHAR(100) DEFAULT NULL,
    filter_category VARCHAR(100) DEFAULT NULL,
    filter_favorites BOOLEAN DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    article_id VARCHAR(255),
    article_title TEXT,
    article_content TEXT,
    article_summary TEXT,
    article_url TEXT,
    article_source VARCHAR(100),
    article_category VARCHAR(100),
    article_published_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    reading_duration INTEGER,
    is_favorite BOOLEAN,
    is_bookmarked BOOLEAN,
    reading_progress INTEGER,
    device_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.article_id,
        h.article_title,
        h.article_content,
        h.article_summary,
        h.article_url,
        h.article_source,
        h.article_category,
        h.article_published_at,
        h.read_at,
        h.reading_duration,
        h.is_favorite,
        h.is_bookmarked,
        h.reading_progress,
        h.device_type
    FROM user_reading_history h
    WHERE h.user_id = user_uuid
        AND (filter_source IS NULL OR h.article_source = filter_source)
        AND (filter_category IS NULL OR h.article_category = filter_category)
        AND (filter_favorites IS NULL OR h.is_favorite = filter_favorites)
    ORDER BY h.read_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les statistiques de lecture d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_reading_stats(user_uuid UUID)
RETURNS TABLE (
    total_articles_read BIGINT,
    articles_this_week BIGINT,
    articles_this_month BIGINT,
    favorite_articles BIGINT,
    bookmarked_articles BIGINT,
    total_reading_time INTEGER,
    most_read_source VARCHAR(100),
    most_read_category VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_articles_read,
        COUNT(*) FILTER (WHERE read_at >= NOW() - INTERVAL '7 days') as articles_this_week,
        COUNT(*) FILTER (WHERE read_at >= NOW() - INTERVAL '30 days') as articles_this_month,
        COUNT(*) FILTER (WHERE is_favorite = TRUE) as favorite_articles,
        COUNT(*) FILTER (WHERE is_bookmarked = TRUE) as bookmarked_articles,
        COALESCE(SUM(reading_duration), 0)::INTEGER as total_reading_time,
        (SELECT article_source FROM user_reading_history 
         WHERE user_id = user_uuid 
         GROUP BY article_source 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as most_read_source,
        (SELECT article_category FROM user_reading_history 
         WHERE user_id = user_uuid AND article_category IS NOT NULL
         GROUP BY article_category 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as most_read_category
    FROM user_reading_history
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour marquer un article comme favori
CREATE OR REPLACE FUNCTION toggle_article_favorite(
    user_uuid UUID,
    p_article_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    current_favorite BOOLEAN;
BEGIN
    -- Récupérer l'état actuel
    SELECT is_favorite INTO current_favorite
    FROM user_reading_history
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    IF current_favorite IS NULL THEN
        RETURN FALSE; -- Article non trouvé dans l'historique
    END IF;
    
    -- Inverser l'état
    UPDATE user_reading_history
    SET is_favorite = NOT current_favorite,
        updated_at = NOW()
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour marquer un article comme bookmark
CREATE OR REPLACE FUNCTION toggle_article_bookmark(
    user_uuid UUID,
    p_article_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    current_bookmark BOOLEAN;
BEGIN
    -- Récupérer l'état actuel
    SELECT is_bookmarked INTO current_bookmark
    FROM user_reading_history
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    IF current_bookmark IS NULL THEN
        RETURN FALSE; -- Article non trouvé dans l'historique
    END IF;
    
    -- Inverser l'état
    UPDATE user_reading_history
    SET is_bookmarked = NOT current_bookmark,
        updated_at = NOW()
    WHERE user_id = user_uuid AND article_id = p_article_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_reading_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_reading_history_updated_at
    BEFORE UPDATE ON user_reading_history
    FOR EACH ROW
    EXECUTE FUNCTION update_user_reading_history_updated_at();

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE user_reading_history IS 'Historique complet des articles lus par les utilisateurs avec contenu et métadonnées';
COMMENT ON COLUMN user_reading_history.article_content IS 'Contenu complet de l''article au moment de la lecture';
COMMENT ON COLUMN user_reading_history.reading_duration IS 'Durée de lecture estimée en secondes';
COMMENT ON COLUMN user_reading_history.reading_progress IS 'Pourcentage de lecture (0-100)';
COMMENT ON COLUMN user_reading_history.device_type IS 'Type d''appareil utilisé pour la lecture';
