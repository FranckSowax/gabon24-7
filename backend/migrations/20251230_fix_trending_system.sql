-- =====================================================
-- Migration: Fix Trending System
-- Date: 2025-12-30
-- Description: Corrige le systeme de tendances avec tracking des vues
--   - Cree/corrige la table article_views pour tracker les vues
--   - Ajoute les colonnes view_count et share_count aux articles
--   - Cree les fonctions RPC pour le tracking
--   - Cree les index pour les requetes de tendances
-- =====================================================

-- =====================================================
-- 1. S'assurer que articles a les colonnes view_count et share_count
-- =====================================================

DO $$
BEGIN
  -- Ajouter view_count si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE articles ADD COLUMN view_count INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Colonne view_count ajoutee a articles';
  END IF;

  -- Ajouter share_count si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'share_count'
  ) THEN
    ALTER TABLE articles ADD COLUMN share_count INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Colonne share_count ajoutee a articles';
  END IF;
END $$;

-- =====================================================
-- 2. Creer/corriger la table article_views pour tracking detaille
-- =====================================================

CREATE TABLE IF NOT EXISTS article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  user_id UUID,
  session_id VARCHAR(255),
  ip_hash VARCHAR(64),
  user_agent TEXT,
  referrer TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  view_duration_seconds INTEGER DEFAULT 0,
  source VARCHAR(50) DEFAULT 'web'
);

-- Ajouter les colonnes manquantes si la table existe deja
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_views' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE article_views ADD COLUMN session_id VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_views' AND column_name = 'ip_hash'
  ) THEN
    ALTER TABLE article_views ADD COLUMN ip_hash VARCHAR(64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'article_views' AND column_name = 'view_duration_seconds'
  ) THEN
    ALTER TABLE article_views ADD COLUMN view_duration_seconds INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- 3. Creer la table article_shares pour tracking des partages
-- =====================================================

CREATE TABLE IF NOT EXISTS article_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  user_id UUID,
  platform VARCHAR(50) NOT NULL, -- 'whatsapp', 'facebook', 'twitter', 'copy_link', etc.
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. Index pour les tendances (performances)
-- =====================================================

