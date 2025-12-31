-- Migration: Ajouter la colonne image_url à user_reading_history
-- Date: 2025-12-31
-- Description: Stocker l'URL de l'image de l'article pour un affichage plus rapide

-- Ajouter la colonne image_url si elle n'existe pas
ALTER TABLE user_reading_history
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Commentaire sur la nouvelle colonne
COMMENT ON COLUMN user_reading_history.image_url IS 'URL de l''image de l''article pour affichage dans l''historique';

-- Index pour les requêtes qui filtrent par image
CREATE INDEX IF NOT EXISTS idx_user_reading_history_image_url
ON user_reading_history(image_url)
WHERE image_url IS NOT NULL;
