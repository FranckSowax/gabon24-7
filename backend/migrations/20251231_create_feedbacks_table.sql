-- Migration: Créer la table feedbacks si elle n'existe pas
-- Date: 2025-12-31
-- Description: Table pour stocker les feedbacks des utilisateurs

-- Créer la table feedbacks
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('general', 'bug', 'feature')),
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_type ON feedbacks(type);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_feedbacks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedbacks_updated_at_trigger ON feedbacks;
CREATE TRIGGER feedbacks_updated_at_trigger
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_feedbacks_updated_at();

-- RLS (Row Level Security)
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Politique: Les admins peuvent tout voir
CREATE POLICY IF NOT EXISTS "Admins can view all feedbacks"
  ON feedbacks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Politique: Les utilisateurs peuvent créer des feedbacks
CREATE POLICY IF NOT EXISTS "Users can create feedbacks"
  ON feedbacks FOR INSERT
  WITH CHECK (true);

-- Politique: Les admins peuvent mettre à jour les feedbacks
CREATE POLICY IF NOT EXISTS "Admins can update feedbacks"
  ON feedbacks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Afficher la structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'feedbacks'
ORDER BY ordinal_position;