-- Index pour les vues (sans predicat temporel - NOW() n'est pas IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_article_views_article_id ON article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_article_views_viewed_at ON article_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_views_composite ON article_views(article_id, viewed_at DESC);

-- Index pour les partages
CREATE INDEX IF NOT EXISTS idx_article_shares_article_id ON article_shares(article_id);
CREATE INDEX IF NOT EXISTS idx_article_shares_shared_at ON article_shares(shared_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_shares_composite ON article_shares(article_id, shared_at DESC);

-- Index pour articles trending
CREATE INDEX IF NOT EXISTS idx_articles_view_count ON articles(view_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_share_count ON articles(share_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_published_views ON articles(published_at DESC, view_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_published_shares ON articles(published_at DESC, share_count DESC NULLS LAST);

-- =====================================================
-- 5. Fonction RPC pour enregistrer une vue et incrementer le compteur
-- =====================================================

CREATE OR REPLACE FUNCTION record_article_view(
  p_article_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_session_id VARCHAR DEFAULT NULL,
  p_ip_hash VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_source VARCHAR DEFAULT 'web'
)
RETURNS BOOLEAN AS $$
DECLARE
  last_view TIMESTAMPTZ;
BEGIN
  -- Verifier si c'est une vue unique (pas de vue dans les 5 dernieres minutes pour meme session/IP)
  SELECT MAX(viewed_at) INTO last_view
  FROM article_views
  WHERE article_id = p_article_id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_session_id IS NOT NULL AND session_id = p_session_id)
      OR (p_ip_hash IS NOT NULL AND ip_hash = p_ip_hash)
    )
    AND viewed_at > NOW() - INTERVAL '5 minutes';

  -- Si pas de vue recente, enregistrer
  IF last_view IS NULL THEN
    -- Inserer dans article_views
    INSERT INTO article_views (article_id, user_id, session_id, ip_hash, user_agent, referrer, source)
    VALUES (p_article_id, p_user_id, p_session_id, p_ip_hash, p_user_agent, p_referrer, p_source);

    -- Incrementer le compteur dans articles
    UPDATE articles
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = p_article_id;

    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Fonction RPC pour enregistrer un partage
-- =====================================================

CREATE OR REPLACE FUNCTION record_article_share(
  p_article_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_platform VARCHAR DEFAULT 'unknown'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Inserer dans article_shares
  INSERT INTO article_shares (article_id, user_id, platform)
  VALUES (p_article_id, p_user_id, p_platform);

  -- Incrementer le compteur dans articles
  UPDATE articles
  SET share_count = COALESCE(share_count, 0) + 1
  WHERE id = p_article_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. Fonction pour obtenir les articles trending par vues
-- =====================================================

CREATE OR REPLACE FUNCTION get_trending_articles_by_views(
  p_period VARCHAR DEFAULT 'daily',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  article_id UUID,
  title TEXT,
  summary TEXT,
  category VARCHAR,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  source VARCHAR,
  url TEXT,
  view_count BIGINT,
  period_views BIGINT
) AS $$
DECLARE
  date_filter TIMESTAMPTZ;
BEGIN
  -- Determiner la date de filtrage selon la periode
  CASE p_period
    WHEN 'daily' THEN date_filter := NOW() - INTERVAL '1 day';
    WHEN 'weekly' THEN date_filter := NOW() - INTERVAL '7 days';
    WHEN 'monthly' THEN date_filter := NOW() - INTERVAL '30 days';
    ELSE date_filter := NOW() - INTERVAL '1 day';
  END CASE;

  RETURN QUERY
  SELECT
    a.id AS article_id,
    a.title,
    COALESCE(a.ai_summary, a.summary, 'Resume non disponible') AS summary,
    a.category,
    a.published_at,
    COALESCE(a.image_urls[1], a.image_url) AS image_url,
    a.source,
    a.url,
    COALESCE(a.view_count, 0)::BIGINT AS view_count,
    COUNT(av.id)::BIGINT AS period_views
  FROM articles a
  LEFT JOIN article_views av ON a.id = av.article_id AND av.viewed_at >= date_filter
  WHERE a.is_published = true
    AND a.published_at >= date_filter
  GROUP BY a.id
  ORDER BY period_views DESC, a.view_count DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Fonction pour obtenir les articles trending par partages
-- =====================================================

CREATE OR REPLACE FUNCTION get_trending_articles_by_shares(
  p_period VARCHAR DEFAULT 'daily',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  article_id UUID,
  title TEXT,
  summary TEXT,
  category VARCHAR,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  source VARCHAR,
  url TEXT,
  share_count BIGINT,
  period_shares BIGINT
) AS $$
DECLARE
  date_filter TIMESTAMPTZ;
BEGIN
  -- Determiner la date de filtrage selon la periode
  CASE p_period
    WHEN 'daily' THEN date_filter := NOW() - INTERVAL '1 day';
    WHEN 'weekly' THEN date_filter := NOW() - INTERVAL '7 days';
    WHEN 'monthly' THEN date_filter := NOW() - INTERVAL '30 days';
    ELSE date_filter := NOW() - INTERVAL '1 day';
  END CASE;

  RETURN QUERY
  SELECT
    a.id AS article_id,
    a.title,
    COALESCE(a.ai_summary, a.summary, 'Resume non disponible') AS summary,
    a.category,
    a.published_at,
    COALESCE(a.image_urls[1], a.image_url) AS image_url,
    a.source,
    a.url,
    COALESCE(a.share_count, 0)::BIGINT AS share_count,
    COUNT(ash.id)::BIGINT AS period_shares
  FROM articles a
  LEFT JOIN article_shares ash ON a.id = ash.article_id AND ash.shared_at >= date_filter
  WHERE a.is_published = true
    AND a.published_at >= date_filter
  GROUP BY a.id
  ORDER BY period_shares DESC, a.share_count DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. Fonction pour le compteur d'articles lus par utilisateur
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_articles_read_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT article_id)::INTEGER
  FROM article_views
  WHERE user_id = user_uuid;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- 10. RLS Policies
-- =====================================================

-- Activer RLS
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_shares ENABLE ROW LEVEL SECURITY;

-- Policy pour lecture publique des vues (pour les stats)
DROP POLICY IF EXISTS "Public can view article_views" ON article_views;
CREATE POLICY "Public can view article_views" ON article_views
  FOR SELECT USING (true);

-- Policy pour insertion (tout le monde peut tracker)
DROP POLICY IF EXISTS "Anyone can insert article_views" ON article_views;
CREATE POLICY "Anyone can insert article_views" ON article_views
  FOR INSERT WITH CHECK (true);

-- Policy pour lecture publique des partages
DROP POLICY IF EXISTS "Public can view article_shares" ON article_shares;
CREATE POLICY "Public can view article_shares" ON article_shares
  FOR SELECT USING (true);

-- Policy pour insertion partages
DROP POLICY IF EXISTS "Anyone can insert article_shares" ON article_shares;
CREATE POLICY "Anyone can insert article_shares" ON article_shares
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- 11. Verification finale
-- =====================================================

SELECT 'articles' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'articles'
AND column_name IN ('view_count', 'share_count')
ORDER BY column_name;

SELECT 'article_views' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'article_views'
ORDER BY column_name;

SELECT 'article_shares' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'article_shares'
ORDER BY column_name;
