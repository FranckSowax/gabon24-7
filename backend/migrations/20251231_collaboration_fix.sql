-- ============================================================================
-- FIX: Vérifier et corriger les tables de collaboration
-- ============================================================================

-- Supprimer les tables existantes (si partiellement créées)
DROP TABLE IF EXISTS project_share_links CASCADE;
DROP TABLE IF EXISTS project_collaboration_documents CASCADE;
DROP TABLE IF EXISTS project_collaboration_comments CASCADE;
DROP TABLE IF EXISTS project_collaborators CASCADE;

-- ============================================================================
-- Recréer les tables proprement
-- ============================================================================

-- 1. TABLE: project_collaborators
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email TEXT NOT NULL,
  collaborator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  permissions JSONB DEFAULT '{"can_view": true, "can_comment": true, "can_edit": false, "can_add_documents": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, collaborator_email)
);

-- 2. TABLE: project_collaboration_comments
CREATE TABLE project_collaboration_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  comment_type TEXT NOT NULL DEFAULT 'general',
  target_id UUID,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE: project_collaboration_documents
CREATE TABLE project_collaboration_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_email TEXT NOT NULL,
  document_title TEXT NOT NULL,
  document_content TEXT,
  document_url TEXT,
  document_type TEXT DEFAULT 'collaboration-document',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE: project_share_links
CREATE TABLE project_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEX
-- ============================================================================
CREATE INDEX idx_pc_project ON project_collaborators(project_id);
CREATE INDEX idx_pc_email ON project_collaborators(collaborator_email);
CREATE INDEX idx_pc_collab_id ON project_collaborators(collaborator_id);
CREATE INDEX idx_pc_status ON project_collaborators(status);

CREATE INDEX idx_pcc_project ON project_collaboration_comments(project_id);
CREATE INDEX idx_pcc_user ON project_collaboration_comments(user_id);

CREATE INDEX idx_pcd_project ON project_collaboration_documents(project_id);

CREATE INDEX idx_psl_token ON project_share_links(share_token);
CREATE INDEX idx_psl_project ON project_share_links(project_id);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES project_collaborators
-- ============================================================================
CREATE POLICY "pc_select" ON project_collaborators FOR SELECT USING (
  auth.uid() = owner_id OR auth.uid() = collaborator_id OR (auth.jwt() ->> 'email') = collaborator_email
);
CREATE POLICY "pc_insert" ON project_collaborators FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pc_update" ON project_collaborators FOR UPDATE USING (
  auth.uid() = owner_id OR auth.uid() = collaborator_id OR (auth.jwt() ->> 'email') = collaborator_email
);
CREATE POLICY "pc_delete" ON project_collaborators FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================================
-- POLICIES project_collaboration_comments
-- ============================================================================
CREATE POLICY "pcc_select" ON project_collaboration_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM saved_projects sp WHERE sp.id = project_id AND sp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id = project_collaboration_comments.project_id AND pc.collaborator_id = auth.uid() AND pc.status = 'accepted')
);
CREATE POLICY "pcc_insert" ON project_collaboration_comments FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM saved_projects sp WHERE sp.id = project_id AND sp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id = project_collaboration_comments.project_id AND pc.collaborator_id = auth.uid() AND pc.status = 'accepted')
  )
);
CREATE POLICY "pcc_update" ON project_collaboration_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pcc_delete" ON project_collaboration_comments FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- POLICIES project_collaboration_documents
-- ============================================================================
CREATE POLICY "pcd_select" ON project_collaboration_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM saved_projects sp WHERE sp.id = project_id AND sp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id = project_collaboration_documents.project_id AND pc.collaborator_id = auth.uid() AND pc.status = 'accepted')
);
CREATE POLICY "pcd_insert" ON project_collaboration_documents FOR INSERT WITH CHECK (
  auth.uid() = collaborator_id AND (
    EXISTS (SELECT 1 FROM saved_projects sp WHERE sp.id = project_id AND sp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id = project_collaboration_documents.project_id AND pc.collaborator_id = auth.uid() AND pc.status = 'accepted')
  )
);

-- ============================================================================
-- POLICIES project_share_links
-- ============================================================================
CREATE POLICY "psl_owner" ON project_share_links FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "psl_public" ON project_share_links FOR SELECT USING (is_active = true);

-- ============================================================================
-- TERMINÉ
-- ============================================================================
