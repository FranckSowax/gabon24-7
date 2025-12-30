-- =====================================================
-- Migration: Fix Audio Summaries Public Access
-- Date: 2025-12-30
-- Description: Ajoute les policies RLS pour permettre l'accès aux résumés audio publics
-- =====================================================

-- =====================================================
-- 1. AJOUTER POLICY POUR RÉSUMÉS PUBLICS (user_id IS NULL)
-- =====================================================

-- Supprimer l'ancienne policy si elle existe
DROP POLICY IF EXISTS "Anyone can view public audio summaries" ON audio_summaries;

-- Créer la policy pour les résumés publics (user_id = NULL)
CREATE POLICY "Anyone can view public audio summaries"
  ON audio_summaries FOR SELECT
  USING (user_id IS NULL);

-- =====================================================
-- 2. AJOUTER COLONNE language SI MANQUANTE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_summaries' AND column_name = 'language'
  ) THEN
    ALTER TABLE audio_summaries
    ADD COLUMN language VARCHAR(5) DEFAULT 'fr' CHECK (language IN ('fr', 'en', 'zh'));
    RAISE NOTICE '✅ Colonne language ajoutée à audio_summaries';
  ELSE
    RAISE NOTICE '⏭️ Colonne language existe déjà';
  END IF;
END $$;

-- =====================================================
-- 3. AJOUTER COLONNE time_slot SI MANQUANTE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_summaries' AND column_name = 'time_slot'
  ) THEN
    ALTER TABLE audio_summaries
    ADD COLUMN time_slot VARCHAR(20) CHECK (time_slot IN ('morning', 'afternoon', 'evening'));
    RAISE NOTICE '✅ Colonne time_slot ajoutée à audio_summaries';
  ELSE
    RAISE NOTICE '⏭️ Colonne time_slot existe déjà';
  END IF;
END $$;

-- =====================================================
-- 4. AJOUTER COLONNE voice_used SI MANQUANTE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_summaries' AND column_name = 'voice_used'
  ) THEN
    ALTER TABLE audio_summaries
    ADD COLUMN voice_used VARCHAR(50) DEFAULT 'alloy';
    RAISE NOTICE '✅ Colonne voice_used ajoutée à audio_summaries';
  ELSE
    RAISE NOTICE '⏭️ Colonne voice_used existe déjà';
  END IF;
END $$;

-- =====================================================
-- 5. AJOUTER INDEX POUR RECHERCHE RÉSUMÉS PUBLICS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_audio_summaries_public
  ON audio_summaries(summary_type, status, language, created_at DESC)
  WHERE user_id IS NULL;

-- =====================================================
-- 6. POLICY POUR SERVICE ROLE (backend) POUR INSÉRER DES RÉSUMÉS PUBLICS
-- =====================================================

-- Supprimer l'ancienne policy si elle existe
DROP POLICY IF EXISTS "Service can insert public audio summaries" ON audio_summaries;

-- Le backend utilise la clé service_role qui bypass RLS
-- Mais pour être explicite, on ajoute une policy pour les insertions publiques
CREATE POLICY "Service can insert public audio summaries"
  ON audio_summaries FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- =====================================================
-- 7. VÉRIFICATION FINALE
-- =====================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'audio_summaries';

  RAISE NOTICE '✅ Migration terminée. % policies sur audio_summaries', policy_count;
END $$;
