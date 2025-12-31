-- Migration: Ajouter les colonnes manquantes à map_routes
-- Date: 2025-12-31
-- Description: Correction de l'erreur "column map_routes.start_point does not exist"

-- Ajouter toutes les colonnes nécessaires à map_routes si elles n'existent pas
DO $$
BEGIN
  -- Vérifier si la table existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'map_routes'
  ) THEN
    -- start_point
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'start_point'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN start_point VARCHAR(255);
      RAISE NOTICE '✅ Colonne start_point ajoutée à map_routes';
    END IF;

    -- end_point
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'end_point'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN end_point VARCHAR(255);
      RAISE NOTICE '✅ Colonne end_point ajoutée à map_routes';
    END IF;

    -- waypoints
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'waypoints'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN waypoints JSONB;
      RAISE NOTICE '✅ Colonne waypoints ajoutée à map_routes';
    END IF;

    -- distance_km
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'distance_km'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN distance_km DECIMAL(10,2);
      RAISE NOTICE '✅ Colonne distance_km ajoutée à map_routes';
    END IF;

    -- estimated_duration_min
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'estimated_duration_min'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN estimated_duration_min INTEGER;
      RAISE NOTICE '✅ Colonne estimated_duration_min ajoutée à map_routes';
    END IF;

    -- transport_type
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'transport_type'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN transport_type VARCHAR(50) DEFAULT 'bus';
      RAISE NOTICE '✅ Colonne transport_type ajoutée à map_routes';
    END IF;

    -- difficulty
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'difficulty'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN difficulty VARCHAR(20) DEFAULT 'easy';
      RAISE NOTICE '✅ Colonne difficulty ajoutée à map_routes';
    END IF;

    -- display_order
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'display_order'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN display_order INTEGER DEFAULT 0;
      RAISE NOTICE '✅ Colonne display_order ajoutée à map_routes';
    END IF;

    -- is_active (au cas où)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'is_active'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN is_active BOOLEAN DEFAULT true;
      RAISE NOTICE '✅ Colonne is_active ajoutée à map_routes';
    END IF;

    -- name (au cas où)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'name'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN name VARCHAR(255);
      RAISE NOTICE '✅ Colonne name ajoutée à map_routes';
    END IF;

    -- description (au cas où)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'map_routes' AND column_name = 'description'
    ) THEN
      ALTER TABLE map_routes ADD COLUMN description TEXT;
      RAISE NOTICE '✅ Colonne description ajoutée à map_routes';
    END IF;

  ELSE
    -- Créer la table map_routes si elle n'existe pas
    CREATE TABLE map_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      start_point VARCHAR(255),
      end_point VARCHAR(255),
      waypoints JSONB,
      distance_km DECIMAL(10,2),
      estimated_duration_min INTEGER,
      transport_type VARCHAR(50) DEFAULT 'bus',
      difficulty VARCHAR(20) DEFAULT 'easy',
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      coordinates JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE '✅ Table map_routes créée avec toutes les colonnes';
  END IF;
END $$;

-- Index pour map_routes
CREATE INDEX IF NOT EXISTS idx_map_routes_name ON map_routes(name);
CREATE INDEX IF NOT EXISTS idx_map_routes_transport ON map_routes(transport_type);
CREATE INDEX IF NOT EXISTS idx_map_routes_active ON map_routes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_map_routes_order ON map_routes(display_order);

-- Afficher la structure finale
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'map_routes'
ORDER BY ordinal_position;
