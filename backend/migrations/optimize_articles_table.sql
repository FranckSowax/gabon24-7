-- ====================================================================
-- OPTIMISATION TABLE ARTICLES - SUPPRESSION DOUBLONS & COLONNES OBSOLÈTES
-- ====================================================================

-- ÉTAPE 1: BACKUP (⚠️ EXÉCUTER EN PREMIER)
-- CREATE TABLE articles_backup AS SELECT * FROM articles;

-- ====================================================================
-- ÉTAPE 2: FUSIONNER COLONNES DOUBLONS
-- ====================================================================

-- 2.1: Fusionner category (privilégier ai_category)
UPDATE articles 
SET ai_category = COALESCE(ai_category, category)
WHERE ai_category IS NULL AND category IS NOT NULL;

-- 2.2: Fusionner keywords (privilégier ai_keywords)
UPDATE articles 
SET ai_keywords = COALESCE(ai_keywords, keywords)
WHERE ai_keywords IS NULL AND keywords IS NOT NULL;

-- 2.3: Fusionner sentiment (convertir texte → numérique)
UPDATE articles 
SET ai_sentiment = CASE 
  WHEN sentiment = 'positif' THEN 0.8
  WHEN sentiment = 'négatif' THEN -0.8
  WHEN sentiment = 'neutre' THEN 0
  ELSE ai_sentiment
END
WHERE ai_sentiment IS NULL AND sentiment IS NOT NULL;

-- 2.4: Migrer image_url vers image_urls
UPDATE articles
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL 
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- ====================================================================
-- ÉTAPE 3: SUPPRIMER COLONNES OBSOLÈTES
-- ====================================================================

-- 3.1: Supprimer colonnes jamais utilisées
ALTER TABLE articles 
  DROP COLUMN IF EXISTS importance_score CASCADE;

-- 3.2: Supprimer colonnes remplacées
ALTER TABLE articles 
  DROP COLUMN IF EXISTS image_url CASCADE,
  DROP COLUMN IF EXISTS category CASCADE,
  DROP COLUMN IF EXISTS keywords CASCADE,
  DROP COLUMN IF EXISTS sentiment CASCADE,
  DROP COLUMN IF EXISTS sentiment_confidence CASCADE;

-- 3.3: Supprimer colonnes redondantes (calculables depuis feed_id)
-- ⚠️ Décommenter SEULEMENT si vous êtes sûr de ne plus en avoir besoin
-- ALTER TABLE articles 
--   DROP COLUMN IF EXISTS source CASCADE,
--   DROP COLUMN IF EXISTS media_name CASCADE;

-- 3.4: Supprimer read_time_minutes (calculable dynamiquement)
-- ALTER TABLE articles 
--   DROP COLUMN IF EXISTS read_time_minutes CASCADE;

-- ====================================================================
-- ÉTAPE 4: RENOMMER COLONNES AI (SUPPRIMER PRÉFIXE)
-- ====================================================================

-- 4.1: Renommer pour simplifier
ALTER TABLE articles 
  RENAME COLUMN ai_category TO category;

ALTER TABLE articles 
  RENAME COLUMN ai_summary TO summary_ai;

ALTER TABLE articles 
  RENAME COLUMN ai_keywords TO keywords;

ALTER TABLE articles 
  RENAME COLUMN ai_sentiment TO sentiment_score;

ALTER TABLE articles 
  RENAME COLUMN ai_importance TO importance;

ALTER TABLE articles 
  RENAME COLUMN ai_is_breaking TO is_breaking;

ALTER TABLE articles 
  RENAME COLUMN ai_entities TO entities;

ALTER TABLE articles 
  RENAME COLUMN ai_topic TO topic;

ALTER TABLE articles 
  RENAME COLUMN ai_fact_sources TO fact_sources;

ALTER TABLE articles 
  RENAME COLUMN ai_fact_score TO fact_score;

-- ====================================================================
-- ÉTAPE 5: AJOUTER CONTRAINTES & AMÉLIORER STRUCTURE
-- ====================================================================

