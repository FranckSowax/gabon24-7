-- ============================================
-- Fonctions RPC pour Analytics des Slides
-- Gestion des vues et clics sur les bannières/slides
-- ============================================

-- Fonction pour incrémenter les vues d'un slide
CREATE OR REPLACE FUNCTION increment_slide_views(slide_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Incrémenter le compteur view_count dans la table promotional_slides
  UPDATE promotional_slides
  SET 
    view_count = COALESCE(view_count, 0) + 1,
    updated_at = NOW()
  WHERE id = slide_uuid;

  -- Enregistrer l'événement dans slide_analytics
  INSERT INTO slide_analytics (
    slide_id,
    event_type,
    created_at
  ) VALUES (
    slide_uuid,
    'view',
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrémenter les clics d'un slide
CREATE OR REPLACE FUNCTION increment_slide_clicks(slide_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Incrémenter le compteur click_count dans la table promotional_slides
  UPDATE promotional_slides
  SET 
    click_count = COALESCE(click_count, 0) + 1,
    updated_at = NOW()
  WHERE id = slide_uuid;

  -- Enregistrer l'événement dans slide_analytics
  INSERT INTO slide_analytics (
    slide_id,
    event_type,
    created_at
  ) VALUES (
    slide_uuid,
    'click',
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrémenter les impressions d'un slide
-- Note: La table promotional_slides n'a pas de colonne impressions
-- Cette fonction enregistre uniquement dans slide_analytics
CREATE OR REPLACE FUNCTION increment_slide_impressions(slide_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Enregistrer l'événement dans slide_analytics
  -- (La table promotional_slides n'a pas de colonne impression_count)
  INSERT INTO slide_analytics (
    slide_id,
    event_type,
    created_at
  ) VALUES (
    slide_uuid,
    'impression',
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les stats d'un slide
CREATE OR REPLACE FUNCTION get_slide_stats(slide_uuid UUID)
RETURNS TABLE (
  views BIGINT,
  clicks BIGINT,
  impressions BIGINT,
  ctr NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(s.view_count, 0)::BIGINT as views,
    COALESCE(s.click_count, 0)::BIGINT as clicks,
    (
      SELECT COUNT(*)
      FROM slide_analytics sa
      WHERE sa.slide_id = slide_uuid AND sa.event_type = 'impression'
    )::BIGINT as impressions,
    CASE 
      WHEN COALESCE(s.view_count, 0) > 0 
      THEN ROUND((COALESCE(s.click_count, 0)::NUMERIC / s.view_count) * 100, 2)
      ELSE 0
    END as ctr
  FROM promotional_slides s
  WHERE s.id = slide_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions pour les fonctions (accessible à tous les utilisateurs authentifiés)
GRANT EXECUTE ON FUNCTION increment_slide_views(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_slide_clicks(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_slide_impressions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_slide_stats(UUID) TO authenticated;

-- Permissions pour les utilisateurs anonymes (pour le tracking public)
GRANT EXECUTE ON FUNCTION increment_slide_views(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_slide_clicks(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_slide_impressions(UUID) TO anon;
