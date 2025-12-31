-- ============================================
-- 🔗 ADD project_id TO ai_trainings
-- Permet de lier directement les formations aux projets
-- ============================================

-- Ajouter la colonne project_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_trainings' AND column_name = 'project_id') THEN
        ALTER TABLE ai_trainings ADD COLUMN project_id UUID;
        RAISE NOTICE 'Colonne project_id ajoutée à ai_trainings';
    ELSE
        RAISE NOTICE 'Colonne project_id existe déjà dans ai_trainings';
    END IF;
END $$;

-- Index pour recherche par project_id
CREATE INDEX IF NOT EXISTS idx_ai_trainings_project_id ON ai_trainings(project_id);

-- Commentaire
COMMENT ON COLUMN ai_trainings.project_id IS 'Lien vers le projet saved_projects';