-- 5.1: Ajouter contraintes de validation
ALTER TABLE articles 
  ADD CONSTRAINT check_sentiment_range 
  CHECK (sentiment_score IS NULL OR (sentiment_score BETWEEN -1 AND 1));

ALTER TABLE articles 
  ADD CONSTRAINT check_importance_range 
  CHECK (importance IS NULL OR (importance BETWEEN 1 AND 10));

-- 5.2: Ajouter colonnes de tracking enrichissement
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_error TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_retries INTEGER DEFAULT 0;

ALTER TABLE articles 
  ADD CONSTRAINT check_enrichment_status 
  CHECK (enrichment_status IN ('pending', 'processing', 'completed', 'failed'));

-- 5.3: Mettre à jour le statut des articles déjà enrichis
UPDATE articles 
SET enrichment_status = 'completed'
WHERE enriched_at IS NOT NULL;

-- ====================================================================
-- ÉTAPE 6: OPTIMISER INDEX
-- ====================================================================

-- 6.1: Supprimer index inutiles sur colonnes supprimées
DROP INDEX IF EXISTS idx_articles_category;
DROP INDEX IF EXISTS idx_articles_sentiment;

-- 6.2: Créer index optimisés
CREATE INDEX IF NOT EXISTS idx_articles_enrichment_status 
  ON articles(enrichment_status) 
  WHERE enrichment_status != 'completed';

CREATE INDEX IF NOT EXISTS idx_articles_is_breaking 
  ON articles(is_breaking) 
  WHERE is_breaking = true;

CREATE INDEX IF NOT EXISTS idx_articles_category_published 
  ON articles(category, published_at DESC) 
  WHERE is_published = true;

-- 6.3: Index pour recherche full-text (si nécessaire)
-- CREATE INDEX IF NOT EXISTS idx_articles_search 
--   ON articles USING gin(to_tsvector('french', title || ' ' || COALESCE(content, '')));

-- ====================================================================
-- ÉTAPE 7: VACUUM & ANALYZE
-- ====================================================================

-- Récupérer l'espace disque libéré
VACUUM FULL articles;

-- Mettre à jour les statistiques
ANALYZE articles;

-- ====================================================================
-- VÉRIFICATIONS POST-MIGRATION
-- ====================================================================

-- Vérifier la nouvelle structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'articles'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Vérifier les données
SELECT 
  COUNT(*) as total,
  COUNT(category) as avec_category,
  COUNT(summary_ai) as avec_summary_ai,
  COUNT(keywords) as avec_keywords,
  COUNT(enriched_at) as enrichis,
  COUNT(CASE WHEN enrichment_status = 'completed' THEN 1 END) as status_completed
FROM articles;

-- Vérifier la taille
SELECT 
  pg_size_pretty(pg_total_relation_size('articles')) as taille_totale,
  pg_size_pretty(pg_relation_size('articles')) as taille_table,
  pg_size_pretty(pg_indexes_size('articles')) as taille_index;

-- ====================================================================
-- COMMENTAIRES
-- ====================================================================

COMMENT ON TABLE articles IS 'Articles enrichis automatiquement par IA dès extraction RSS';
COMMENT ON COLUMN articles.category IS 'Catégorie détectée par IA (ex: Politique, Économie, Sport)';
COMMENT ON COLUMN articles.summary_ai IS 'Résumé généré par IA en 2-3 phrases';
COMMENT ON COLUMN articles.keywords IS 'Mots-clés extraits par IA';
COMMENT ON COLUMN articles.sentiment_score IS 'Score de sentiment -1 (négatif) à 1 (positif)';
COMMENT ON COLUMN articles.importance IS 'Score d''importance 1-10 calculé par IA';
COMMENT ON COLUMN articles.is_breaking IS 'Article classé comme breaking news par IA';
COMMENT ON COLUMN articles.entities IS 'Entités nommées extraites (personnes, lieux, orgs)';
COMMENT ON COLUMN articles.enrichment_status IS 'Statut enrichissement: pending, processing, completed, failed';
COMMENT ON COLUMN articles.enriched_at IS 'Date d''enrichissement par IA';
