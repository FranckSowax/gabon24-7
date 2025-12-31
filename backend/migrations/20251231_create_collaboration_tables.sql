-- Migration: Création des tables de collaboration
-- Date: 2024-12-31
-- Description: Tables pour le système de collaboration sur les projets
-- IMPORTANT: Exécuter ce script dans Supabase SQL Editor

-- ============================================================================
-- ÉTAPE 1: Créer les tables
-- ============================================================================

-- 1. TABLE: project_collaborators - Gestion des collaborateurs
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email TEXT NOT NULL,
  collaborator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '{"can_view": true, "can_comment": true, "can_edit": false, "can_add_documents": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, collaborator_email)
);

-- 2. TABLE: project_collaboration_comments
CREATE TABLE IF NOT EXISTS project_collaboration_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  comment_type TEXT NOT NULL DEFAULT 'general',
  target_id UUID,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLE: project_collaboration_documents
CREATE TABLE IF NOT EXISTS project_collaboration_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 4. TABLE: project_share_links
CREATE TABLE IF NOT EXISTS project_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ÉTAPE 2: Créer les index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_email ON project_collaborators(collaborator_email);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_collaborator_id ON project_collaborators(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_status ON project_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_owner ON project_collaborators(owner_id);

CREATE INDEX IF NOT EXISTS idx_collaboration_comments_project ON project_collaboration_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_comments_user ON project_collaboration_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_collaboration_documents_project ON project_collaboration_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_documents_collaborator ON project_collaboration_documents(collaborator_id);

CREATE INDEX IF NOT EXISTS idx_share_links_project ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON project_share_links(share_token);
CREATE INDEX IF NOT EXISTS idx_share_links_owner ON project_share_links(owner_id);

-- ============================================================================
-- ÉTAPE 3: Activer RLS
-- ============================================================================

ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ÉTAPE 4: Policies pour project_collaborators
-- ============================================================================

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "pc_select_policy" ON project_collaborators;
DROP POLICY IF EXISTS "pc_insert_policy" ON project_collaborators;
DROP POLICY IF EXISTS "pc_update_owner_policy" ON project_collaborators;
DROP POLICY IF EXISTS "pc_update_collab_policy" ON project_collaborators;
DROP POLICY IF EXISTS "pc_delete_policy" ON project_collaborators;

-- SELECT: Owner, collaborateur assigné, ou email correspondant
CREATE POLICY "pc_select_policy" ON project_collaborators
  FOR SELECT USING (
    auth.uid() = owner_id
    OR auth.uid() = collaborator_id
    OR (auth.jwt() ->> 'email') = collaborator_email
  );

-- INSERT: Seul le owner peut inviter
CREATE POLICY "pc_insert_policy" ON project_collaborators
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Owner peut tout modifier
CREATE POLICY "pc_update_owner_policy" ON project_collaborators
  FOR UPDATE USING (auth.uid() = owner_id);

-- UPDATE: Collaborateur peut accepter/refuser
CREATE POLICY "pc_update_collab_policy" ON project_collaborators
  FOR UPDATE USING (
    auth.uid() = collaborator_id
    OR (auth.jwt() ->> 'email') = collaborator_email
  );

-- DELETE: Seul le owner
CREATE POLICY "pc_delete_policy" ON project_collaborators
  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================================
-- ÉTAPE 5: Policies pour project_collaboration_comments
-- ============================================================================

DROP POLICY IF EXISTS "pcc_select_policy" ON project_collaboration_comments;
DROP POLICY IF EXISTS "pcc_insert_policy" ON project_collaboration_comments;
DROP POLICY IF EXISTS "pcc_update_policy" ON project_collaboration_comments;
DROP POLICY IF EXISTS "pcc_delete_policy" ON project_collaboration_comments;

-- SELECT: Owner du projet ou collaborateur accepté
CREATE POLICY "pcc_select_policy" ON project_collaboration_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_projects sp
      WHERE sp.id = project_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaboration_comments.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- INSERT: Owner ou collaborateur accepté
CREATE POLICY "pcc_insert_policy" ON project_collaboration_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM saved_projects sp
        WHERE sp.id = project_id AND sp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_collaborators pc
        WHERE pc.project_id = project_collaboration_comments.project_id
        AND pc.collaborator_id = auth.uid()
        AND pc.status = 'accepted'
      )
    )
  );

-- UPDATE/DELETE: Son propre commentaire
CREATE POLICY "pcc_update_policy" ON project_collaboration_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pcc_delete_policy" ON project_collaboration_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- ÉTAPE 6: Policies pour project_collaboration_documents
-- ============================================================================

DROP POLICY IF EXISTS "pcd_select_policy" ON project_collaboration_documents;
DROP POLICY IF EXISTS "pcd_insert_policy" ON project_collaboration_documents;

-- SELECT: Owner du projet ou collaborateur accepté
CREATE POLICY "pcd_select_policy" ON project_collaboration_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_projects sp
      WHERE sp.id = project_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaboration_documents.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- INSERT: Owner ou collaborateur accepté
CREATE POLICY "pcd_insert_policy" ON project_collaboration_documents
  FOR INSERT WITH CHECK (
    auth.uid() = collaborator_id
    AND (
      EXISTS (
        SELECT 1 FROM saved_projects sp
        WHERE sp.id = project_id AND sp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_collaborators pc
        WHERE pc.project_id = project_collaboration_documents.project_id
        AND pc.collaborator_id = auth.uid()
        AND pc.status = 'accepted'
      )
    )
  );

-- ============================================================================
-- ÉTAPE 7: Policies pour project_share_links
-- ============================================================================

DROP POLICY IF EXISTS "psl_owner_policy" ON project_share_links;
DROP POLICY IF EXISTS "psl_public_select_policy" ON project_share_links;

-- Owner peut tout faire
CREATE POLICY "psl_owner_policy" ON project_share_links
  FOR ALL USING (auth.uid() = owner_id);

-- Tout le monde peut voir les liens actifs (pour validation du token)
CREATE POLICY "psl_public_select_policy" ON project_share_links
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- ÉTAPE 8: Triggers pour last_activity_at
-- ============================================================================

-- Fonction pour mettre à jour last_activity_at sur commentaires
CREATE OR REPLACE FUNCTION update_collaborator_activity_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_collaborators
  SET last_activity_at = NOW()
  WHERE project_id = NEW.project_id
  AND collaborator_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_activity_on_comment ON project_collaboration_comments;
CREATE TRIGGER trg_update_activity_on_comment
  AFTER INSERT ON project_collaboration_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_activity_on_comment();

-- Fonction pour mettre à jour last_activity_at sur documents
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

DROP TRIGGER IF EXISTS trg_update_activity_on_document ON project_collaboration_documents;
CREATE TRIGGER trg_update_activity_on_document
  AFTER INSERT ON project_collaboration_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_collaborator_activity_on_document();

-- ============================================================================
-- TERMINÉ
-- ============================================================================
-- Tables créées:
-- - project_collaborators (avec RLS)
-- - project_collaboration_comments (avec RLS)
-- - project_collaboration_documents (avec RLS)
-- - project_share_links (avec RLS)
