-- Table pour sauvegarder les sources détectées automatiquement
CREATE TABLE IF NOT EXISTS detected_sources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    detection_method VARCHAR(50) NOT NULL, -- 'metadata', 'content', 'transform', 'manual'
    confidence_score INTEGER DEFAULT 100,
    is_verified BOOLEAN DEFAULT false,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_detected_sources_domain ON detected_sources(domain);
CREATE INDEX IF NOT EXISTS idx_detected_sources_verified ON detected_sources(is_verified);

-- RLS Policy pour sécuriser l'accès
ALTER TABLE detected_sources ENABLE ROW LEVEL SECURITY;

-- Politique d'accès en lecture pour tous les utilisateurs authentifiés
CREATE POLICY "Allow read access to detected sources" ON detected_sources
    FOR SELECT USING (true);

-- Politique d'insertion/mise à jour pour les fonctions système
CREATE POLICY "Allow system functions to manage sources" ON detected_sources
    FOR ALL USING (true);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_detected_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_detected_sources_updated_at ON detected_sources;
CREATE TRIGGER trigger_update_detected_sources_updated_at
    BEFORE UPDATE ON detected_sources
    FOR EACH ROW EXECUTE FUNCTION update_detected_sources_updated_at();
