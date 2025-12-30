-- Tables pour le système de slides publicitaires

-- Table des forfaits publicitaires
CREATE TABLE ad_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL, -- Durée en jours
  max_slides INTEGER NOT NULL, -- Nombre maximum de slides
  price_fcfa INTEGER NOT NULL, -- Prix en FCFA
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des campagnes publicitaires
CREATE TABLE ad_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- Référence vers l'utilisateur (à créer si nécessaire)
  company_name VARCHAR(200) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  package_id UUID REFERENCES ad_packages(id),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  total_amount INTEGER NOT NULL, -- Montant total payé
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, expired, cancelled
  payment_reference VARCHAR(100),
  is_active BOOLEAN DEFAULT false, -- Activé après paiement
  admin_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des slides publicitaires
CREATE TABLE promotional_slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT, -- URL de redirection
  cta_text VARCHAR(100) DEFAULT 'En savoir plus', -- Call to action
  display_order INTEGER DEFAULT 0, -- Ordre d'affichage
  click_count INTEGER DEFAULT 0, -- Nombre de clics
  view_count INTEGER DEFAULT 0, -- Nombre de vues
  is_active BOOLEAN DEFAULT true,
  admin_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des statistiques de slides
CREATE TABLE slide_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_id UUID REFERENCES promotional_slides(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'view', 'click'
  user_ip VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_ad_campaigns_dates ON ad_campaigns(start_date, end_date);
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(payment_status, is_active);
CREATE INDEX idx_promotional_slides_campaign ON promotional_slides(campaign_id);
CREATE INDEX idx_promotional_slides_active ON promotional_slides(is_active, admin_approved);
CREATE INDEX idx_promotional_slides_order ON promotional_slides(display_order);
CREATE INDEX idx_slide_analytics_slide ON slide_analytics(slide_id);
CREATE INDEX idx_slide_analytics_date ON slide_analytics(created_at);

-- RLS (Row Level Security)
ALTER TABLE ad_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotional_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE slide_analytics ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour les forfaits (lecture publique)
CREATE POLICY "Ad packages are viewable by everyone" ON ad_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Ad packages can be managed by service role" ON ad_packages
  FOR ALL USING (true);

-- Politiques RLS pour les campagnes
CREATE POLICY "Campaigns are viewable by owner" ON ad_campaigns
  FOR SELECT USING (contact_email = current_user_email() OR current_user_role() = 'admin');

CREATE POLICY "Campaigns can be created by anyone" ON ad_campaigns
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Campaigns can be managed by service role" ON ad_campaigns
  FOR ALL USING (true);

-- Politiques RLS pour les slides (lecture publique des slides approuvés)
CREATE POLICY "Active slides are viewable by everyone" ON promotional_slides
  FOR SELECT USING (is_active = true AND admin_approved = true);

CREATE POLICY "Slides can be managed by service role" ON promotional_slides
  FOR ALL USING (true);

-- Politiques RLS pour les analytics
CREATE POLICY "Analytics can be managed by service role" ON slide_analytics
  FOR ALL USING (true);

-- Fonctions pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_ad_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ad_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_promotional_slides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_ad_packages_updated_at_trigger
  BEFORE UPDATE ON ad_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_packages_updated_at();

CREATE TRIGGER update_ad_campaigns_updated_at_trigger
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_campaigns_updated_at();

CREATE TRIGGER update_promotional_slides_updated_at_trigger
  BEFORE UPDATE ON promotional_slides
  FOR EACH ROW
  EXECUTE FUNCTION update_promotional_slides_updated_at();

-- Fonction pour vérifier si une campagne est active
CREATE OR REPLACE FUNCTION is_campaign_active(campaign_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ad_campaigns 
    WHERE id = campaign_id 
    AND is_active = true 
    AND admin_approved = true
    AND payment_status = 'paid'
    AND start_date <= NOW() 
    AND end_date >= NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Données initiales pour les forfaits
INSERT INTO ad_packages (name, description, duration_days, max_slides, price_fcfa) VALUES
('Starter', 'Forfait découverte pour petites entreprises', 7, 2, 25000),
('Business', 'Forfait standard pour entreprises moyennes', 15, 5, 50000),
('Premium', 'Forfait avancé pour grandes entreprises', 30, 10, 90000),
('Enterprise', 'Forfait sur mesure pour campagnes importantes', 60, 20, 150000);
