-- Migration pour corriger le système de sondages
-- Limiter les sondages à 3 options maximum et corriger les calculs de pourcentages

-- 1. Supprimer les anciens sondages de test avec plus de 3 options
DELETE FROM poll_responses WHERE poll_id IN (
  SELECT id FROM polls WHERE jsonb_array_length(options) > 3
);
DELETE FROM poll_stats WHERE poll_id IN (
  SELECT id FROM polls WHERE jsonb_array_length(options) > 3
);
DELETE FROM polls WHERE jsonb_array_length(options) > 3;

-- 2. Créer un nouveau sondage avec exactement 3 options
INSERT INTO polls (question, poll_type, options, is_active, expires_at) 
VALUES (
  'Quelle mesure pourrait le mieux lutter contre le chômage des jeunes au Gabon ?',
  'mcq',
  '["Formation professionnelle renforcée", "Création d''entreprises facilitée", "Secteur numérique et tech"]'::jsonb,
  true,
  NOW() + INTERVAL '24 hours'
) ON CONFLICT DO NOTHING;

-- 3. Améliorer la fonction de calcul des pourcentages pour garantir un total de 100%
CREATE OR REPLACE FUNCTION update_poll_stats()
RETURNS TRIGGER AS $$
DECLARE
  total_count INTEGER;
  remaining_percentage DECIMAL(5,2);
  last_response_value TEXT;
BEGIN
  -- Recalculer les statistiques pour ce sondage
  WITH vote_counts AS (
    SELECT 
      response_value,
      COUNT(*) as count
    FROM poll_responses 
    WHERE poll_id = COALESCE(NEW.poll_id, OLD.poll_id)
    GROUP BY response_value
  ),
  total_votes AS (
    SELECT SUM(count) as total FROM vote_counts
  ),
  percentages AS (
    SELECT 
      vc.response_value,
      vc.count,
      tv.total,
      CASE 
        WHEN tv.total > 0 THEN ROUND((vc.count::decimal / tv.total) * 100, 1)
        ELSE 0 
      END as calculated_percentage
    FROM vote_counts vc
    CROSS JOIN total_votes tv
  ),
  adjusted_percentages AS (
    SELECT 
      response_value,
      count,
      total,
      calculated_percentage,
      -- Ajuster le dernier pourcentage pour que le total soit exactement 100%
      CASE 
        WHEN ROW_NUMBER() OVER (ORDER BY count DESC, response_value) = 
             COUNT(*) OVER () 
        THEN 100.0 - SUM(calculated_percentage) OVER () + calculated_percentage
        ELSE calculated_percentage
      END as final_percentage
    FROM percentages
  )
  INSERT INTO poll_stats (poll_id, response_value, vote_count, percentage)
  SELECT 
    COALESCE(NEW.poll_id, OLD.poll_id),
    ap.response_value,
    ap.count,
    GREATEST(0, ap.final_percentage) -- Éviter les pourcentages négatifs
  FROM adjusted_percentages ap
  ON CONFLICT (poll_id, response_value) 
  DO UPDATE SET 
    vote_count = EXCLUDED.vote_count,
    percentage = EXCLUDED.percentage,
    updated_at = NOW();

  -- Mettre à jour le total des votes dans la table polls
  UPDATE polls 
  SET total_votes = (
    SELECT COUNT(*) FROM poll_responses WHERE poll_id = COALESCE(NEW.poll_id, OLD.poll_id)
  )
  WHERE id = COALESCE(NEW.poll_id, OLD.poll_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. Ajouter une contrainte pour limiter les options à 3 maximum
ALTER TABLE polls ADD CONSTRAINT check_max_3_options 
CHECK (jsonb_array_length(options) <= 3);

-- 5. Recalculer les statistiques existantes
DO $$
DECLARE
  poll_record RECORD;
BEGIN
  FOR poll_record IN SELECT id FROM polls WHERE is_active = true LOOP
    -- Déclencher le recalcul des stats
    UPDATE poll_stats SET updated_at = NOW() 
    WHERE poll_id = poll_record.id;
  END LOOP;
END $$;
