-- =====================================================
-- Section vidéos d'accueil (21:9, autoplay en boucle)
-- Remplace la bannière HeroSlider sur la home.
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

-- 1. Table des vidéos
CREATE TABLE IF NOT EXISTS hero_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  cta_label TEXT,
  cta_url TEXT,
  video_url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hero_videos_active ON hero_videos(is_active, order_index);

ALTER TABLE hero_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active hero videos" ON hero_videos;
CREATE POLICY "Public read active hero videos" ON hero_videos FOR SELECT USING (true);

-- 2. Bucket de stockage des vidéos (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-videos',
  'hero-videos',
  true,
  209715200, -- 200 MB max (avant compression serveur)
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 209715200,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm'];

DROP POLICY IF EXISTS "Public read hero videos" ON storage.objects;
CREATE POLICY "Public read hero videos" ON storage.objects FOR SELECT USING (bucket_id = 'hero-videos');

DROP POLICY IF EXISTS "Service role upload hero videos" ON storage.objects;
CREATE POLICY "Service role upload hero videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hero-videos');

DROP POLICY IF EXISTS "Service role delete hero videos" ON storage.objects;
CREATE POLICY "Service role delete hero videos" ON storage.objects FOR DELETE USING (bucket_id = 'hero-videos');

SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'hero-videos';
