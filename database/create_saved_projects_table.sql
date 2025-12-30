-- Table pour stocker les projets sauvegardés par les utilisateurs
CREATE TABLE IF NOT EXISTS saved_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    
    -- Données de l'article original
    article_title TEXT NOT NULL,
    article_summary TEXT,
    article_url TEXT,
    article_image_url TEXT,
    article_source TEXT,
    article_published_at TIMESTAMP WITH TIME ZONE,
    
    -- Analyse contextuelle
    problematique_centrale TEXT NOT NULL,
    secteur_principal TEXT,
    acteurs_impactes TEXT,
    urgence_score INTEGER,
    
    -- Secteur et budget sélectionnés
    secteur_selectionne TEXT NOT NULL,
    budget_selectionne TEXT NOT NULL,
    
    -- Proposition générée sauvegardée
    proposition_titre TEXT NOT NULL,
    proposition_description TEXT NOT NULL,
    proposition_investissement TEXT,
    proposition_rentabilite TEXT,
    proposition_revenus_mensuels TEXT,
    proposition_actions_immediates JSONB,
    proposition_avantages_concurrentiels JSONB,
    proposition_score_faisabilite INTEGER,
    
    -- Métadonnées
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index pour optimiser les requêtes
    CONSTRAINT saved_projects_user_id_idx UNIQUE (user_id, id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_saved_projects_user_id ON saved_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_projects_created_at ON saved_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_projects_secteur ON saved_projects(secteur_selectionne);

-- RLS (Row Level Security) pour sécuriser l'accès
ALTER TABLE saved_projects ENABLE ROW LEVEL SECURITY;

-- Politique RLS : permettre l'accès complet pour les utilisateurs authentifiés (pour demo)
CREATE POLICY "Allow all operations for authenticated users" ON saved_projects
    FOR ALL USING (true) WITH CHECK (true);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_saved_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_saved_projects_updated_at_trigger
    BEFORE UPDATE ON saved_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_projects_updated_at();

-- Fonction pour obtenir les statistiques des projets sauvegardés d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_saved_projects_stats(user_uuid UUID)
RETURNS TABLE (
    total_projects BIGINT,
    projects_by_sector JSONB,
    projects_by_budget JSONB,
    recent_projects_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_projects,
        COALESCE(
            jsonb_object_agg(
                secteur_selectionne, 
                sector_count
            ), 
            '{}'::jsonb
        ) as projects_by_sector,
        COALESCE(
            jsonb_object_agg(
                budget_selectionne, 
                budget_count
            ), 
            '{}'::jsonb
        ) as projects_by_budget,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as recent_projects_count
    FROM (
        SELECT 
            secteur_selectionne,
            budget_selectionne,
            created_at,
            COUNT(*) OVER (PARTITION BY secteur_selectionne) as sector_count,
            COUNT(*) OVER (PARTITION BY budget_selectionne) as budget_count
        FROM saved_projects 
        WHERE user_id = user_uuid
    ) stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
