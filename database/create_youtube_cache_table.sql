-- Table pour stocker la dernière vidéo YouTube extraite
CREATE TABLE IF NOT EXISTS youtube_cache (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(255) NOT NULL UNIQUE,
  title TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  duration VARCHAR(50),
  channel_name VARCHAR(255) DEFAULT 'Gabon Télévision',
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_youtube_cache_active ON youtube_cache(is_active);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_extracted_at ON youtube_cache(extracted_at DESC);

-- RLS (Row Level Security)
ALTER TABLE youtube_cache ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous
CREATE POLICY "Allow read access to all users" ON youtube_cache
  FOR SELECT USING (true);

-- Politique pour permettre l'insertion/mise à jour (pour le backend)
CREATE POLICY "Allow insert/update for service role" ON youtube_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Fonction pour nettoyer les anciennes entrées (garder seulement les 10 dernières)
CREATE OR REPLACE FUNCTION cleanup_youtube_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM youtube_cache 
  WHERE id NOT IN (
    SELECT id FROM youtube_cache 
    ORDER BY extracted_at DESC 
    LIMIT 10
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger pour nettoyer automatiquement après insertion
CREATE OR REPLACE FUNCTION trigger_cleanup_youtube_cache()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM cleanup_youtube_cache();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_youtube_cache_insert
  AFTER INSERT ON youtube_cache
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_youtube_cache();
