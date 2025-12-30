-- Migration: Création table saved_documents pour "Mes Projets"

CREATE TABLE IF NOT EXISTS saved_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('business_plan', 'pitch_deck', 'financial_projection', 'market_study', 'other')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_documents_user_id ON saved_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_documents_created_at ON saved_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_documents_type ON saved_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_saved_documents_status ON saved_documents(status);

ALTER TABLE saved_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own documents" ON saved_documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON saved_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON saved_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON saved_documents;

CREATE POLICY "Users can view their own documents"
  ON saved_documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
  ON saved_documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON saved_documents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON saved_documents FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_saved_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_documents_updated_at_trigger ON saved_documents;

CREATE TRIGGER update_saved_documents_updated_at_trigger
  BEFORE UPDATE ON saved_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_documents_updated_at();
