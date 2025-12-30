-- Table pour les collaborateurs de projet
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email TEXT NOT NULL,
  collaborator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- viewer, editor, admin
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '{"can_view": true, "can_comment": true, "can_edit": false, "can_add_documents": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, collaborator_email)
);

-- Table pour les commentaires de collaborateurs
CREATE TABLE IF NOT EXISTS project_collaboration_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  comment_type TEXT NOT NULL DEFAULT 'general', -- general, document, note, suggestion
  target_id UUID, -- ID du document/note ciblé si applicable
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les documents ajoutés par collaborateurs
CREATE TABLE IF NOT EXISTS project_collaboration_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email TEXT NOT NULL,
  document_title TEXT NOT NULL,
  document_content TEXT,
  document_url TEXT,
  document_type TEXT DEFAULT 'collaboration-document',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_email ON project_collaborators(collaborator_email);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_status ON project_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_project ON project_collaboration_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_user ON project_collaboration_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_documents_project ON project_collaboration_documents(project_id);

-- RLS Policies
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_documents ENABLE ROW LEVEL SECURITY;

-- Policies pour project_collaborators
CREATE POLICY "Users can view collaborations where they are owner or collaborator"
  ON project_collaborators FOR SELECT
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = collaborator_id OR
    auth.jwt() ->> 'email' = collaborator_email
  );

CREATE POLICY "Project owners can insert collaborators"
  ON project_collaborators FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Project owners can update collaborators"
  ON project_collaborators FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Project owners can delete collaborators"
  ON project_collaborators FOR DELETE
  USING (auth.uid() = owner_id);

-- Policies pour project_collaboration_comments
CREATE POLICY "Collaborators can view comments on their projects"
  ON project_collaboration_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_collaboration_comments.project_id
      AND (
        project_collaborators.collaborator_id = auth.uid() OR
        project_collaborators.owner_id = auth.uid()
      )
      AND project_collaborators.status = 'accepted'
    )
  );

CREATE POLICY "Collaborators can insert comments"
  ON project_collaboration_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_collaboration_comments.project_id
      AND project_collaborators.collaborator_id = auth.uid()
      AND project_collaborators.status = 'accepted'
      AND (project_collaborators.permissions->>'can_comment')::boolean = true
    )
  );

CREATE POLICY "Users can update their own comments"
  ON project_collaboration_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON project_collaboration_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Policies pour project_collaboration_documents
CREATE POLICY "Collaborators can view documents on their projects"
  ON project_collaboration_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_collaboration_documents.project_id
      AND (
        project_collaborators.collaborator_id = auth.uid() OR
        project_collaborators.owner_id = auth.uid()
      )
      AND project_collaborators.status = 'accepted'
    )
  );

CREATE POLICY "Collaborators can insert documents"
  ON project_collaboration_documents FOR INSERT
  WITH CHECK (
    auth.uid() = collaborator_id AND
    EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_collaboration_documents.project_id
      AND project_collaborators.collaborator_id = auth.uid()
      AND project_collaborators.status = 'accepted'
      AND (project_collaborators.permissions->>'can_add_documents')::boolean = true
    )
  );

-- Fonction pour mettre à jour last_activity_at
CREATE OR REPLACE FUNCTION update_collaborator_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_collaborators
  SET last_activity_at = NOW()
  WHERE project_id = NEW.project_id
  AND collaborator_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour mettre à jour l'activité
CREATE TRIGGER update_activity_on_comment
  AFTER INSERT ON project_collaboration_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_activity();

CREATE TRIGGER update_activity_on_document
  AFTER INSERT ON project_collaboration_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_activity();

COMMENT ON TABLE project_collaborators IS 'Gestion des collaborateurs de projets avec permissions';
COMMENT ON TABLE project_collaboration_comments IS 'Commentaires et notes des collaborateurs';
COMMENT ON TABLE project_collaboration_documents IS 'Documents ajoutés par les collaborateurs';
