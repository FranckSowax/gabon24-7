-- Table pour stocker les résumés audio générés
CREATE TABLE IF NOT EXISTS audio_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_type VARCHAR(20) NOT NULL CHECK (summary_type IN ('daily', 'custom')),
  article_ids UUID[] NOT NULL,
  articles_count INTEGER NOT NULL DEFAULT 0,
  text_summary TEXT,
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  whatsapp_sent BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'synthesizing_audio', 'uploading_audio', 'sending_whatsapp', 'finalizing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par utilisateur
CREATE INDEX IF NOT EXISTS idx_audio_summaries_user_id ON audio_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_summaries_created_at ON audio_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_summaries_status ON audio_summaries(status);

-- Table pour les paramètres audio utilisateur
CREATE TABLE IF NOT EXISTS audio_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  voice VARCHAR(50) DEFAULT 'alloy',
  speed DECIMAL(3,2) DEFAULT 1.0,
  auto_play BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par utilisateur
CREATE INDEX IF NOT EXISTS idx_audio_settings_user_id ON audio_settings(user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_audio_summaries_updated_at ON audio_summaries;
CREATE TRIGGER update_audio_summaries_updated_at
    BEFORE UPDATE ON audio_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audio_settings_updated_at ON audio_settings;
CREATE TRIGGER update_audio_settings_updated_at
    BEFORE UPDATE ON audio_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) pour audio_summaries
ALTER TABLE audio_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audio summaries" ON audio_summaries;
CREATE POLICY "Users can view their own audio summaries"
  ON audio_summaries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own audio summaries" ON audio_summaries;
CREATE POLICY "Users can insert their own audio summaries"
  ON audio_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS pour audio_settings
ALTER TABLE audio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audio settings" ON audio_settings;
CREATE POLICY "Users can view their own audio settings"
  ON audio_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own audio settings" ON audio_settings;
CREATE POLICY "Users can update their own audio settings"
  ON audio_settings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own audio settings" ON audio_settings;
CREATE POLICY "Users can insert their own audio settings"
  ON audio_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE audio_summaries IS 'Résumés audio quotidiens et personnalisés générés pour les utilisateurs';
COMMENT ON TABLE audio_settings IS 'Paramètres de génération audio personnalisés par utilisateur';
