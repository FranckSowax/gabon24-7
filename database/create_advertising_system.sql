-- Création du système de publicités complet pour Gabon 24/7

-- Table des campagnes publicitaires
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    campaign_title VARCHAR(255) NOT NULL,
    campaign_description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    budget_amount DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
    is_active BOOLEAN DEFAULT true,
    admin_approved BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des slides publicitaires
CREATE TABLE IF NOT EXISTS promotional_slides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    link_url TEXT,
    cta_text VARCHAR(100) DEFAULT 'En savoir plus',
    display_order INTEGER DEFAULT 0,
    slide_type VARCHAR(20) DEFAULT 'image' CHECK (slide_type IN ('image', 'html')),
    html_content TEXT,
    company_name VARCHAR(255), -- Fallback si pas de campagne associée
    view_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    admin_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table des analytics des slides
CREATE TABLE IF NOT EXISTS slide_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slide_id UUID REFERENCES promotional_slides(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('view', 'click')),
    user_ip INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_promotional_slides_active ON promotional_slides(is_active, admin_approved);
CREATE INDEX IF NOT EXISTS idx_promotional_slides_order ON promotional_slides(display_order);
CREATE INDEX IF NOT EXISTS idx_promotional_slides_campaign ON promotional_slides(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_dates ON ad_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(is_active, admin_approved, payment_status);
CREATE INDEX IF NOT EXISTS idx_slide_analytics_slide ON slide_analytics(slide_id, event_type);
CREATE INDEX IF NOT EXISTS idx_slide_analytics_date ON slide_analytics(created_at);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ad_campaigns_updated_at BEFORE UPDATE ON ad_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotional_slides_updated_at BEFORE UPDATE ON promotional_slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Permettre lecture publique pour les slides actifs
ALTER TABLE promotional_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_analytics ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre la lecture des slides actifs et approuvés
CREATE POLICY "slides_public_read" ON promotional_slides 
    FOR SELECT USING (is_active = true AND admin_approved = true);

-- Politique pour permettre la lecture des campagnes actives et approuvées
CREATE POLICY "campaigns_public_read" ON ad_campaigns 
    FOR SELECT USING (is_active = true AND admin_approved = true);

-- Politique pour permettre l'insertion d'analytics (tracking)
CREATE POLICY "analytics_insert" ON slide_analytics 
    FOR INSERT WITH CHECK (true);

-- Politique pour permettre la lecture des analytics
CREATE POLICY "analytics_read" ON slide_analytics 
    FOR SELECT USING (true);

-- Politique pour permettre toutes les opérations aux utilisateurs authentifiés (admins)
CREATE POLICY "admin_full_access_slides" ON promotional_slides 
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_full_access_campaigns" ON ad_campaigns 
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_read_analytics" ON slide_analytics 
    FOR SELECT USING (auth.role() = 'authenticated');

-- Insérer quelques données de démonstration
INSERT INTO ad_campaigns (company_name, contact_email, campaign_title, campaign_description, start_date, end_date, payment_status, is_active, admin_approved, status) VALUES
('Airtel Gabon', 'marketing@airtel.ga', 'Promo Internet Mobile', 'Campagne de promotion des forfaits internet mobile', now() - INTERVAL '1 day', now() + INTERVAL '30 days', 'paid', true, true, 'active'),
('BGFIBank', 'com@bgfibank.ga', 'Comptes Épargne Plus', 'Promotion des nouveaux comptes d''épargne', now() - INTERVAL '2 days', now() + INTERVAL '25 days', 'paid', true, true, 'active'),
('Total Gabon', 'marketing@total.ga', 'Carburant Premium', 'Lancement du nouveau carburant premium', now() - INTERVAL '1 day', now() + INTERVAL '20 days', 'paid', true, true, 'active');

-- Insérer des slides de démonstration
INSERT INTO promotional_slides (campaign_id, title, description, image_url, link_url, cta_text, display_order, company_name, is_active, admin_approved) VALUES
((SELECT id FROM ad_campaigns WHERE company_name = 'Airtel Gabon' LIMIT 1), 
 'Internet Mobile Ultra-Rapide', 
 'Découvrez nos nouveaux forfaits internet mobile avec la 4G+ partout au Gabon', 
 'https://via.placeholder.com/800x400/FF6B35/FFFFFF?text=Airtel+Gabon+4G%2B', 
 'https://airtel.ga/forfaits', 
 'Voir les forfaits', 
 1, 
 'Airtel Gabon', 
 true, 
 true),

((SELECT id FROM ad_campaigns WHERE company_name = 'BGFIBank' LIMIT 1), 
 'Épargne Plus - Taux Avantageux', 
 'Ouvrez votre compte épargne avec un taux préférentiel de 3.5% par an', 
 'https://via.placeholder.com/800x400/1E40AF/FFFFFF?text=BGFIBank+Epargne', 
 'https://bgfibank.ga/epargne', 
 'Ouvrir un compte', 
 2, 
 'BGFIBank', 
 true, 
 true),

((SELECT id FROM ad_campaigns WHERE company_name = 'Total Gabon' LIMIT 1), 
 'Total Premium - Carburant Nouvelle Génération', 
 'Le nouveau carburant Total Premium pour des performances optimales', 
 'https://via.placeholder.com/800x400/DC2626/FFFFFF?text=Total+Premium', 
 'https://total.ga/premium', 
 'En savoir plus', 
 3, 
 'Total Gabon', 
 true, 
 true);

-- Commentaires sur les tables
COMMENT ON TABLE ad_campaigns IS 'Campagnes publicitaires des entreprises clientes';
COMMENT ON TABLE promotional_slides IS 'Slides publicitaires affichés sur la page d''accueil';
COMMENT ON TABLE slide_analytics IS 'Analytics des vues et clics sur les slides publicitaires';

COMMENT ON COLUMN promotional_slides.slide_type IS 'Type de slide : image ou html pour du contenu personnalisé';
COMMENT ON COLUMN promotional_slides.display_order IS 'Ordre d''affichage dans le carousel (plus petit = affiché en premier)';
COMMENT ON COLUMN ad_campaigns.payment_status IS 'Statut du paiement : pending, paid, cancelled';
COMMENT ON COLUMN ad_campaigns.status IS 'Statut de la campagne : draft, active, paused, completed, cancelled';
