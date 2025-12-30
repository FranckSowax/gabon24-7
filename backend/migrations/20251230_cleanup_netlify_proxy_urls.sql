-- =====================================================
-- Migration: Nettoyage des URLs proxy Netlify obsoletes
-- Date: 2025-12-30
-- Description: Remplace les anciennes URLs Netlify image-proxy
--   par les URLs d'images directes dans la table articles
-- =====================================================

-- =====================================================
-- 1. Extraire les URLs originales des images proxifiees Netlify
-- =====================================================

-- Mise a jour des articles avec URLs proxy Netlify dans image_url
UPDATE articles
SET image_url =
  CASE
    -- Extraire l'URL du parametre ?url=...
    WHEN image_url LIKE '%/.netlify/functions/image-proxy?url=%' THEN
      regexp_replace(
        split_part(split_part(image_url, 'url=', 2), '&', 1),
        '%([0-9A-Fa-f]{2})',
        E'\\\\x\\1',
        'g'
      )
    ELSE image_url
  END
WHERE image_url LIKE '%/.netlify/functions/image-proxy%';

-- Compter les articles mis a jour
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT count(*) INTO updated_count
  FROM articles
  WHERE image_url LIKE '%/.netlify/functions/image-proxy%';

  IF updated_count > 0 THEN
    RAISE NOTICE '⚠️ Il reste % articles avec URLs proxy Netlify', updated_count;
  ELSE
    RAISE NOTICE '✅ Toutes les URLs proxy Netlify ont ete nettoyees';
  END IF;
END $$;

-- =====================================================
-- 2. Nettoyage du tableau image_urls
-- =====================================================

-- Pour les articles avec image_urls en tableau
UPDATE articles
SET image_urls = (
  SELECT array_agg(
    CASE
      WHEN url LIKE '%/.netlify/functions/image-proxy?url=%' THEN
        split_part(split_part(url, 'url=', 2), '&', 1)
      ELSE url
    END
  )
  FROM unnest(image_urls) AS url
)
WHERE image_urls IS NOT NULL
  AND array_to_string(image_urls, ',') LIKE '%/.netlify/functions/image-proxy%';

-- =====================================================
-- 3. Verification finale
-- =====================================================

-- Compter les URLs restantes (pour debug)
SELECT
  'image_url' as column_name,
  count(*) as netlify_proxy_count
FROM articles
WHERE image_url LIKE '%/.netlify/functions/image-proxy%'

UNION ALL

SELECT
  'image_urls' as column_name,
  count(*) as netlify_proxy_count
FROM articles
WHERE array_to_string(image_urls, ',') LIKE '%/.netlify/functions/image-proxy%';

-- =====================================================
-- 4. Index pour performance des recherches d'images
-- =====================================================

-- Index partiel pour articles sans image
CREATE INDEX IF NOT EXISTS idx_articles_no_image
ON articles(id)
WHERE image_url IS NULL AND (image_urls IS NULL OR array_length(image_urls, 1) = 0);

-- Fin de migration
SELECT 'Migration cleanup_netlify_proxy_urls terminee' as status;
