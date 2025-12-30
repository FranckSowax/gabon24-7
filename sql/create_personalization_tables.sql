-- ===========================================
-- TABLES PERSONNALISATION BUSINESS
-- ===========================================

-- Table pour stocker les contextes utilisateurs
CREATE TABLE user_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  situation TEXT CHECK (situation IN ('salarié', 'étudiant', 'entrepreneur', 'chercheur_emploi', 'retraité', 'autre')),
  competences TEXT[] DEFAULT '{}',
  disponibilite TEXT CHECK (disponibilite IN ('temps_partiel', 'temps_complet', 'weekends', 'soirées')),
  budget_personnel TEXT,
  objectif_delai TEXT CHECK (objectif_delai IN ('1_mois', '3_mois', '6_mois', '1_an', 'plus_1_an')),
  contraintes TEXT,
  localisation TEXT DEFAULT 'Libreville',
  experience_entrepreneuriale TEXT CHECK (experience_entrepreneuriale IN ('débutant', 'intermédiaire', 'expérimenté')),
  secteurs_interesse TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les propositions personnalisées
CREATE TABLE personalized_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  context_id UUID REFERENCES user_contexts(id) ON DELETE CASCADE,
  original_proposal_data JSONB, -- Proposition générique originale
  secteur TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  problematique TEXT NOT NULL,
  
  -- Proposition personnalisée générée
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  premiers_investissements TEXT NOT NULL,
  delai_lancement TEXT NOT NULL,
  avantages TEXT[] DEFAULT '{}',
  defis TEXT[] DEFAULT '{}',
  score_faisabilite INTEGER CHECK (score_faisabilite >= 0 AND score_faisabilite <= 100),
  
  -- Adaptations personnalisées
  adaptations_contexte TEXT, -- Explications des adaptations
  recommandations_specifiques TEXT[] DEFAULT '{}',
  etapes_prioritaires TEXT[] DEFAULT '{}',
  
  -- Métadonnées
  ai_model_used TEXT DEFAULT 'gpt-4o-mini',
  generation_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour tracker les interactions avec les propositions
CREATE TABLE proposal_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  proposal_id UUID REFERENCES personalized_proposals(id) ON DELETE CASCADE,
  interaction_type TEXT CHECK (interaction_type IN ('viewed', 'saved', 'service_selected', 'dismissed', 'shared')),
  service_selected TEXT, -- Pour les services premium sélectionnés
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table pour les services premium demandés
CREATE TABLE premium_service_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  proposal_id UUID REFERENCES personalized_proposals(id) ON DELETE CASCADE,
  service_type TEXT CHECK (service_type IN ('action-plan', 'custom-training', 'mentoring', 'business-plan')),
  service_title TEXT NOT NULL,
  credits_required INTEGER NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')) DEFAULT 'pending',
  request_data JSONB DEFAULT '{}',
  completion_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ===========================================
-- INDEXES POUR PERFORMANCE
-- ===========================================

CREATE INDEX idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX idx_user_contexts_created_at ON user_contexts(created_at DESC);

CREATE INDEX idx_personalized_proposals_user_id ON personalized_proposals(user_id);
CREATE INDEX idx_personalized_proposals_context_id ON personalized_proposals(context_id);
CREATE INDEX idx_personalized_proposals_created_at ON personalized_proposals(created_at DESC);

CREATE INDEX idx_proposal_interactions_user_id ON proposal_interactions(user_id);
CREATE INDEX idx_proposal_interactions_proposal_id ON proposal_interactions(proposal_id);
CREATE INDEX idx_proposal_interactions_type ON proposal_interactions(interaction_type);

CREATE INDEX idx_premium_requests_user_id ON premium_service_requests(user_id);
CREATE INDEX idx_premium_requests_status ON premium_service_requests(status);

-- ===========================================
-- RLS POLICIES (ROW LEVEL SECURITY)
-- ===========================================

-- User contexts : l'utilisateur ne voit que ses propres contextes
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contexts" ON user_contexts
  FOR ALL USING (auth.uid() = user_id);

-- Personalized proposals : l'utilisateur ne voit que ses propositions
ALTER TABLE personalized_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own personalized proposals" ON personalized_proposals
  FOR ALL USING (auth.uid() = user_id);

-- Proposal interactions : l'utilisateur ne voit que ses interactions
ALTER TABLE proposal_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own interactions" ON proposal_interactions
  FOR ALL USING (auth.uid() = user_id);

-- Premium service requests : l'utilisateur ne voit que ses demandes
ALTER TABLE premium_service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own service requests" ON premium_service_requests
  FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- FONCTIONS TRIGGERS
-- ===========================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_user_contexts_updated_at 
  BEFORE UPDATE ON user_contexts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personalized_proposals_updated_at 
  BEFORE UPDATE ON personalized_proposals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
