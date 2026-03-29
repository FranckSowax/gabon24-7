-- ====================================================================
-- MIGRATION: Activer PostgreSQL Full-Text Search (français) sur articles
-- Date: 2026-03-27
-- Description: Ajoute colonne tsvector + index GIN + trigger auto-update
-- ====================================================================

-- 1. Ajouter colonne tsvector pour recherche full-text
ALTER TABLE articles ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Peupler la colonne pour les articles existants
-- Poids: A = titre (priorité max), B = résumé + keywords, C = contenu
UPDATE articles SET search_vector =
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(summary_ai, summary, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(content, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(array_to_string(keywords, ' '), '')), 'B');

-- 3. Index GIN pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_articles_search_vector
  ON articles USING gin(search_vector);

-- 4. Index sur published_at pour tri + filtre date (si absent)
CREATE INDEX IF NOT EXISTS idx_articles_published_at_desc
  ON articles(published_at DESC)
  WHERE is_published = true;

-- 5. Trigger pour mise à jour automatique à chaque INSERT/UPDATE
CREATE OR REPLACE FUNCTION articles_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.summary_ai, NEW.summary, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_articles_search ON articles;
CREATE TRIGGER trig_articles_search
  BEFORE INSERT OR UPDATE OF title, summary_ai, summary, content, keywords
  ON articles FOR EACH ROW
  EXECUTE FUNCTION articles_search_trigger();

-- 6. Fonction RPC pour recherche FTS avec scoring (appelée depuis le backend)
CREATE OR REPLACE FUNCTION search_articles_fts(
  search_query TEXT,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  summary TEXT,
  summary_ai TEXT,
  url TEXT,
  image_url TEXT,
  image_urls TEXT[],
  author TEXT,
  published_at TIMESTAMPTZ,
  category TEXT,
  keywords TEXT[],
  sentiment_score NUMERIC,
  importance NUMERIC,
  is_breaking BOOLEAN,
  view_count INTEGER,
  share_count INTEGER,
  created_at TIMESTAMPTZ,
  source TEXT,
  search_score REAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.summary,
    a.summary_ai,
    a.url,
    a.image_url,
    a.image_urls,
    a.author,
    a.published_at,
    a.category,
    a.keywords,
    a.sentiment_score,
    a.importance,
    a.is_breaking,
    a.view_count,
    a.share_count,
    a.created_at,
    a.source,
    ts_rank_cd(a.search_vector, to_tsquery('french', search_query))::REAL AS search_score
  FROM articles a
  WHERE a.is_published = true
    AND a.search_vector @@ to_tsquery('french', search_query)
  ORDER BY search_score DESC, a.published_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- 7. Vérification
DO $$
DECLARE
  total_count INTEGER;
  indexed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM articles;
  SELECT COUNT(*) INTO indexed_count FROM articles WHERE search_vector IS NOT NULL;
  RAISE NOTICE '✅ Migration FTS terminée: % / % articles indexés', indexed_count, total_count;
END $$;
