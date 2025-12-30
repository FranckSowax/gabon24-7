-- Table pour tracker les vues d'articles par utilisateur
CREATE TABLE IF NOT EXISTS article_views (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id VARCHAR(255) NOT NULL,
  article_title TEXT,
  article_url TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(100), -- 'rss', 'search', etc.
  
  -- Contrainte unique pour éviter les doublons (même utilisateur + même article)
  UNIQUE(user_id, article_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_article_views_user_id ON article_views(user_id);
CREATE INDEX IF NOT EXISTS idx_article_views_viewed_at ON article_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_views_article_id ON article_views(article_id);

-- RLS (Row Level Security)
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre à un utilisateur de voir ses propres vues
CREATE POLICY "Users can view their own article views" ON article_views
  FOR SELECT USING (auth.uid() = user_id);

-- Politique pour permettre à un utilisateur d'insérer ses propres vues
CREATE POLICY "Users can insert their own article views" ON article_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique pour le service role (backend)
CREATE POLICY "Service role can manage all article views" ON article_views
  FOR ALL USING (auth.role() = 'service_role');

-- Fonction pour obtenir le nombre d'articles lus par un utilisateur
CREATE OR REPLACE FUNCTION get_user_articles_read_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM article_views
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour enregistrer une vue d'article (avec upsert)
CREATE OR REPLACE FUNCTION record_article_view(
  p_user_id UUID,
  p_article_id VARCHAR(255),
  p_article_title TEXT DEFAULT NULL,
  p_article_url TEXT DEFAULT NULL,
  p_source VARCHAR(100) DEFAULT 'rss'
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO article_views (user_id, article_id, article_title, article_url, source)
  VALUES (p_user_id, p_article_id, p_article_title, p_article_url, p_source)
  ON CONFLICT (user_id, article_id) 
  DO UPDATE SET 
    viewed_at = NOW(),
    article_title = COALESCE(EXCLUDED.article_title, article_views.article_title),
    article_url = COALESCE(EXCLUDED.article_url, article_views.article_url);
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
