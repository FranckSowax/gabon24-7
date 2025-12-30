-- Table pour stocker les contextes personnalisés des utilisateurs
-- Permet de mémoriser jusqu'à 3 profils par utilisateur pour accélérer le workflow

CREATE TABLE IF NOT EXISTS user_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_name VARCHAR(100) NOT NULL,
  
  -- Données du contexte utilisateur
  situation TEXT,
  competences TEXT[] DEFAULT '{}',
  disponibilite VARCHAR(100),
  objectif_delai VARCHAR(50),
  experience_entrepreneuriale TEXT,
  contraintes TEXT,
  budget_principal VARCHAR(50),
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT unique_user_context_name UNIQUE(user_id, context_name)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_created_at ON user_contexts(created_at DESC);

-- Fonction pour limiter à 3 contextes par utilisateur
CREATE OR REPLACE FUNCTION check_user_contexts_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_contexts WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 contextes atteinte pour cet utilisateur';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour vérifier la limite avant insertion
DROP TRIGGER IF EXISTS trigger_check_user_contexts_limit ON user_contexts;
CREATE TRIGGER trigger_check_user_contexts_limit
  BEFORE INSERT ON user_contexts
  FOR EACH ROW
  EXECUTE FUNCTION check_user_contexts_limit();

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_user_contexts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_user_contexts_updated_at ON user_contexts;
CREATE TRIGGER trigger_update_user_contexts_updated_at
  BEFORE UPDATE ON user_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_contexts_updated_at();

-- Politique RLS (Row Level Security)
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs propres contextes
CREATE POLICY "Users can view own contexts"
  ON user_contexts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent créer leurs propres contextes
CREATE POLICY "Users can create own contexts"
  ON user_contexts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent modifier leurs propres contextes
CREATE POLICY "Users can update own contexts"
  ON user_contexts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent supprimer leurs propres contextes
CREATE POLICY "Users can delete own contexts"
  ON user_contexts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Commentaires pour documentation
COMMENT ON TABLE user_contexts IS 'Stocke les contextes personnalisés des utilisateurs pour accélérer le workflow d''analyse business';
COMMENT ON COLUMN user_contexts.context_name IS 'Nom du contexte (ex: "Profil Entrepreneur Tech")';
COMMENT ON COLUMN user_contexts.situation IS 'Situation actuelle de l''utilisateur';
COMMENT ON COLUMN user_contexts.competences IS 'Liste des compétences de l''utilisateur';
COMMENT ON COLUMN user_contexts.disponibilite IS 'Disponibilité de l''utilisateur';
COMMENT ON COLUMN user_contexts.objectif_delai IS 'Délai objectif pour le lancement';
COMMENT ON COLUMN user_contexts.experience_entrepreneuriale IS 'Expérience entrepreneuriale de l''utilisateur';
COMMENT ON COLUMN user_contexts.contraintes IS 'Contraintes spécifiques de l''utilisateur';
COMMENT ON COLUMN user_contexts.budget_principal IS 'Budget principal sélectionné';
