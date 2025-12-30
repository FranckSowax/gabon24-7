-- ====================================================================
-- CRÉATION TABLE business_banners - TOP BARS FONCTIONS BUSINESS
-- ====================================================================

-- Table pour les bannières des fonctions business
CREATE TABLE IF NOT EXISTS business_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identification fonction
  feature_slug TEXT UNIQUE NOT NULL, -- 'mes-projets', 'actu-plus', 'audio-summaries', etc.
  page_path TEXT NOT NULL, -- Chemin de la page où afficher la bannière
  
  -- Ordre d'affichage (si plusieurs bannières sur une page)
  sort_order INTEGER DEFAULT 0,
  
  -- Activation
  is_active BOOLEAN DEFAULT true,
  
  -- Badge
  badge_text TEXT,
  badge_color TEXT DEFAULT '#F59E0B',
  badge_icon TEXT, -- Emoji ou code icon
  
  -- Contenu principal
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  
  -- Features list (points clés)
  features JSONB, -- ["Feature 1", "Feature 2", "Feature 3"]
  
  -- Call-to-action principal
  primary_cta_text TEXT,
  primary_cta_url TEXT,
  primary_cta_type TEXT DEFAULT 'action', -- action, credits, subscription
  
  -- Call-to-action secondaire (optionnel)
  secondary_cta_text TEXT,
  secondary_cta_url TEXT,
  
  -- Design
  background_type TEXT DEFAULT 'gradient',
  background_value TEXT DEFAULT 'from-orange-500 via-red-500 to-pink-600',
  background_image TEXT,
  text_color TEXT DEFAULT '#FFFFFF',
  
  -- Restrictions d'accès
  require_subscription BOOLEAN DEFAULT false,
  required_subscription_plan TEXT, -- 'premium', 'pro', null (tous)
  require_credits BOOLEAN DEFAULT false,
  credit_cost INTEGER DEFAULT 0,
  
  -- Stats d'affichage (optionnel)
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Contraintes
  CONSTRAINT valid_background_type CHECK (background_type IN ('gradient', 'image', 'color')),
  CONSTRAINT valid_cta_type CHECK (primary_cta_type IN ('action', 'credits', 'subscription'))
);

-- Index pour performance
CREATE INDEX idx_business_banners_active ON business_banners(is_active);
CREATE INDEX idx_business_banners_feature ON business_banners(feature_slug);
CREATE INDEX idx_business_banners_page ON business_banners(page_path);
CREATE INDEX idx_business_banners_active_page ON business_banners(is_active, page_path);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_business_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_business_banners_updated_at
  BEFORE UPDATE ON business_banners
  FOR EACH ROW
  EXECUTE FUNCTION update_business_banners_updated_at();

-- RLS Policies
ALTER TABLE business_banners ENABLE ROW LEVEL SECURITY;

-- Lecture publique (tout le monde peut voir les bannières actives)
CREATE POLICY "Public can view active banners"
  ON business_banners
  FOR SELECT
  USING (is_active = true);

-- Admins peuvent tout faire
CREATE POLICY "Admins can do everything"
  ON business_banners
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- ====================================================================
-- DONNÉES INITIALES - FONCTIONS BUSINESS
-- ====================================================================

-- 1. MES PROJETS
INSERT INTO business_banners (
  feature_slug,
  page_path,
  sort_order,
  is_active,
  badge_text,
  badge_color,
  badge_icon,
  title,
  subtitle,
  description,
  features,
  primary_cta_text,
  primary_cta_url,
  primary_cta_type,
  secondary_cta_text,
  secondary_cta_url,
  background_type,
  background_value,
  require_subscription,
  required_subscription_plan
) VALUES (
  'mes-projets',
  '/business/mes-projets',
  1,
  true,
  'BUSINESS',
  '#8B5CF6',
  '📁',
  'Gérez vos Projets Business',
  'Organisation & Suivi',
  'Centralisez tous vos projets d''investissement et opportunités en un seul endroit avec un suivi en temps réel',
  '["Tableau de bord projets", "Suivi des étapes", "Documents centralisés", "Partage d''équipe"]'::jsonb,
  'Créer mon premier projet',
  '/business/mes-projets/new',
  'action',
  'Voir la démo',
  '/business/mes-projets?demo=true',
  'gradient',
  'from-purple-500 via-violet-500 to-indigo-600',
  true,
  'premium'
);

-- 2. ACTU++
INSERT INTO business_banners (
  feature_slug,
  page_path,
  sort_order,
  is_active,
  badge_text,
  badge_color,
  badge_icon,
  title,
  subtitle,
  description,
  features,
  primary_cta_text,
  primary_cta_url,
  primary_cta_type,
  secondary_cta_text,
  secondary_cta_url,
  background_type,
  background_value,
  require_credits,
  credit_cost
) VALUES (
  'actu-plus',
  '/actu-plus',
  1,
  true,
  'PREMIUM',
  '#F59E0B',
  '📰',
  'Actu++ : Analyses Approfondies',
  'Contenu exclusif',
  'Accédez à des analyses détaillées, rapports exclusifs et contenus premium réservés aux abonnés',
  '["Articles premium illimités", "Analyses sectorielles", "Rapports PDF", "Accès prioritaire"]'::jsonb,
  'Débloquer un article (1 crédit)',
  '/actu-plus?unlock=true',
  'credits',
  'Acheter des crédits',
  '/credits/buy',
  'gradient',
  'from-orange-500 via-red-500 to-pink-600',
  true,
  1
);

