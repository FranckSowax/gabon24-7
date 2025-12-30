-- =====================================================
-- Migration: Create audio-summaries storage bucket
-- Date: 2025-12-30
-- Description: Crée le bucket de stockage pour les fichiers audio
-- =====================================================

-- 1. Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-summaries',
  'audio-summaries',
  true,  -- Bucket public
  52428800,  -- 50MB max
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- 2. Policy pour permettre la lecture publique
DROP POLICY IF EXISTS "Public read access for audio summaries" ON storage.objects;
CREATE POLICY "Public read access for audio summaries"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-summaries');

-- 3. Policy pour permettre l'upload par le service role (backend)
DROP POLICY IF EXISTS "Service role can upload audio" ON storage.objects;
CREATE POLICY "Service role can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio-summaries');

-- 4. Policy pour permettre la suppression par le service role
DROP POLICY IF EXISTS "Service role can delete audio" ON storage.objects;
CREATE POLICY "Service role can delete audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'audio-summaries');

-- Vérification
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'audio-summaries';
