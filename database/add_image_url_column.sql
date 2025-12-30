-- Migration pour ajouter la colonne image_url à la table articles
-- Date: 2025-08-30
-- Description: Ajouter une colonne pour stocker l'URL de l'image principale de chaque article

-- Ajouter la colonne image_url
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ajouter un commentaire sur la colonne
COMMENT ON COLUMN articles.image_url IS 'URL de l''image principale de l''article extraite depuis le flux RSS ou le contenu web';

-- Créer un index pour améliorer les performances des requêtes filtrant par présence d'image
CREATE INDEX IF NOT EXISTS idx_articles_has_image ON articles (image_url) WHERE image_url IS NOT NULL;

-- Mettre à jour les articles existants qui ont des images dans image_urls
UPDATE articles 
SET image_url = (
  CASE 
    WHEN image_urls IS NOT NULL AND jsonb_array_length(image_urls) > 0 
    THEN image_urls->>0
    ELSE NULL
  END
)
WHERE image_url IS NULL AND image_urls IS NOT NULL;
