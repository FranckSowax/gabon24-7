-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des plans d'abonnement
CREATE TABLE subscription_plans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    price_monthly integer NOT NULL, -- En XAF
    price_yearly integer, -- Prix annuel (optionnel)
    features jsonb NOT NULL DEFAULT '[]',
    limitations jsonb DEFAULT '{}',
    is_popular boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table profils utilisateurs étendus
CREATE TABLE user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    phone_number text UNIQUE,
    country text DEFAULT 'GA',
    city text,
    preferred_language text DEFAULT 'fr',
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table des abonnements
CREATE TABLE subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES subscription_plans(id),
    status text NOT NULL CHECK (status IN ('trialing', 'active', 'cancelled', 'expired', 'pending')),
    payment_method text CHECK (payment_method IN ('card', 'mobile_money', 'bank_transfer', 'free')),
    current_period_start timestamptz NOT NULL DEFAULT now(),
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean DEFAULT false,
    trial_end timestamptz,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table historique des paiements
CREATE TABLE payment_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id uuid REFERENCES subscriptions(id),
    amount integer NOT NULL,
    currency text DEFAULT 'XAF',
    status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method text,
    transaction_reference text UNIQUE,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Table tracking des features utilisées
CREATE TABLE feature_usage (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name text NOT NULL,
    usage_count integer DEFAULT 0,
    last_used_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, feature_name)
);

-- Indexes pour performance
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_end_date ON subscriptions(current_period_end);
CREATE INDEX idx_payment_history_subscription ON payment_history(subscription_id);
CREATE INDEX idx_feature_usage_user ON feature_usage(user_id);

-- RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Policies pour user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies pour subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL USING (true);

-- Policies pour payment_history
CREATE POLICY "Users can view own payment history" ON payment_history
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM subscriptions WHERE id = subscription_id
        )
    );

-- Policies pour feature_usage
CREATE POLICY "Users can view own feature usage" ON feature_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own feature usage" ON feature_usage
    FOR ALL USING (auth.uid() = user_id);

-- Fonction pour vérifier l'abonnement actif
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid uuid)
RETURNS jsonb AS $$
DECLARE
    subscription_data jsonb;
BEGIN
    SELECT jsonb_build_object(
        'is_active', s.status = 'active' AND s.current_period_end > now(),
        'plan_name', p.name,
        'plan_slug', p.slug,
        'expires_at', s.current_period_end,
        'features', p.features,
        'limitations', p.limitations
    ) INTO subscription_data
    FROM subscriptions s
    JOIN subscription_plans p ON s.plan_id = p.id
    WHERE s.user_id = user_uuid
    AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    RETURN COALESCE(subscription_data, '{"is_active": false, "plan_name": "free"}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer un profil utilisateur automatiquement
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, phone_number)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'phone_number'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer automatiquement le profil
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Seed data pour les forfaits
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, is_popular, sort_order, features, limitations) VALUES
('Gratuit', 'free', 0, 0, false, 1, 
'["15 articles par jour", "Titres et résumés illimités", "1 source gouvernementale", "Newsletter hebdomadaire", "Recherche 7 derniers jours"]'::jsonb,
'{"daily_articles": 15, "search_days": 7, "gov_sources": 1, "offline_articles": 0}'::jsonb),

('Découverte', 'discovery', 2000, 20000, true, 2,
'["Articles illimités", "Sans publicité", "Toutes sources gouvernementales", "Brief IA quotidien personnalisé", "Mode hors-ligne (50 articles)", "10 alertes personnalisées", "Archives 6 mois", "Multi-plateforme"]'::jsonb,
'{"daily_articles": -1, "search_days": 180, "gov_sources": -1, "offline_articles": 50}'::jsonb),

('Pro', 'pro', 10000, 100000, false, 3,
'["Tout Découverte +", "Veille concurrentielle", "API Access", "5 comptes équipe", "Revue de presse automatique", "Export illimité", "Archives complètes", "Support prioritaire", "Formations webinaires"]'::jsonb,
'{"daily_articles": -1, "search_days": -1, "gov_sources": -1, "offline_articles": -1, "team_accounts": 5}'::jsonb);
