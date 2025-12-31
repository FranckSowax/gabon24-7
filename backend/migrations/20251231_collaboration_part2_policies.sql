-- ============================================================================
-- PARTIE 2: Policies RLS (exécuter APRÈS la partie 1)
-- ============================================================================

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "pc_select" ON project_collaborators;
DROP POLICY IF EXISTS "pc_insert" ON project_collaborators;
DROP POLICY IF EXISTS "pc_update" ON project_collaborators;
DROP POLICY IF EXISTS "pc_delete" ON project_collaborators;

DROP POLICY IF EXISTS "pcc_select" ON project_collaboration_comments;
DROP POLICY IF EXISTS "pcc_insert" ON project_collaboration_comments;
DROP POLICY IF EXISTS "pcc_update" ON project_collaboration_comments;
DROP POLICY IF EXISTS "pcc_delete" ON project_collaboration_comments;

DROP POLICY IF EXISTS "pcd_select" ON project_collaboration_documents;
DROP POLICY IF EXISTS "pcd_insert" ON project_collaboration_documents;

DROP POLICY IF EXISTS "psl_all" ON project_share_links;
DROP POLICY IF EXISTS "psl_select" ON project_share_links;

-- ============================================================================
-- POLICIES: project_collaborators
-- ============================================================================

CREATE POLICY "pc_select" ON project_collaborators
  FOR SELECT USING (
    auth.uid() = owner_id
    OR auth.uid() = collaborator_id
    OR (auth.jwt() ->> 'email') = collaborator_email
  );

CREATE POLICY "pc_insert" ON project_collaborators
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "pc_update" ON project_collaborators
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR auth.uid() = collaborator_id
    OR (auth.jwt() ->> 'email') = collaborator_email
  );

CREATE POLICY "pc_delete" ON project_collaborators
  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================================
-- POLICIES: project_collaboration_comments
-- ============================================================================

CREATE POLICY "pcc_select" ON project_collaboration_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_projects sp
      WHERE sp.id = project_collaboration_comments.project_id
      AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaboration_comments.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

CREATE POLICY "pcc_insert" ON project_collaboration_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM saved_projects sp
        WHERE sp.id = project_collaboration_comments.project_id
        AND sp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_collaborators pc
        WHERE pc.project_id = project_collaboration_comments.project_id
        AND pc.collaborator_id = auth.uid()
        AND pc.status = 'accepted'
      )
    )
  );

CREATE POLICY "pcc_update" ON project_collaboration_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "pcc_delete" ON project_collaboration_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- POLICIES: project_collaboration_documents
-- ============================================================================

CREATE POLICY "pcd_select" ON project_collaboration_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM saved_projects sp
      WHERE sp.id = project_collaboration_documents.project_id
      AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = project_collaboration_documents.project_id
      AND pc.collaborator_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

CREATE POLICY "pcd_insert" ON project_collaboration_documents
  FOR INSERT WITH CHECK (
    auth.uid() = collaborator_id
    AND (
      EXISTS (
        SELECT 1 FROM saved_projects sp
        WHERE sp.id = project_collaboration_documents.project_id
        AND sp.user_id = auth.uid()
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
-- POLICIES: project_share_links
-- ============================================================================

CREATE POLICY "psl_all" ON project_share_links
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "psl_select" ON project_share_links
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- FIN PARTIE 2
-- ============================================================================
