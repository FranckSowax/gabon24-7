-- Table pour stocker les trajets Google Maps
CREATE TABLE IF NOT EXISTS map_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(500),
    google_maps_url TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les analytics des vues de trajets (optionnel)
CREATE TABLE IF NOT EXISTS route_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES map_routes(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_map_routes_active_order ON map_routes(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_map_routes_created_by ON map_routes(created_by);
CREATE INDEX IF NOT EXISTS idx_route_views_route_id ON route_views(route_id);
CREATE INDEX IF NOT EXISTS idx_route_views_viewed_at ON route_views(viewed_at);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_map_routes_updated_at ON map_routes;
CREATE TRIGGER update_map_routes_updated_at
    BEFORE UPDATE ON map_routes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE map_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_views ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre la lecture publique des trajets actifs
CREATE POLICY "Allow public read access to active routes" ON map_routes
    FOR SELECT USING (is_active = true);

-- Policy pour permettre aux utilisateurs authentifiés de voir tous les trajets
CREATE POLICY "Allow authenticated users to read all routes" ON map_routes
    FOR SELECT TO authenticated USING (true);

-- Policy pour permettre aux utilisateurs authentifiés de créer des trajets
CREATE POLICY "Allow authenticated users to create routes" ON map_routes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Policy pour permettre aux créateurs de modifier leurs trajets
CREATE POLICY "Allow users to update their own routes" ON map_routes
    FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Policy pour permettre aux créateurs de supprimer leurs trajets
CREATE POLICY "Allow users to delete their own routes" ON map_routes
    FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Policy pour les vues de trajets (lecture publique)
CREATE POLICY "Allow public read access to route views" ON route_views
    FOR SELECT USING (true);

-- Policy pour permettre l'insertion de vues de trajets
CREATE POLICY "Allow insert route views" ON route_views
    FOR INSERT WITH CHECK (true);

-- Insérer quelques données de démonstration
INSERT INTO map_routes (title, subtitle, google_maps_url, embed_url, display_order, is_active) VALUES
(
    'Trajet Centre-ville - Aéroport',
    'Distance: 15km | Durée estimée: 25 min',
    'https://www.google.com/maps/dir/0.4986986,9.3923625/0.4410335,9.417713/@0.473803,9.4084905,14.54z/data=!4m2!4m1!3e0?entry=ttu&g_ep=EgoyMDI1MDkxMC4wIKXMDSoASAFQAw%3D%3D',
    'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d15958.234567890123!2d9.3923625!3d0.4986986!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sLibreville%2C+Gabon!3m2!1d0.4986986!2d9.3923625!4m5!1s0x107f2b2b2b2b2b2b%3A0xfedcba0987654321!2sA%C3%A9roport+International+L%C3%A9on-Mba%2C+Libreville%2C+Gabon!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1234567890123!5m2!1sfr!2sga',
    1,
    true
) ON CONFLICT DO NOTHING;
