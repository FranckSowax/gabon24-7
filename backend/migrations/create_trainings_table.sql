-- ============================================
-- 🎓 TABLE TRAININGS - Formations IA
-- ============================================

CREATE TABLE IF NOT EXISTS trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  opportunity_id UUID, -- ID de l'opportunité associée
  
  -- Configuration de la formation
  modules JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array des modules [{id, title, description, order}]
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  
  -- Progression
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100), -- Pourcentage
  completed_modules TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array des IDs modules complétés
  current_module_id TEXT, -- Module en cours
  
  -- Crédits et paiement
  credits_used INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_trainings_user_id ON trainings(user_id);
CREATE INDEX IF NOT EXISTS idx_trainings_project_id ON trainings(project_id);
CREATE INDEX IF NOT EXISTS idx_trainings_status ON trainings(status);
CREATE INDEX IF NOT EXISTS idx_trainings_last_accessed ON trainings(last_accessed_at DESC);

-- RLS Policies
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leurs propres formations
CREATE POLICY "Users can view own trainings"
  ON trainings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent créer leurs formations
CREATE POLICY "Users can create trainings"
  ON trainings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent mettre à jour leurs formations
CREATE POLICY "Users can update own trainings"
  ON trainings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent supprimer leurs formations
CREATE POLICY "Users can delete own trainings"
  ON trainings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 🎓 TABLE TRAINING_MODULES - Contenu généré
-- ============================================

CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  
  -- Identification du module
  module_id TEXT NOT NULL, -- ID unique du module dans le sommaire
  module_order INTEGER NOT NULL DEFAULT 0,
  
  -- Métadonnées
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'business',
  difficulty_level TEXT DEFAULT 'débutant' CHECK (difficulty_level IN ('débutant', 'intermédiaire', 'avancé')),
  
  -- Contenu généré par IA
  lesson_content TEXT, -- Contenu markdown de la leçon (2000-3000 mots)
  image_url TEXT, -- URL image générée Nano Banana
  
  -- Métadonnées de génération
  word_count INTEGER,
  estimated_duration INTEGER, -- Minutes de lecture
  generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Progression utilisateur
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  time_spent INTEGER DEFAULT 0, -- Secondes passées sur le module
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contrainte unique: un module_id par training
  UNIQUE(training_id, module_id)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_training_modules_training_id ON training_modules(training_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_module_id ON training_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_order ON training_modules(module_order);
CREATE INDEX IF NOT EXISTS idx_training_modules_completed ON training_modules(is_completed);

-- RLS Policies (via training_id)
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

-- Policy: Voir les modules de ses propres formations
CREATE POLICY "Users can view own training modules"
  ON training_modules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trainings 
      WHERE trainings.id = training_modules.training_id 
      AND trainings.user_id = auth.uid()
    )
  );

-- Policy: Créer modules pour ses formations
CREATE POLICY "Users can create training modules"
  ON training_modules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trainings 
      WHERE trainings.id = training_modules.training_id 
      AND trainings.user_id = auth.uid()
    )
  );

-- Policy: Mettre à jour modules de ses formations
CREATE POLICY "Users can update own training modules"
  ON training_modules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trainings 
      WHERE trainings.id = training_modules.training_id 
      AND trainings.user_id = auth.uid()
    )
  );

-- Commentaires
COMMENT ON TABLE trainings IS 'Formations IA achetées par les utilisateurs';
COMMENT ON TABLE training_modules IS 'Modules de formation avec contenu généré par IA';
COMMENT ON COLUMN trainings.modules IS 'Configuration des modules sélectionnés (JSON)';
COMMENT ON COLUMN trainings.progress IS 'Pourcentage de progression (0-100)';
COMMENT ON COLUMN training_modules.lesson_content IS 'Contenu pédagogique généré par GPT-5 Nano';
COMMENT ON COLUMN training_modules.image_url IS 'Image générée par Nano Banana';
