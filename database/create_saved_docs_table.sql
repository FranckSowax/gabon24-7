-- Table pour stocker des documents (markdown) enregistrés par les utilisateurs
CREATE TABLE IF NOT EXISTS saved_docs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    service TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_saved_docs_user_id ON saved_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_docs_created_at ON saved_docs(created_at DESC);

-- RLS
ALTER TABLE saved_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users (demo)" ON saved_docs
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger update updated_at
CREATE OR REPLACE FUNCTION update_saved_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_saved_docs_updated_at_trigger
  BEFORE UPDATE ON saved_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_docs_updated_at();
