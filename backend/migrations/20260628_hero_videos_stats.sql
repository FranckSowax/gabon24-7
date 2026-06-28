-- =====================================================
-- Stats des vidéos d'accueil : vues (impressions) + clics CTA
-- À exécuter dans Supabase → SQL Editor (après 20260628_create_hero_videos.sql).
-- =====================================================

ALTER TABLE hero_videos ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE hero_videos ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- Incrément atomique (évite les races read-modify-write)
CREATE OR REPLACE FUNCTION increment_hero_video_stat(p_id uuid, p_field text)
RETURNS void AS $$
BEGIN
  IF p_field = 'click' THEN
    UPDATE hero_videos SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_id;
  ELSIF p_field = 'view' THEN
    UPDATE hero_videos SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
