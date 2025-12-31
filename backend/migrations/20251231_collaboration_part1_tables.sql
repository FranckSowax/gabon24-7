-- ============================================================================
-- PARTIE 1: Création des tables et index (exécuter en premier)
-- ============================================================================

-- 1. TABLE: project_collaborators
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

-- INDEX
CREATE INDEX IF NOT EXISTS idx_pc_project ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_pc_email ON project_collaborators(collaborator_email);
CREATE INDEX IF NOT EXISTS idx_pc_collab_id ON project_collaborators(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_pc_status ON project_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_pc_owner ON project_collaborators(owner_id);

CREATE INDEX IF NOT EXISTS idx_pcc_project ON project_collaboration_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_pcc_user ON project_collaboration_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_pcd_project ON project_collaboration_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_pcd_collab ON project_collaboration_documents(collaborator_id);

CREATE INDEX IF NOT EXISTS idx_psl_project ON project_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_psl_token ON project_share_links(share_token);
CREATE INDEX IF NOT EXISTS idx_psl_owner ON project_share_links(owner_id);

-- Activer RLS
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaboration_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_share_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIN PARTIE 1 - Exécuter PARTIE 2 après cette partie
-- ============================================================================
