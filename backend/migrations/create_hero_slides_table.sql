-- ====================================================================
-- CRÉATION TABLE hero_slides - SLIDER DYNAMIQUE TOP BAR
-- ====================================================================

-- Table pour les slides de la bannière hero
CREATE TABLE IF NOT EXISTS hero_slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ordre d'affichage
  sort_order INTEGER DEFAULT 0,
  
  -- Activation
  is_active BOOLEAN DEFAULT true,
  
  -- Badge
  badge_text TEXT,
  badge_color TEXT DEFAULT '#F59E0B', -- Orange par défaut
  
  -- Contenu principal
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  
  -- Bouton
  button_text TEXT,
  button_url TEXT,
  button_style TEXT DEFAULT 'primary', -- primary, secondary, outline
  
  -- Design
  background_type TEXT DEFAULT 'gradient', -- gradient, image, color
  background_value TEXT DEFAULT 'from-orange-500 via-red-500 to-pink-600',
  background_image TEXT, -- URL de l'image si background_type = 'image'
  
  -- Couleurs
  text_color TEXT DEFAULT '#FFFFFF',
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Contraintes
  CONSTRAINT valid_background_type CHECK (background_type IN ('gradient', 'image', 'color')),
  CONSTRAINT valid_button_style CHECK (button_style IN ('primary', 'secondary', 'outline'))
);

-- Index pour performance
CREATE INDEX idx_hero_slides_active ON hero_slides(is_active);
CREATE INDEX idx_hero_slides_order ON hero_slides(sort_order);
CREATE INDEX idx_hero_slides_active_order ON hero_slides(is_active, sort_order);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_hero_slides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hero_slides_updated_at
  BEFORE UPDATE ON hero_slides
  FOR EACH ROW
  EXECUTE FUNCTION update_hero_slides_updated_at();

-- RLS Policies
ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tout le monde peut voir les slides actifs)
CREATE POLICY "Public can view active slides"
  ON hero_slides
  FOR SELECT
  USING (is_active = true);

-- Admins peuvent tout faire
CREATE POLICY "Admins can do everything"
  ON hero_slides
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- ====================================================================
-- DONNÉES INITIALES
-- ====================================================================

INSERT INTO hero_slides (
  sort_order,
  is_active,
  badge_text,
  badge_color,
  title,
  subtitle,
  description,
  button_text,
  button_url,
  button_style,
  background_type,
  background_value
) VALUES
(
  1,
  true,
  'NOUVEAU',
  '#F59E0B',
  'Gabon Insight',
  'Premium',
  'Accédez à l''actualité gabonaise en temps réel avec des fonctionnalités exclusives et une expérience personnalisée',
  'Commencer l''essai gratuit',
  '/abonnement',
  'primary',
  'gradient',
  'from-orange-500 via-red-500 to-pink-600'
),
(
  2,
  true,
  'OFFRE SPÉCIALE',
  '#10B981',
  'Analyse IA Premium',
  'Powered by GPT-4',
  'Obtenez des analyses approfondies de l''actualité gabonaise avec notre IA avancée',
  'Découvrir',
  '/veille',
  'primary',
  'gradient',
  'from-emerald-500 via-teal-500 to-cyan-600'
),
(
  3,
  true,
  'NOUVEAU',
  '#8B5CF6',
  'Sondages Pro',
  'Pour les organisations',
  'Créez et gérez vos propres sondages professionnels avec des analyses détaillées',
  'En savoir plus',
  '/sondages-pro',
  'primary',
  'gradient',
  'from-purple-500 via-violet-500 to-indigo-600'
);

-- ====================================================================
-- COMMENTAIRES
-- ====================================================================

COMMENT ON TABLE hero_slides IS 'Slides dynamiques pour la bannière hero (top bar)';
COMMENT ON COLUMN hero_slides.sort_order IS 'Ordre d''affichage (1, 2, 3...)';
COMMENT ON COLUMN hero_slides.is_active IS 'Slide active ou non';
COMMENT ON COLUMN hero_slides.badge_text IS 'Texte du badge (ex: NOUVEAU, OFFRE)';
COMMENT ON COLUMN hero_slides.badge_color IS 'Couleur hex du badge (#F59E0B)';
COMMENT ON COLUMN hero_slides.background_type IS 'Type: gradient, image, color';
COMMENT ON COLUMN hero_slides.background_value IS 'Valeur: classe Tailwind ou hex';
COMMENT ON COLUMN hero_slides.button_style IS 'Style: primary, secondary, outline';
