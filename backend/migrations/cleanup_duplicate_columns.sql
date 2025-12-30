-- Migration: Nettoyage des colonnes en doublon dans la table articles
-- Date: 2025-10-12
-- Description: Fusion des colonnes obsolètes vers les nouvelles colonnes IA

BEGIN;

-- 1. Ajouter les colonnes manquantes
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_keywords TEXT[];
ALTER TABLE articles ADD COLUMN IF NOT EXISTS normalized_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source VARCHAR(255);

COMMENT ON COLUMN articles.ai_keywords IS 'Mots-cles extraits par IA OpenAI';
COMMENT ON COLUMN articles.normalized_url IS 'URL normalisee pour detection doublons';
COMMENT ON COLUMN articles.source IS 'Source media de article';

-- 2. Migrer category vers ai_category
UPDATE articles 
SET ai_category = category
WHERE ai_category IS NULL AND category IS NOT NULL AND category != '';

-- 3. Migrer keywords vers ai_keywords
UPDATE articles 
SET ai_keywords = keywords
WHERE ai_keywords IS NULL AND keywords IS NOT NULL AND array_length(keywords, 1) > 0;

-- 4. Migrer sentiment texte vers ai_sentiment numerique
UPDATE articles 
SET ai_sentiment = CASE 
  WHEN sentiment = 'positif' THEN 0.5
  WHEN sentiment = 'negatif' THEN -0.5
  WHEN sentiment = 'neutre' THEN 0.0
  ELSE 0.0
END
WHERE ai_sentiment IS NULL AND sentiment IS NOT NULL;

-- 5. Migrer image_urls vers image_url
UPDATE articles 
SET image_url = image_urls[1]
WHERE image_url IS NULL AND image_urls IS NOT NULL AND array_length(image_urls, 1) > 0;

-- 6. Creer index sur ai_keywords
CREATE INDEX IF NOT EXISTS idx_articles_ai_keywords ON articles USING GIN(ai_keywords);
CREATE INDEX IF NOT EXISTS idx_articles_normalized_url ON articles(normalized_url);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);

COMMIT;
