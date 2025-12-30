-- Migration: Créer la table skill_tests pour stocker les tests de compétence
-- Date: 2025-10-04
-- Description: Permet aux utilisateurs de sauvegarder leurs tests de compétence dans "Mes Projets"

-- Créer la table skill_tests
CREATE TABLE IF NOT EXISTS skill_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  proposal_title TEXT NOT NULL,
  proposal_description TEXT,
  sector TEXT,
  budget TEXT,
  
  -- Données du test
  test_data JSONB NOT NULL, -- Structure complète du test généré
  
  -- Résultats
  user_answers JSONB, -- Réponses de l'utilisateur {q1: 0, q2: 2, ...}
  score INTEGER, -- Score total obtenu
  score_percentage INTEGER, -- Pourcentage de réussite
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Contexte utilisateur au moment du test
  user_context JSONB, -- Compétences, expérience, etc.
  
  -- Métadonnées
  credits_used INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_skill_tests_user_id ON skill_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_tests_created_at ON skill_tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_tests_completed ON skill_tests(completed);
CREATE INDEX IF NOT EXISTS idx_skill_tests_article_id ON skill_tests(article_id);

-- RLS policies
ALTER TABLE skill_tests ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent
DROP POLICY IF EXISTS "Users can view their own skill tests" ON skill_tests;
DROP POLICY IF EXISTS "Users can create their own skill tests" ON skill_tests;
DROP POLICY IF EXISTS "Users can update their own skill tests" ON skill_tests;
DROP POLICY IF EXISTS "Users can delete their own skill tests" ON skill_tests;

-- Les utilisateurs peuvent voir leurs propres tests
CREATE POLICY "Users can view their own skill tests"
  ON skill_tests FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer leurs propres tests
CREATE POLICY "Users can create their own skill tests"
  ON skill_tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leurs propres tests
CREATE POLICY "Users can update their own skill tests"
  ON skill_tests FOR UPDATE
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres tests
CREATE POLICY "Users can delete their own skill tests"
  ON skill_tests FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_skill_tests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_skill_tests_updated_at_trigger ON skill_tests;

CREATE TRIGGER update_skill_tests_updated_at_trigger
  BEFORE UPDATE ON skill_tests
  FOR EACH ROW
  EXECUTE FUNCTION update_skill_tests_updated_at();

-- Commentaires
COMMENT ON TABLE skill_tests IS 'Tests de compétence générés et passés par les utilisateurs';
COMMENT ON COLUMN skill_tests.test_data IS 'Structure JSON complète du test (questions, options, explications, scoring)';
COMMENT ON COLUMN skill_tests.user_answers IS 'Réponses de l''utilisateur {questionId: optionIndex}';
COMMENT ON COLUMN skill_tests.user_context IS 'Contexte utilisateur au moment de la génération (compétences, expérience, budget)';
COMMENT ON COLUMN skill_tests.completed IS 'True si l''utilisateur a terminé le test';
COMMENT ON COLUMN skill_tests.score IS 'Score brut obtenu (sur 13 points: Q1-Q7=1pt, Q8-Q10=2pts)';
COMMENT ON COLUMN skill_tests.score_percentage IS 'Pourcentage de réussite (0-100)';
