-- Table pour stocker les événements du flux RSS
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  url TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  organizer TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_active ON events(is_active);
CREATE INDEX idx_events_created_at ON events(created_at);

-- RLS (Row Level Security)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture publique
CREATE POLICY "Events are viewable by everyone" ON events
  FOR SELECT USING (true);

-- Politique pour permettre l'insertion par le service
CREATE POLICY "Events can be inserted by service role" ON events
  FOR INSERT WITH CHECK (true);

-- Politique pour permettre la mise à jour par le service
CREATE POLICY "Events can be updated by service role" ON events
  FOR UPDATE USING (true);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_events_updated_at_trigger
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_events_updated_at();
