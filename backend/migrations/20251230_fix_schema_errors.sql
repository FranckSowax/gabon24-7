-- =====================================================
-- Migration: Fix Schema Errors
-- Date: 2025-12-30
-- Description: Corrige les colonnes manquantes détectées dans les logs Railway
-- =====================================================

-- =====================================================
-- 1. FIX: column articles.image_url does not exist
-- La colonne s'appelle image_urls (pluriel) pas image_url
-- =====================================================

-- Option A: Créer un alias (vue) - NON RECOMMANDÉ
-- Option B: Ajouter la colonne image_url si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'image_url'
  ) THEN
    -- Ajouter image_url comme colonne calculée ou copie
    ALTER TABLE articles
    ADD COLUMN image_url TEXT GENERATED ALWAYS AS (image_urls[1]) STORED;
    RAISE NOTICE '✅ Colonne image_url ajoutée à articles (premier élément de image_urls)';
  ELSE
    RAISE NOTICE '⏭️ Colonne image_url existe déjà';
  END IF;
EXCEPTION WHEN others THEN
  -- Si generated column ne fonctionne pas, ajouter colonne simple
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE articles ADD COLUMN image_url TEXT;
    RAISE NOTICE '✅ Colonne image_url ajoutée (simple)';
  END IF;
END $$;

-- =====================================================
-- 2. FIX: alert_matches missing columns
-- =====================================================

-- Vérifier la structure actuelle de alert_matches
DO $$
BEGIN
  -- Ajouter user_id si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Colonne user_id ajoutée à alert_matches';
  END IF;

  -- Ajouter is_notified si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'is_notified'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN is_notified BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Colonne is_notified ajoutée à alert_matches';
  END IF;

  -- Ajouter alert_id si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'alert_id'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN alert_id UUID;
    RAISE NOTICE '✅ Colonne alert_id ajoutée à alert_matches';
  END IF;

  -- Ajouter article_id si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'article_id'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN article_id UUID;
    RAISE NOTICE '✅ Colonne article_id ajoutée à alert_matches';
  END IF;

  -- Ajouter relevance_score si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'relevance_score'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN relevance_score DECIMAL(5,2);
    RAISE NOTICE '✅ Colonne relevance_score ajoutée à alert_matches';
  END IF;

  -- Ajouter created_at si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alert_matches' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE alert_matches
    ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Colonne created_at ajoutée à alert_matches';
  END IF;
END $$;

-- Créer les index pour alert_matches
CREATE INDEX IF NOT EXISTS idx_alert_matches_user_id ON alert_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_matches_alert_id ON alert_matches(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_matches_is_notified ON alert_matches(is_notified) WHERE is_notified = false;

-- =====================================================
-- 3. FIX: audio_summaries missing columns
-- =====================================================

DO $$
BEGIN
  -- Ajouter language si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_summaries' AND column_name = 'language'
  ) THEN
    ALTER TABLE audio_summaries
    ADD COLUMN language VARCHAR(5) DEFAULT 'fr';
    RAISE NOTICE '✅ Colonne language ajoutée à audio_summaries';
  END IF;

  -- Ajouter time_slot si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_summaries' AND column_name = 'time_slot'
  ) THEN
    ALTER TABLE audio_summaries
    ADD COLUMN time_slot VARCHAR(20);
    RAISE NOTICE '✅ Colonne time_slot ajoutée à audio_summaries';
  END IF;

  -- Ajouter voice_used si manquant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audio_summaries' AND column_name = 'voice_used'
  ) THEN
    ALTER TABLE audio_summaries
    ADD COLUMN voice_used VARCHAR(50) DEFAULT 'alloy';
    RAISE NOTICE '✅ Colonne voice_used ajoutée à audio_summaries';
  END IF;
END $$;

-- =====================================================
-- 4. STORAGE: Créer le bucket audio-summaries
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-summaries',
  'audio-summaries',
  true,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Policies pour le bucket
DROP POLICY IF EXISTS "Public read access for audio summaries" ON storage.objects;
CREATE POLICY "Public read access for audio summaries"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-summaries');

DROP POLICY IF EXISTS "Service role can upload audio" ON storage.objects;
CREATE POLICY "Service role can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio-summaries');

-- =====================================================
-- 5. RLS: Policy pour audio_summaries publics
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view public audio summaries" ON audio_summaries;
CREATE POLICY "Anyone can view public audio summaries"
ON audio_summaries FOR SELECT
USING (user_id IS NULL);

-- =====================================================
-- 6. VÉRIFICATION FINALE
-- =====================================================

-- Vérifier articles
SELECT 'articles' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'articles' AND column_name IN ('image_url', 'image_urls')
UNION ALL
-- Vérifier alert_matches
SELECT 'alert_matches', column_name, data_type
FROM information_schema.columns
WHERE table_name = 'alert_matches'
UNION ALL
-- Vérifier audio_summaries
SELECT 'audio_summaries', column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audio_summaries' AND column_name IN ('language', 'time_slot', 'voice_used')
ORDER BY table_name, column_name;
