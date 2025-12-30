-- Migration pour créer la table des sondages
-- Créer la table polls pour stocker les questions de sondage
CREATE TABLE IF NOT EXISTS polls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  poll_type VARCHAR(10) NOT NULL CHECK (poll_type IN ('yes_no', 'mcq')),
  options JSONB DEFAULT '[]'::jsonb, -- Pour les QCM, stocke les options
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  is_active BOOLEAN DEFAULT true,
  based_on_article_id TEXT, -- Référence à l'article qui a inspiré la question
  total_votes INTEGER DEFAULT 0
);

-- Créer la table poll_responses pour stocker les réponses
CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  response_value TEXT NOT NULL, -- 'yes', 'no' ou l'option choisie pour QCM
  user_fingerprint TEXT, -- Empreinte anonyme pour éviter les votes multiples
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer la table poll_stats pour les statistiques agrégées
CREATE TABLE IF NOT EXISTS poll_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  response_value TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, response_value)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_polls_active ON polls(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_id ON poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_fingerprint ON poll_responses(user_fingerprint);
CREATE INDEX IF NOT EXISTS idx_poll_stats_poll_id ON poll_stats(poll_id);

-- Fonction pour mettre à jour les statistiques automatiquement
CREATE OR REPLACE FUNCTION update_poll_stats()
RETURNS TRIGGER AS $$
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
  )
  INSERT INTO poll_stats (poll_id, response_value, vote_count, percentage)
  SELECT 
    COALESCE(NEW.poll_id, OLD.poll_id),
    vc.response_value,
    vc.count,
    CASE WHEN tv.total > 0 THEN ROUND((vc.count::decimal / tv.total) * 100, 2) ELSE 0 END
  FROM vote_counts vc
  CROSS JOIN total_votes tv
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

-- Trigger pour mettre à jour les stats automatiquement
DROP TRIGGER IF EXISTS trigger_update_poll_stats ON poll_responses;
CREATE TRIGGER trigger_update_poll_stats
  AFTER INSERT OR DELETE ON poll_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_stats();

-- RLS (Row Level Security) pour sécuriser l'accès
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_stats ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture des sondages actifs
CREATE POLICY "Allow read active polls" ON polls
  FOR SELECT USING (is_active = true AND expires_at > NOW());

-- Politique pour permettre l'insertion de réponses
CREATE POLICY "Allow insert poll responses" ON poll_responses
  FOR INSERT WITH CHECK (true);

-- Politique pour permettre la lecture des statistiques
CREATE POLICY "Allow read poll stats" ON poll_stats
  FOR SELECT USING (true);

-- Insérer un sondage de test
INSERT INTO polls (question, poll_type, options, based_on_article_id) 
VALUES (
  'Pensez-vous que les nouvelles technologies amélioreront la vie des Gabonais dans les 5 prochaines années ?',
  'yes_no',
  '[]'::jsonb,
  'sample_article_id'
) ON CONFLICT DO NOTHING;
