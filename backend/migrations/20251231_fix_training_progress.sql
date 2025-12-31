-- ============================================
-- 🔧 FIX TRAINING_PROGRESS - Ajouter colonnes manquantes
-- Exécuter si la table existe déjà sans certaines colonnes
-- ============================================

-- Vérifier si la table existe, sinon la créer complètement
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_progress') THEN
        -- Créer la table complète si elle n'existe pas
        CREATE TABLE training_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            training_id TEXT NOT NULL,
            user_id UUID NOT NULL,
            project_id UUID,
            current_module_index INTEGER DEFAULT 0,
            completed_modules INTEGER[] DEFAULT ARRAY[]::INTEGER[],
            generated_modules JSONB DEFAULT '{}'::jsonb,
            progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(training_id, user_id)
        );
        RAISE NOTICE 'Table training_progress créée avec succès';
    ELSE
        RAISE NOTICE 'Table training_progress existe déjà, vérification des colonnes...';
    END IF;
END $$;

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
    -- Ajouter project_id si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'training_progress' AND column_name = 'project_id') THEN
        ALTER TABLE training_progress ADD COLUMN project_id UUID;
        RAISE NOTICE 'Colonne project_id ajoutée';
    END IF;

    -- Ajouter current_module_index si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'training_progress' AND column_name = 'current_module_index') THEN
        ALTER TABLE training_progress ADD COLUMN current_module_index INTEGER DEFAULT 0;
        RAISE NOTICE 'Colonne current_module_index ajoutée';
    END IF;

    -- Ajouter completed_modules si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'training_progress' AND column_name = 'completed_modules') THEN
        ALTER TABLE training_progress ADD COLUMN completed_modules INTEGER[] DEFAULT ARRAY[]::INTEGER[];
        RAISE NOTICE 'Colonne completed_modules ajoutée';
    END IF;

    -- Ajouter generated_modules si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'training_progress' AND column_name = 'generated_modules') THEN
        ALTER TABLE training_progress ADD COLUMN generated_modules JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Colonne generated_modules ajoutée';
    END IF;

    -- Ajouter progress_percentage si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'training_progress' AND column_name = 'progress_percentage') THEN
        ALTER TABLE training_progress ADD COLUMN progress_percentage INTEGER DEFAULT 0;
        -- Ajouter la contrainte CHECK séparément
        ALTER TABLE training_progress ADD CONSTRAINT chk_progress_percentage
            CHECK (progress_percentage >= 0 AND progress_percentage <= 100);
        RAISE NOTICE 'Colonne progress_percentage ajoutée';
    END IF;

    -- Ajouter last_accessed_at si manquant
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'training_progress' AND column_name = 'last_accessed_at') THEN
        ALTER TABLE training_progress ADD COLUMN last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Colonne last_accessed_at ajoutée';
    END IF;
END $$;

-- Index pour performances (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_training_progress_user_id ON training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_training_id ON training_progress(training_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_project_id ON training_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_last_accessed ON training_progress(last_accessed_at DESC);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_training_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_training_progress_updated_at ON training_progress;
CREATE TRIGGER trigger_training_progress_updated_at
  BEFORE UPDATE ON training_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_training_progress_updated_at();

-- RLS Policies (avec DROP IF EXISTS pour éviter les erreurs)
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own training progress" ON training_progress;
CREATE POLICY "Users can view own training progress"
  ON training_progress
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create training progress" ON training_progress;
CREATE POLICY "Users can create training progress"
  ON training_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own training progress" ON training_progress;
CREATE POLICY "Users can update own training progress"
  ON training_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on training_progress" ON training_progress;
CREATE POLICY "Service role full access on training_progress"
  ON training_progress
  FOR ALL
  USING (auth.role() = 'service_role');

-- Commentaires
COMMENT ON TABLE training_progress IS 'Progression des formations pour reprise';
COMMENT ON COLUMN training_progress.training_id IS 'ID de la formation (UUID ou temp_*)';
COMMENT ON COLUMN training_progress.current_module_index IS 'Index du dernier module consulté';
COMMENT ON COLUMN training_progress.completed_modules IS 'Liste des modules terminés';
COMMENT ON COLUMN training_progress.generated_modules IS 'Cache JSON des contenus générés';
COMMENT ON COLUMN training_progress.project_id IS 'Lien optionnel vers un projet sauvegardé';
