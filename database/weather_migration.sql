-- Migration pour créer la table weather_data
-- Cette table stockera les données météo récupérées 2 fois par jour

CREATE TABLE IF NOT EXISTS weather_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  temperature DECIMAL(5,2) NOT NULL, -- Température en Celsius
  feels_like DECIMAL(5,2),
  humidity INTEGER,
  pressure INTEGER,
  visibility INTEGER,
  uv_index DECIMAL(3,1),
  wind_speed DECIMAL(5,2),
  wind_direction INTEGER,
  weather_condition VARCHAR(50) NOT NULL, -- clear, clouds, rain, etc.
  weather_description TEXT,
  weather_icon VARCHAR(10),
  sunrise TIMESTAMP WITH TIME ZONE,
  sunset TIMESTAMP WITH TIME ZONE,
  forecast JSONB, -- Prévisions pour les prochains jours
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_weather_data_city ON weather_data(city);
CREATE INDEX IF NOT EXISTS idx_weather_data_created_at ON weather_data(created_at);
CREATE INDEX IF NOT EXISTS idx_weather_data_city_created_at ON weather_data(city, created_at);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_weather_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER trigger_update_weather_data_updated_at
  BEFORE UPDATE ON weather_data
  FOR EACH ROW
  EXECUTE FUNCTION update_weather_data_updated_at();

-- Politique RLS (Row Level Security)
ALTER TABLE weather_data ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to weather data" ON weather_data
  FOR SELECT USING (true);

-- Politique pour permettre l'insertion/mise à jour uniquement via service role
CREATE POLICY "Allow insert/update for service role" ON weather_data
  FOR ALL USING (auth.role() = 'service_role');

-- Commentaires pour la documentation
COMMENT ON TABLE weather_data IS 'Table pour stocker les données météorologiques récupérées 2 fois par jour';
COMMENT ON COLUMN weather_data.city IS 'Nom de la ville';
COMMENT ON COLUMN weather_data.temperature IS 'Température actuelle en Celsius';
COMMENT ON COLUMN weather_data.forecast IS 'Prévisions météo au format JSON';
COMMENT ON COLUMN weather_data.created_at IS 'Date de création de l''enregistrement';
