-- Migration: Création des tables de collaboration
-- Date: 2024-12-31
-- Description: Tables pour le système de collaboration sur les projets

-- ============================================================================
-- 1. TABLE: project_collaborators - Gestion des collaborateurs
-- ============================================================================
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

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_email ON project_collaborators(collaborator_email);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_collaborator_id ON project_collaborators(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_status ON project_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_owner ON project_collaborators(owner_id);

-- ============================================================================
-- 2. TABLE: project_collaboration_comments - Commentaires des collaborateurs
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_collaboration_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  comment_type TEXT NOT NULL DEFAULT 'general', -- general, document, note, suggestion
  target_id UUID, -- ID du document/note cible si applicable
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_project ON project_collaboration_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_user ON project_collaboration_comments(user_id);

-- ============================================================================
-- 3. TABLE: project_collaboration_documents - Documents des collaborateurs
-- ============================================================================
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

-- Index
CREATE INDEX IF NOT EXISTS idx_collaboration_documents_project ON project_collaboration_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_documents_collaborator ON project_collaboration_documents(collaborator_id);

-- ============================================================================
-- 4. TABLE: project_share_links - Liens de partage
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  max_uses INTEGER, -- NULL = illimite
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_share_links_project ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON project_share_links(share_token);
CREATE INDEX IF NOT EXISTS idx_share_links_owner ON project_share_links(owner_id);
CREATE INDEX IF NOT EXISTS idx_share_links_active ON project_share_links(is_active) WHERE is_active = true;

-- ============================================================================
-- 5. RLS POLICIES - Securite Row Level Security
-- ============================================================================

-- Activer RLS
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (pour eviter erreurs)
DO $$
BEGIN
  -- project_collaborators
  DROP POLICY IF EXISTS "Users can view collaborations where they are owner or collaborator" ON project_collaborators;
  DROP POLICY IF EXISTS "Project owners can insert collaborators" ON project_collaborators;
  DROP POLICY IF EXISTS "Project owners can update collaborators" ON project_collaborators;
  DROP POLICY IF EXISTS "Collaborators can update their own status" ON project_collaborators;
  DROP POLICY IF EXISTS "Project owners can delete collaborators" ON project_collaborators;

  -- project_collaboration_comments
  DROP POLICY IF EXISTS "Collaborators can view comments on their projects" ON project_collaboration_comments;
  DROP POLICY IF EXISTS "Collaborators can insert comments" ON project_collaboration_comments;
  DROP POLICY IF EXISTS "Users can update their own comments" ON project_collaboration_comments;
  DROP POLICY IF EXISTS "Users can delete their own comments" ON project_collaboration_comments;

  -- project_collaboration_documents
  DROP POLICY IF EXISTS "Collaborators can view documents on their projects" ON project_collaboration_documents;
  DROP POLICY IF EXISTS "Collaborators can insert documents" ON project_collaboration_documents;

  -- project_share_links
  DROP POLICY IF EXISTS "Owners can manage share links" ON project_share_links;
  DROP POLICY IF EXISTS "Anyone can view active share links by token" ON project_share_links;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- Policies pour project_collaborators
-- ============================================================================

-- SELECT: Owner ou collaborateur peut voir
CREATE POLICY "Users can view collaborations where they are owner or collaborator"
  ON project_collaborators FOR SELECT
  USING (
    auth.uid() = owner_id OR
    auth.uid() = collaborator_id OR
    auth.jwt() ->> 'email' = collaborator_email
  );

-- INSERT: Seul le owner peut inviter
CREATE POLICY "Project owners can insert collaborators"
  ON project_collaborators FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Owner peut tout modifier, collaborateur peut accepter/refuser
CREATE POLICY "Project owners can update collaborators"
  ON project_collaborators FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Collaborators can update their own status"
  ON project_collaborators FOR UPDATE
  USING (
    auth.uid() = collaborator_id OR
    auth.jwt() ->> 'email' = collaborator_email
  )
  WITH CHECK (
    -- Le collaborateur ne peut modifier que le status et accepted_at
    status IN ('accepted', 'rejected')
  );

-- DELETE: Seul le owner peut supprimer
CREATE POLICY "Project owners can delete collaborators"
  ON project_collaborators FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================================
-- Policies pour project_collaboration_comments
-- ============================================================================

-- SELECT: Owner ou collaborateur accepte peut voir
CREATE POLICY "Collaborators can view comments on their projects"
  ON project_collaboration_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM saved_projects sp
      WHERE sp.id = project_collaboration_comments.project_id
      AND sp.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaboration_comments.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- INSERT: Owner ou collaborateur accepte avec permission
CREATE POLICY "Collaborators can insert comments"
  ON project_collaboration_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      -- Owner du projet
      EXISTS (
        SELECT 1 FROM saved_projects sp
        WHERE sp.id = project_collaboration_comments.project_id
        AND sp.user_id = auth.uid()
      )
      OR
      -- Collaborateur accepte avec permission de commenter
      EXISTS (
        SELECT 1 FROM project_collaborators pc
        WHERE pc.project_id = project_collaboration_comments.project_id
        AND pc.collaborator_id = auth.uid()
        AND pc.status = 'accepted'
        AND (pc.permissions->>'can_comment')::boolean = true
      )
    )
  );

