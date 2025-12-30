-- Table pour les notes/commentaires sur les projets
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_project_notes_project ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_user ON project_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_created ON project_notes(created_at DESC);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_project_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_notes_updated_at
  BEFORE UPDATE ON project_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_project_notes_updated_at();

-- Commentaires
COMMENT ON TABLE project_notes IS 'Notes et commentaires des utilisateurs sur leurs projets';
COMMENT ON COLUMN project_notes.note_content IS 'Contenu de la note/commentaire';
COMMENT ON COLUMN project_notes.created_at IS 'Date de création de la note';
COMMENT ON COLUMN project_notes.updated_at IS 'Date de dernière modification';
