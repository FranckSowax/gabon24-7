-- Table pour l'historique des articles consultés par les utilisateurs
CREATE TABLE IF NOT EXISTS user_article_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    article_id VARCHAR(255) NOT NULL,
    title TEXT,
    source VARCHAR(255),
    url TEXT,
    article_type VARCHAR(50) DEFAULT 'rss', -- 'rss' ou 'database'
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_user_article_history_user_id ON user_article_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_article_history_article_id ON user_article_history(article_id);
CREATE INDEX IF NOT EXISTS idx_user_article_history_viewed_at ON user_article_history(viewed_at);
CREATE INDEX IF NOT EXISTS idx_user_article_history_user_viewed ON user_article_history(user_id, viewed_at DESC);

-- Contrainte de clé étrangère vers la table users (si elle existe)
-- ALTER TABLE user_article_history ADD CONSTRAINT fk_user_article_history_user_id 
-- FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Commentaires pour documentation
COMMENT ON TABLE user_article_history IS 'Historique des articles consultés par chaque utilisateur';
COMMENT ON COLUMN user_article_history.user_id IS 'ID de l''utilisateur qui a consulté l''article';
COMMENT ON COLUMN user_article_history.article_id IS 'ID de l''article consulté (hash MD5 pour RSS ou UUID pour base)';
COMMENT ON COLUMN user_article_history.article_type IS 'Type d''article: rss ou database';
COMMENT ON COLUMN user_article_history.viewed_at IS 'Date et heure de consultation de l''article';
