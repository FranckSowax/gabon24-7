-- Schema pour le système d'opportunités enrichi avec MCP Brave & DeepWiki
-- Gabon 24/7 - Module Opportunités IA Enrichi

-- Extension des tables existantes d'opportunités
ALTER TABLE opportunity_analyses ADD COLUMN IF NOT EXISTS
  enrichment_data jsonb DEFAULT '{}',
  factual_data jsonb DEFAULT '{}',
  market_research jsonb DEFAULT '{}',
  competitor_analysis jsonb DEFAULT '{}',
  regulatory_info jsonb DEFAULT '{}',
  enrichment_status text DEFAULT 'pending',
  enrichment_completed_at timestamptz,
  data_sources jsonb DEFAULT '[]',
  confidence_score float DEFAULT 0,
  enrichment_level text DEFAULT 'basic'; -- 'basic', 'premium'

-- Table de cache pour les recherches MCP
CREATE TABLE IF NOT EXISTS enrichment_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    query_hash text UNIQUE NOT NULL,
    query_type text NOT NULL, -- 'brave_search', 'deepwiki', 'combined'
    query_params jsonb NOT NULL,
    results jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '7 days'),
    hit_count integer DEFAULT 0,
    source_type text DEFAULT 'unknown' -- 'brave', 'deepwiki', 'hybrid'
);

-- Table de métriques d'enrichissement
CREATE TABLE IF NOT EXISTS enrichment_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id uuid REFERENCES opportunity_analyses(id),
    enrichment_type text NOT NULL, -- 'factual', 'market', 'competitor', 'regulatory'
    data_points_added integer DEFAULT 0,
    sources_used text[],
    processing_time_ms integer,
    confidence_level float,
    api_calls_made integer DEFAULT 0,
    credits_consumed integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Table pour stocker les données factuelles extraites
CREATE TABLE IF NOT EXISTS factual_data_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location text NOT NULL,
    sector text NOT NULL,
    data_type text NOT NULL, -- 'demographics', 'infrastructure', 'economic'
    data_content jsonb NOT NULL,
    source text NOT NULL, -- 'deepwiki', 'brave', 'hybrid'
    confidence_score float DEFAULT 0,
    last_updated timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '30 days'),
    UNIQUE(location, sector, data_type)
);

-- Table pour l'analyse concurrentielle
CREATE TABLE IF NOT EXISTS competitor_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    sector text NOT NULL,
    location text NOT NULL,
    company_data jsonb DEFAULT '{}',
    services jsonb DEFAULT '[]',
    strengths jsonb DEFAULT '[]',
    weaknesses jsonb DEFAULT '[]',
    market_share float DEFAULT 0,
    pricing_info jsonb DEFAULT '{}',
    last_updated timestamptz DEFAULT now(),
    data_source text DEFAULT 'brave_search',
    UNIQUE(name, location)
);

-- Table pour les informations réglementaires
CREATE TABLE IF NOT EXISTS regulatory_info_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sector text NOT NULL,
    country text DEFAULT 'GA',
    regulation_type text NOT NULL, -- 'license', 'law', 'program'
    title text NOT NULL,
    description text,
    requirements jsonb DEFAULT '[]',
    authority text,
    cost text,
    processing_time text,
    validity_period text,
    penalties jsonb DEFAULT '[]',
    last_updated timestamptz DEFAULT now(),
    source text DEFAULT 'deepwiki',
    UNIQUE(sector, regulation_type, title)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_hash ON enrichment_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_expires ON enrichment_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_type ON enrichment_cache(query_type);
