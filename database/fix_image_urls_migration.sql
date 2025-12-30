-- Migration pour corriger définitivement les URLs d'images
-- Date: 2025-08-31
-- Description: Normaliser le stockage des images avec image_url comme source unique

-- 1. S'assurer que la colonne image_url existe
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Peupler image_url depuis image_urls pour tous les articles existants
UPDATE articles 
SET image_url = 
  CASE 
    WHEN image_url IS NULL AND image_urls IS NOT NULL AND array_length(image_urls, 1) > 0 
    THEN image_urls[1]
    ELSE image_url
  END
WHERE image_url IS NULL AND image_urls IS NOT NULL;

-- 3. Créer un index pour les requêtes avec images
CREATE INDEX IF NOT EXISTS idx_articles_has_image 
ON articles (image_url) 
WHERE image_url IS NOT NULL;

-- 4. Ajouter une fonction pour valider et nettoyer les URLs d'images
CREATE OR REPLACE FUNCTION clean_image_url(url TEXT)
RETURNS TEXT AS $$
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;
  
  -- Supprimer les espaces
  url := TRIM(url);
  
  -- S'assurer que l'URL commence par http:// ou https://
  IF NOT (url ILIKE 'http://%' OR url ILIKE 'https://%') THEN
    -- Si c'est une URL relative, la préfixer avec https://
    IF url LIKE '//%' THEN
      url := 'https:' || url;
    ELSIF url LIKE '/%' THEN
      RETURN NULL; -- URL relative sans domaine, invalide
    END IF;
  END IF;
  
  RETURN url;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Nettoyer toutes les URLs existantes
UPDATE articles 
SET image_url = clean_image_url(image_url)
WHERE image_url IS NOT NULL;

-- 6. Statistiques de migration
DO $$
DECLARE
  total_articles INTEGER;
  articles_with_image INTEGER;
  articles_without_image INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_articles FROM articles;
  SELECT COUNT(*) INTO articles_with_image FROM articles WHERE image_url IS NOT NULL;
  articles_without_image := total_articles - articles_with_image;
  
  RAISE NOTICE 'Migration terminée:';
  RAISE NOTICE '  - Total articles: %', total_articles;
  RAISE NOTICE '  - Articles avec image: % (%.1f%%)', articles_with_image, (articles_with_image::float / NULLIF(total_articles, 0) * 100);
  RAISE NOTICE '  - Articles sans image: % (%.1f%%)', articles_without_image, (articles_without_image::float / NULLIF(total_articles, 0) * 100);
END $$;
