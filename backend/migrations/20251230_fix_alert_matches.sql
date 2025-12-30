-- =====================================================
-- Migration: Fix alert_matches table
-- Date: 2025-12-30
-- Description: Ajoute la colonne is_notified manquante
-- =====================================================

-- Ajouter la colonne is_notified si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'is_notified'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN is_notified BOOLEAN DEFAULT false;

    -- Créer un index pour les recherches
    CREATE INDEX IF NOT EXISTS idx_alert_matches_is_notified
    ON alert_matches(is_notified) WHERE is_notified = false;

    RAISE NOTICE '✅ Colonne is_notified ajoutée à alert_matches';
  ELSE
    RAISE NOTICE '⏭️ Colonne is_notified existe déjà';
  END IF;
END $$;

-- Vérifier la structure de la table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'alert_matches'
ORDER BY ordinal_position;