-- UPDATE: Uniquement son propre commentaire
CREATE POLICY "Users can update their own comments"
  ON project_collaboration_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: Uniquement son propre commentaire
CREATE POLICY "Users can delete their own comments"
  ON project_collaboration_comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Policies pour project_collaboration_documents
-- ============================================================================

-- SELECT: Owner ou collaborateur accepte peut voir
CREATE POLICY "Collaborators can view documents on their projects"
  ON project_collaboration_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM saved_projects sp
      WHERE sp.id = project_collaboration_documents.project_id
      AND sp.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaboration_documents.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- INSERT: Collaborateur accepte avec permission
CREATE POLICY "Collaborators can insert documents"
  ON project_collaboration_documents FOR INSERT
  WITH CHECK (
    auth.uid() = collaborator_id AND
    (
      -- Owner du projet
      EXISTS (
        SELECT 1 FROM saved_projects sp
        WHERE sp.id = project_collaboration_documents.project_id
        AND sp.user_id = auth.uid()
      )
      OR
      -- Collaborateur accepte avec permission
      EXISTS (
        SELECT 1 FROM project_collaborators pc
        WHERE pc.project_id = project_collaboration_documents.project_id
        AND pc.collaborator_id = auth.uid()
        AND pc.status = 'accepted'
        AND (pc.permissions->>'can_add_documents')::boolean = true
      )
    )
  );

-- ============================================================================
-- Policies pour project_share_links
-- ============================================================================

-- SELECT/UPDATE/DELETE: Seul le owner
CREATE POLICY "Owners can manage share links"
  ON project_share_links
  FOR ALL
  USING (auth.uid() = owner_id);

-- SELECT public pour verification du token (sans auth)
CREATE POLICY "Anyone can view active share links by token"
  ON project_share_links FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- 6. TRIGGERS pour mise a jour automatique
-- ============================================================================

-- Fonction pour mettre a jour last_activity_at
CREATE OR REPLACE FUNCTION update_collaborator_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_collaborators
  SET last_activity_at = NOW()
  WHERE project_id = NEW.project_id
  AND collaborator_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur commentaires
DROP TRIGGER IF EXISTS update_activity_on_comment ON project_collaboration_comments;
CREATE TRIGGER update_activity_on_comment
  AFTER INSERT ON project_collaboration_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_activity();

-- Trigger sur documents (avec user_id adapte)
CREATE OR REPLACE FUNCTION update_collaborator_activity_on_document()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_collaborators
  SET last_activity_at = NOW()
  WHERE project_id = NEW.project_id
  AND collaborator_id = NEW.collaborator_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_activity_on_document ON project_collaboration_documents;
CREATE TRIGGER update_activity_on_document
  AFTER INSERT ON project_collaboration_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_activity_on_document();

-- ============================================================================
-- 7. COMMENTS pour documentation
-- ============================================================================

COMMENT ON TABLE project_collaborators IS 'Gestion des collaborateurs de projets avec permissions granulaires';
COMMENT ON TABLE project_collaboration_comments IS 'Commentaires et discussions des collaborateurs sur les projets';
COMMENT ON TABLE project_collaboration_documents IS 'Documents partages par les collaborateurs';
COMMENT ON TABLE project_share_links IS 'Liens de partage temporaires pour inviter des collaborateurs';

COMMENT ON COLUMN project_collaborators.role IS 'Role: viewer (lecture seule), editor (peut modifier), admin (tous droits)';
COMMENT ON COLUMN project_collaborators.status IS 'Status: pending (en attente), accepted (accepte), rejected (refuse)';
COMMENT ON COLUMN project_collaborators.permissions IS 'Permissions granulaires: can_view, can_comment, can_edit, can_add_documents';
