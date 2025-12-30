-- =====================================================
-- Migration: Fix Missing Columns
-- Date: 2025-12-30
-- Description: Corrige les colonnes manquantes détectées dans les logs Railway
--   - promotional_slides.company_name
--   - map_routes.name
--   - alert_matches.confidence_score (numeric overflow)
-- =====================================================

-- =====================================================
-- 1. FIX: promotional_slides.company_name does not exist
-- =====================================================

DO $$
BEGIN
  -- Ajouter company_name si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_slides' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE promotional_slides
    ADD COLUMN company_name VARCHAR(255);
    RAISE NOTICE '✅ Colonne company_name ajoutée à promotional_slides';
  ELSE
    RAISE NOTICE '⏭️ Colonne company_name existe déjà dans promotional_slides';
  END IF;

  -- Ajouter display_order si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_slides' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE promotional_slides
    ADD COLUMN display_order INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Colonne display_order ajoutée à promotional_slides';
  END IF;

  -- Ajouter slide_type si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_slides' AND column_name = 'slide_type'
  ) THEN
    ALTER TABLE promotional_slides
    ADD COLUMN slide_type VARCHAR(50) DEFAULT 'image';
    RAISE NOTICE '✅ Colonne slide_type ajoutée à promotional_slides';
  END IF;

  -- Ajouter html_content si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_slides' AND column_name = 'html_content'
  ) THEN
    ALTER TABLE promotional_slides
    ADD COLUMN html_content TEXT;
    RAISE NOTICE '✅ Colonne html_content ajoutée à promotional_slides';
  END IF;

  -- Ajouter image_url_banner si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_slides' AND column_name = 'image_url_banner'
  ) THEN
    ALTER TABLE promotional_slides
    ADD COLUMN image_url_banner TEXT;
    RAISE NOTICE '✅ Colonne image_url_banner ajoutée à promotional_slides';
  END IF;

  -- Ajouter image_url_mobile si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotional_slides' AND column_name = 'image_url_mobile'
  ) THEN
    ALTER TABLE promotional_slides
    ADD COLUMN image_url_mobile TEXT;
    RAISE NOTICE '✅ Colonne image_url_mobile ajoutée à promotional_slides';
  END IF;
END $$;

-- =====================================================
-- 2. FIX: map_routes.name does not exist
-- =====================================================

-- D'abord vérifier si la table map_routes existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'map_routes'
  ) THEN
    -- Ajouter name si manquant
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'name'
    ) THEN
      ALTER TABLE map_routes
      ADD COLUMN name VARCHAR(255);
      RAISE NOTICE '✅ Colonne name ajoutée à map_routes';
    ELSE
      RAISE NOTICE '⏭️ Colonne name existe déjà dans map_routes';
    END IF;

    -- Ajouter description si manquant
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'description'
    ) THEN
      ALTER TABLE map_routes
      ADD COLUMN description TEXT;
      RAISE NOTICE '✅ Colonne description ajoutée à map_routes';
    END IF;

    -- Ajouter route_type si manquant (bus, taxi, etc.)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'route_type'
    ) THEN
      ALTER TABLE map_routes
      ADD COLUMN route_type VARCHAR(50) DEFAULT 'bus';
      RAISE NOTICE '✅ Colonne route_type ajoutée à map_routes';
    END IF;

    -- Ajouter coordinates (JSONB pour stocker les points GPS)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'coordinates'
    ) THEN
      ALTER TABLE map_routes
      ADD COLUMN coordinates JSONB;
      RAISE NOTICE '✅ Colonne coordinates ajoutée à map_routes';
    END IF;

    -- Ajouter is_active
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'is_active'
    ) THEN
      ALTER TABLE map_routes
      ADD COLUMN is_active BOOLEAN DEFAULT true;
      RAISE NOTICE '✅ Colonne is_active ajoutée à map_routes';
    END IF;

  ELSE
    -- Créer la table map_routes si elle n'existe pas
    CREATE TABLE map_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      route_type VARCHAR(50) DEFAULT 'bus',
      coordinates JSONB,
      start_point VARCHAR(255),
      end_point VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE '✅ Table map_routes créée';
  END IF;
END $$;

-- Index pour map_routes
CREATE INDEX IF NOT EXISTS idx_map_routes_name ON map_routes(name);
CREATE INDEX IF NOT EXISTS idx_map_routes_type ON map_routes(route_type);
CREATE INDEX IF NOT EXISTS idx_map_routes_active ON map_routes(is_active) WHERE is_active = true;

-- =====================================================
-- 3. FIX: alert_matches numeric field overflow
-- Le champ confidence_score est probablement DECIMAL(5,2)
-- qui ne peut contenir que des valeurs de -999.99 à 999.99
-- Mais le code envoie peut-être des valeurs > 1000
-- =====================================================

DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Vérifier le type actuel de confidence_score
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'alert_matches' AND column_name = 'confidence_score';

  IF col_type IS NOT NULL THEN
    -- Modifier pour permettre des valeurs plus grandes
    -- DECIMAL(10,4) permet des valeurs jusqu'à 999999.9999
    ALTER TABLE alert_matches
    ALTER COLUMN confidence_score TYPE DECIMAL(10,4);
    RAISE NOTICE '✅ Colonne confidence_score modifiée en DECIMAL(10,4)';
  END IF;

  -- Faire pareil pour relevance_score si elle existe
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'alert_matches' AND column_name = 'relevance_score';

  IF col_type IS NOT NULL THEN
    ALTER TABLE alert_matches
    ALTER COLUMN relevance_score TYPE DECIMAL(10,4);
    RAISE NOTICE '✅ Colonne relevance_score modifiée en DECIMAL(10,4)';
  END IF;
END $$;

-- =====================================================
-- 4. VÉRIFICATION FINALE
-- =====================================================

-- Vérifier promotional_slides
SELECT 'promotional_slides' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'promotional_slides'
AND column_name IN ('company_name', 'display_order', 'slide_type', 'html_content', 'image_url_banner', 'image_url_mobile')
ORDER BY column_name;

-- Vérifier map_routes
SELECT 'map_routes' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'map_routes'
ORDER BY column_name;

-- Vérifier alert_matches (scores)
SELECT 'alert_matches' as table_name, column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'alert_matches'
AND column_name IN ('confidence_score', 'relevance_score')
ORDER BY column_name;