-- 3. RÉSUMÉS AUDIO
INSERT INTO business_banners (
  feature_slug,
  page_path,
  sort_order,
  is_active,
  badge_text,
  badge_color,
  badge_icon,
  title,
  subtitle,
  description,
  features,
  primary_cta_text,
  primary_cta_url,
  primary_cta_type,
  secondary_cta_text,
  secondary_cta_url,
  background_type,
  background_value,
  require_credits,
  credit_cost
) VALUES (
  'audio-summaries',
  '/audio/daily',
  1,
  true,
  'IA AUDIO',
  '#10B981',
  '🎧',
  'Résumés Audio Intelligents',
  'Powered by IA',
  'Écoutez l''actualité gabonaise en audio avec des résumés générés par intelligence artificielle. Parfait pour vos déplacements !',
  '["Résumés quotidiens", "Voix naturelle", "Multi-langues", "Téléchargement MP3"]'::jsonb,
  'Générer un résumé (5 crédits)',
  '/audio/daily?generate=true',
  'credits',
  'S''abonner Premium',
  '/abonnement',
  'gradient',
  'from-emerald-500 via-teal-500 to-cyan-600',
  true,
  5
);

-- 4. OPPORTUNITÉS IA
INSERT INTO business_banners (
  feature_slug,
  page_path,
  sort_order,
  is_active,
  badge_text,
  badge_color,
  badge_icon,
  title,
  subtitle,
  description,
  features,
  primary_cta_text,
  primary_cta_url,
  primary_cta_type,
  secondary_cta_text,
  secondary_cta_url,
  background_type,
  background_value,
  require_subscription,
  required_subscription_plan,
  require_credits,
  credit_cost
) VALUES (
  'ai-opportunities',
  '/business/live-opportunities',
  1,
  true,
  'IA PREMIUM',
  '#8B5CF6',
  '🤖',
  'Opportunités Business par IA',
  'Détection automatique',
  'Notre IA analyse l''actualité en temps réel pour identifier les opportunités d''investissement et de business au Gabon',
  '["Détection temps réel", "Analyse de marché", "Scoring opportunités", "Alertes personnalisées"]'::jsonb,
  'Analyser une opportunité (15 crédits)',
  '/business/live-opportunities?analyze=true',
  'credits',
  'Passer à Pro',
  '/abonnement?plan=pro',
  'gradient',
  'from-purple-600 via-violet-600 to-purple-700',
  true,
  'pro',
  true,
  15
);

-- 5. VEILLE & ALERTES
INSERT INTO business_banners (
  feature_slug,
  page_path,
  sort_order,
  is_active,
  badge_text,
  badge_color,
  badge_icon,
  title,
  subtitle,
  description,
  features,
  primary_cta_text,
  primary_cta_url,
  primary_cta_type,
  secondary_cta_text,
  secondary_cta_url,
  background_type,
  background_value,
  require_subscription,
  required_subscription_plan
) VALUES (
  'veille-alertes',
  '/veille',
  1,
  true,
  'VEILLE PRO',
  '#EF4444',
  '🔔',
  'Veille Stratégique & Alertes',
  'Surveillance automatisée',
  'Configurez des alertes personnalisées sur vos secteurs d''intérêt et recevez des notifications en temps réel',
  '["Alertes SMS/Email", "Mots-clés personnalisés", "Rapports hebdo", "Dashboard analytique"]'::jsonb,
  'Créer une alerte (3 crédits)',
  '/veille?create=true',
  'credits',
  'Découvrir les formules Pro',
  '/abonnement',
  'gradient',
  'from-red-500 via-orange-500 to-yellow-500',
  true,
  'premium',
  true,
  3
);

-- 6. PUBLICITÉ
INSERT INTO business_banners (
  feature_slug,
  page_path,
  sort_order,
  is_active,
  badge_text,
  badge_color,
  badge_icon,
  title,
  subtitle,
  description,
  features,
  primary_cta_text,
  primary_cta_url,
  primary_cta_type,
  background_type,
  background_value
) VALUES (
  'marketing-ads',
  '/marketing/publicite',
  1,
  true,
  'MARKETING',
  '#3B82F6',
  '📢',
  'Publicité & Marketing Digital',
  'Boostez votre visibilité',
  'Faites connaître votre entreprise auprès de milliers de gabonais grâce à nos solutions publicitaires ciblées',
  '["Bannières display", "Contenu sponsorisé", "Ciblage géographique", "Analytics avancées"]'::jsonb,
  'Démarrer une campagne',
  '/marketing/publicite?campaign=new',
  'action',
  null,
  null,
  'gradient',
  'from-blue-500 via-cyan-500 to-teal-600'
);

-- ====================================================================
-- COMMENTAIRES
-- ====================================================================

COMMENT ON TABLE business_banners IS 'Bannières dynamiques pour les fonctions business';
COMMENT ON COLUMN business_banners.feature_slug IS 'Slug unique de la fonction (mes-projets, actu-plus...)';
COMMENT ON COLUMN business_banners.page_path IS 'Chemin de la page où afficher la bannière';
COMMENT ON COLUMN business_banners.primary_cta_type IS 'Type: action, credits, subscription';
COMMENT ON COLUMN business_banners.require_subscription IS 'Nécessite un abonnement';
COMMENT ON COLUMN business_banners.require_credits IS 'Nécessite des crédits';
COMMENT ON COLUMN business_banners.credit_cost IS 'Coût en crédits de l''action';