CREATE INDEX IF NOT EXISTS idx_enrichment_metrics_opportunity ON enrichment_metrics(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_metrics_type ON enrichment_metrics(enrichment_type);
CREATE INDEX IF NOT EXISTS idx_factual_data_location_sector ON factual_data_cache(location, sector);
CREATE INDEX IF NOT EXISTS idx_factual_data_expires ON factual_data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_competitor_profiles_sector ON competitor_profiles(sector, location);
CREATE INDEX IF NOT EXISTS idx_regulatory_info_sector ON regulatory_info_cache(sector, country);

-- Fonction pour nettoyer les caches expirés
CREATE OR REPLACE FUNCTION cleanup_expired_enrichment_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM enrichment_cache WHERE expires_at < now();
    DELETE FROM factual_data_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer le score de confiance de l'enrichissement
CREATE OR REPLACE FUNCTION calculate_enrichment_confidence(
    factual_data jsonb,
    market_data jsonb,
    competitor_data jsonb,
    regulatory_data jsonb
)
RETURNS float AS $$
DECLARE
    score float := 0;
    factors integer := 0;
BEGIN
    -- Évaluer les données factuelles (20 points max)
    IF factual_data IS NOT NULL AND jsonb_array_length(factual_data) > 0 THEN
        score := score + 20;
        factors := factors + 1;
    END IF;
    
    -- Évaluer les données de marché (25 points max)
    IF market_data IS NOT NULL AND jsonb_array_length(market_data) > 0 THEN
        score := score + 25;
        factors := factors + 1;
    END IF;
    
    -- Évaluer l'analyse concurrentielle (25 points max)
    IF competitor_data IS NOT NULL AND jsonb_array_length(competitor_data) > 0 THEN
        score := score + 25;
        factors := factors + 1;
    END IF;
    
    -- Évaluer les informations réglementaires (30 points max)
    IF regulatory_data IS NOT NULL AND jsonb_array_length(regulatory_data) > 0 THEN
        score := score + 30;
        factors := factors + 1;
    END IF;
    
    -- Retourner le score moyen si on a des données
    IF factors > 0 THEN
        RETURN score / factors;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Politique RLS pour les données enrichies (sécurité)
ALTER TABLE enrichment_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE factual_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_info_cache ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent seulement voir leurs propres enrichissements
CREATE POLICY "Users can view their own enrichment metrics" ON enrichment_metrics
    FOR SELECT USING (
        opportunity_id IN (
            SELECT id FROM opportunity_analyses WHERE user_id = auth.uid()
        )
    );

-- Politique : Cache public pour les données factuelles (optimisation)
CREATE POLICY "Public read access to factual cache" ON factual_data_cache
    FOR SELECT USING (true);

CREATE POLICY "Public read access to competitor profiles" ON competitor_profiles
    FOR SELECT USING (true);

CREATE POLICY "Public read access to regulatory info" ON regulatory_info_cache
    FOR SELECT USING (true);

-- Vue pour les statistiques d'enrichissement par utilisateur
CREATE OR REPLACE VIEW user_enrichment_stats AS
SELECT 
    oa.user_id,
    COUNT(*) as total_analyses,
    COUNT(CASE WHEN oa.enrichment_status = 'completed' THEN 1 END) as enriched_analyses,
    AVG(oa.confidence_score) as avg_confidence,
    SUM(em.credits_consumed) as total_credits_used,
    MAX(oa.enrichment_completed_at) as last_enrichment
FROM opportunity_analyses oa
LEFT JOIN enrichment_metrics em ON oa.id = em.opportunity_id
WHERE oa.user_id IS NOT NULL
GROUP BY oa.user_id;

-- Vue pour les données d'enrichissement les plus récentes
CREATE OR REPLACE VIEW recent_enrichment_data AS
SELECT 
    oa.id,
    oa.opportunity_title,
    oa.enrichment_status,
    oa.confidence_score,
    oa.enrichment_level,
    oa.enrichment_completed_at,
    em.processing_time_ms,
    em.api_calls_made,
    em.credits_consumed
FROM opportunity_analyses oa
LEFT JOIN enrichment_metrics em ON oa.id = em.opportunity_id
WHERE oa.enrichment_status IN ('completed', 'in_progress')
ORDER BY oa.enrichment_completed_at DESC NULLS LAST;

COMMENT ON TABLE enrichment_cache IS 'Cache pour les résultats des recherches MCP Brave et DeepWiki';
COMMENT ON TABLE enrichment_metrics IS 'Métriques de performance pour l''enrichissement des opportunités';
COMMENT ON TABLE factual_data_cache IS 'Cache des données factuelles extraites par location et secteur';
COMMENT ON TABLE competitor_profiles IS 'Profils des concurrents identifiés via Brave Search';
COMMENT ON TABLE regulatory_info_cache IS 'Informations réglementaires par secteur et pays';
