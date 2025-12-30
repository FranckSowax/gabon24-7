-- =====================================================
-- Script de création du bucket Supabase pour vidéos publicitaires
-- =====================================================

-- 1. Créer le bucket video-campaigns
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-campaigns',
  'video-campaigns',
  true,
  10485760, -- 10MB max (format léger optimisé)
  ARRAY['video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm'];

-- 2. Politiques RLS pour le bucket video-campaigns

-- Permettre upload public
CREATE POLICY "Allow public uploads to video-campaigns"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'video-campaigns');

-- Permettre lecture publique
CREATE POLICY "Allow public read from video-campaigns"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'video-campaigns');

-- Permettre suppression publique
CREATE POLICY "Allow public delete from video-campaigns"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'video-campaigns');

-- =====================================================
-- Informations sur le bucket
-- =====================================================
-- Bucket: video-campaigns
-- Public: true
-- Limite: 10MB (10485760 bytes)
-- Formats: MP4 (H.264), WebM
-- Usage: Vidéos publicitaires optimisées pour modal/pop-up
-- Compression: Vidéos doivent être pré-optimisées avant upload
-- 
-- ⚠️ FORMAT VIDÉO REQUIS - CARRÉ (1:1)
-- Résolution OBLIGATOIRE: 1080x1080 pixels (format carré)
-- Pourquoi carré? S'adapte parfaitement desktop ET mobile sans déformation
-- Durée: 15-30 secondes
-- Codec: H.264 (MP4) recommandé pour compatibilité maximale
-- 
-- Outils recommandés pour créer vidéo carrée:
-- - Canva (en ligne, facile)
-- - Adobe Premiere Pro (professionnel)
-- - HandBrake (gratuit, compression)
-- - FFmpeg (ligne de commande)
-- 
-- Exemple FFmpeg pour convertir en carré 1080x1080:
-- ffmpeg -i input.mp4 -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slow -crf 22 output.mp4
