-- Table pour stocker les articles favoris des utilisateurs
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT,
    article_url TEXT,
    article_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index unique pour éviter les doublons
    UNIQUE(user_id, article_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON user_favorites(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs ne voient que leurs propres favoris
CREATE POLICY "Users can view their own favorites" ON user_favorites
    FOR SELECT USING (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent ajouter leurs propres favoris
CREATE POLICY "Users can insert their own favorites" ON user_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent supprimer leurs propres favoris
CREATE POLICY "Users can delete their own favorites" ON user_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_favorites_updated_at 
    BEFORE UPDATE ON user_favorites 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Commentaires pour la documentation
COMMENT ON TABLE user_favorites IS 'Table pour stocker les articles favoris des utilisateurs authentifiés';
COMMENT ON COLUMN user_favorites.user_id IS 'ID de l''utilisateur (référence vers auth.users)';
COMMENT ON COLUMN user_favorites.article_id IS 'ID unique de l''article favori';
COMMENT ON COLUMN user_favorites.article_title IS 'Titre de l''article pour référence';
COMMENT ON COLUMN user_favorites.article_url IS 'URL de l''article pour accès direct';
COMMENT ON COLUMN user_favorites.article_source IS 'Source de l''article (ex: Gabon Review, L''Union, etc.)';
