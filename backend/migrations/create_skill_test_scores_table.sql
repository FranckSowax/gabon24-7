-- Table pour stocker les scores des tests de compétences
CREATE TABLE IF NOT EXISTS skill_test_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  test_id UUID REFERENCES skill_tests(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('facile', 'moyen', 'difficile')),
  questions_total INTEGER NOT NULL,
  questions_correct INTEGER NOT NULL,
  time_spent INTEGER, -- en secondes
  answers JSONB, -- détails des réponses
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_skill_test_scores_user ON skill_test_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_test_scores_project ON skill_test_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_skill_test_scores_test ON skill_test_scores(test_id);
CREATE INDEX IF NOT EXISTS idx_skill_test_scores_created ON skill_test_scores(created_at DESC);

-- RLS Policies
ALTER TABLE skill_test_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own scores
CREATE POLICY "Users can view own scores"
  ON skill_test_scores
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own scores
CREATE POLICY "Users can insert own scores"
  ON skill_test_scores
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own scores
CREATE POLICY "Users can update own scores"
  ON skill_test_scores
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own scores
CREATE POLICY "Users can delete own scores"
  ON skill_test_scores
  FOR DELETE
  USING (auth.uid() = user_id);

-- Commentaires
COMMENT ON TABLE skill_test_scores IS 'Stocke les scores et résultats des tests de compétences';
COMMENT ON COLUMN skill_test_scores.score IS 'Score en pourcentage (0-100)';
COMMENT ON COLUMN skill_test_scores.difficulty IS 'Niveau de difficulté du test';
COMMENT ON COLUMN skill_test_scores.time_spent IS 'Temps passé sur le test en secondes';
COMMENT ON COLUMN skill_test_scores.answers IS 'Détails des réponses données par l''utilisateur';
