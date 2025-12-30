-- ====================================================================
-- FONCTION POUR TRACKING CLICS BANNIÈRES BUSINESS
-- ====================================================================

-- Fonction pour incrémenter le compteur de clics
CREATE OR REPLACE FUNCTION increment_banner_clicks(banner_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE business_banners
  SET clicks_count = clicks_count + 1
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrémenter le compteur de vues
CREATE OR REPLACE FUNCTION increment_banner_views(banner_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE business_banners
  SET views_count = views_count + 1
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions
GRANT EXECUTE ON FUNCTION increment_banner_clicks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_banner_clicks(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_banner_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_banner_views(UUID) TO anon;
