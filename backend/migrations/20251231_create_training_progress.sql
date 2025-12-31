-- ============================================
-- 🎓 TABLE TRAINING_PROGRESS - Progression des formations
-- Permet de reprendre une formation là où on s'est arrêté
-- ============================================

CREATE TABLE IF NOT EXISTS training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id TEXT NOT NULL, -- ID de la formation (peut être UUID ou temp_*)
  user_id UUID NOT NULL,
  project_id UUID, -- Lien optionnel vers un projet sauvegardé

  -- Progression
  current_module_index INTEGER DEFAULT 0, -- Index du module actuel (0-based)
  completed_modules INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- Array des IDs de modules complétés
  generated_modules JSONB DEFAULT '{}'::jsonb, -- Cache des modules générés {moduleId: content}
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Contrainte unique: un utilisateur ne peut avoir qu'une progression par formation
  UNIQUE(training_id, user_id)
);

-- Index pour performances
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

-- RLS Policies
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leur propre progression
CREATE POLICY "Users can view own training progress"
  ON training_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent créer leur progression
CREATE POLICY "Users can create training progress"
  ON training_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent mettre à jour leur progression
CREATE POLICY "Users can update own training progress"
  ON training_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Service role peut tout faire (pour le backend)
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
