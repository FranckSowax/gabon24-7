-- Migration: Création table saved_proposals pour "Mes Projets"

CREATE TABLE IF NOT EXISTS saved_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  proposal_data JSONB NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  budget TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_proposals_user_id ON saved_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_proposals_created_at ON saved_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_proposals_status ON saved_proposals(status);
CREATE INDEX IF NOT EXISTS idx_saved_proposals_article_id ON saved_proposals(article_id);

ALTER TABLE saved_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own proposals" ON saved_proposals;
DROP POLICY IF EXISTS "Users can create their own proposals" ON saved_proposals;
DROP POLICY IF EXISTS "Users can update their own proposals" ON saved_proposals;
DROP POLICY IF EXISTS "Users can delete their own proposals" ON saved_proposals;

CREATE POLICY "Users can view their own proposals"
  ON saved_proposals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposals"
  ON saved_proposals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposals"
  ON saved_proposals FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proposals"
  ON saved_proposals FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_saved_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_proposals_updated_at_trigger ON saved_proposals;

CREATE TRIGGER update_saved_proposals_updated_at_trigger
  BEFORE UPDATE ON saved_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_proposals_updated_at();
