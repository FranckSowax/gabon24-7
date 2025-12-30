-- Migration: Ajout des colonnes métadonnées IA pour articles
-- Date: 2025-10-08
-- Description: Ajoute les colonnes ai_category, ai_sentiment, ai_importance, ai_is_breaking

-- 1. Ajouter colonne ai_category (catégorie intelligente détectée par IA)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS ai_category VARCHAR(50);

-- 2. Ajouter colonne ai_sentiment (score de sentiment -1 à 1)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS ai_sentiment DECIMAL(3,2);

-- 3. Ajouter colonne ai_importance (score d'importance 0 à 1)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS ai_importance DECIMAL(3,2);

-- 4. Ajouter colonne ai_is_breaking (détection breaking news)
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS ai_is_breaking BOOLEAN DEFAULT FALSE;

-- 5. Créer index sur ai_category pour améliorer performances des alertes
CREATE INDEX IF NOT EXISTS idx_articles_ai_category 
ON articles(ai_category) 
WHERE is_published = TRUE;

-- 6. Créer index sur ai_importance pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_articles_ai_importance 
ON articles(ai_importance DESC) 
WHERE is_published = TRUE;

-- 7. Créer index sur ai_is_breaking pour breaking news
CREATE INDEX IF NOT EXISTS idx_articles_ai_breaking 
ON articles(ai_is_breaking) 
WHERE ai_is_breaking = TRUE AND is_published = TRUE;

-- 8. Créer index composite pour alertes optimisées
CREATE INDEX IF NOT EXISTS idx_articles_ai_category_created 
ON articles(ai_category, created_at DESC) 
WHERE is_published = TRUE;

-- 9. Ajouter commentaires pour documentation
COMMENT ON COLUMN articles.ai_category IS 'Catégorie intelligente détectée par IA (Politique, Économie, Sport, etc.)';
COMMENT ON COLUMN articles.ai_sentiment IS 'Score de sentiment de -1 (très négatif) à 1 (très positif), 0 = neutre';
COMMENT ON COLUMN articles.ai_importance IS 'Score d''importance de 0 (peu important) à 1 (très important)';
COMMENT ON COLUMN articles.ai_is_breaking IS 'Indique si l''article est une breaking news urgente';

-- 10. Créer vue pour articles enrichis IA
CREATE OR REPLACE VIEW articles_with_ai AS
SELECT 
  id,
  title,
  summary,
  ai_summary,
  url,
  image_url,
  category,
  ai_category,
  sentiment,
  ai_sentiment,
  ai_importance,
  ai_is_breaking,
  published_at,
  created_at,
  is_published,
  view_count
FROM articles
WHERE is_published = TRUE
ORDER BY created_at DESC;

-- 11. Statistiques des métadonnées IA (fonction utilitaire)
CREATE OR REPLACE FUNCTION get_ai_enrichment_stats()
RETURNS TABLE (
  total_articles BIGINT,
  enriched_articles BIGINT,
  enrichment_rate DECIMAL(5,2),
  by_category JSON
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_articles,
    COUNT(ai_category)::BIGINT as enriched_articles,
    ROUND((COUNT(ai_category)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 2) as enrichment_rate,
    json_object_agg(
      COALESCE(ai_category, 'Non enrichi'), 
      category_count
    ) as by_category
  FROM (
    SELECT 
      ai_category,
      COUNT(*) as category_count
    FROM articles
    WHERE is_published = TRUE
    GROUP BY ai_category
  ) cat_stats;
END;
$$;

-- Vérification
DO $$
BEGIN
  RAISE NOTICE '✅ Migration terminée: Colonnes métadonnées IA ajoutées';
  RAISE NOTICE '   - ai_category (VARCHAR)';
  RAISE NOTICE '   - ai_sentiment (DECIMAL -1 à 1)';
  RAISE NOTICE '   - ai_importance (DECIMAL 0 à 1)';
  RAISE NOTICE '   - ai_is_breaking (BOOLEAN)';
  RAISE NOTICE '   - Index créés pour performances';
  RAISE NOTICE '   - Vue articles_with_ai disponible';
  RAISE NOTICE '   - Fonction get_ai_enrichment_stats() disponible';
END $$;
