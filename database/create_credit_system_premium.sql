-- ============================================
-- 💎 SYSTÈME DE CRÉDITS GABON 24/7 - VERSION PREMIUM
-- ============================================
-- Basé sur le document PDF fourni
-- Date: 2025-11-16
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABLE: credit_packages (Packages de crédits)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    credits INTEGER NOT NULL CHECK (credits > 0),
    bonus_credits INTEGER DEFAULT 0 CHECK (bonus_credits >= 0),
    price_xaf INTEGER NOT NULL CHECK (price_xaf > 0),
    price_usd DECIMAL(10,2),
    discount_percentage INTEGER DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    max_purchases_per_user INTEGER, -- NULL = illimité
    description TEXT,
    features JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_credit_packages_active ON credit_packages(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_credit_packages_slug ON credit_packages(slug);

-- ============================================
-- 2. TABLE: user_credits (Solde des utilisateurs)
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0 CHECK (balance >= 0), -- Crédits achetés
    bonus_balance INTEGER DEFAULT 0 CHECK (bonus_balance >= 0), -- Crédits bonus
    total_earned INTEGER DEFAULT 0, -- Total gagné (historique)
    total_spent INTEGER DEFAULT 0, -- Total dépensé (historique)
    last_purchase_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_balance ON user_credits(balance);

-- ============================================
-- 3. TABLE: credit_transactions (Historique des transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'consume', 'bonus', 'refund', 'admin_adjustment', 'welcome_bonus')),
    amount INTEGER NOT NULL, -- Positif = ajout, Négatif = débit
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    bonus_balance_after INTEGER DEFAULT 0 CHECK (bonus_balance_after >= 0),
    
    -- Détails de la transaction
    description TEXT NOT NULL,
    service_name TEXT, -- Nom du service consommé (ex: 'ai_analysis', 'audio_summary')
    reference_id TEXT, -- ID de l'article/ressource concerné
    
    -- Informations de paiement (pour type='purchase')
    package_id UUID REFERENCES credit_packages(id),
    payment_method TEXT CHECK (payment_method IN ('mobile_money', 'credit_card', 'bank_transfer', 'admin', 'free')),
    payment_reference TEXT, -- Référence de transaction externe
    price_paid_xaf INTEGER, -- Montant payé en XAF
    
    -- Métadonnées
    metadata JSONB DEFAULT '{}', -- Données additionnelles (ex: openai_usage, article_id, etc.)
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_service ON credit_transactions(service_name);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON credit_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- ============================================
-- 4. TABLE: credit_costs (Coûts des services)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    cost_credits INTEGER NOT NULL CHECK (cost_credits > 0),
    description TEXT,
    category TEXT, -- 'content', 'ai', 'premium', 'alert'
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_credit_costs_service ON credit_costs(service_name);
CREATE INDEX IF NOT EXISTS idx_credit_costs_active ON credit_costs(is_active);

-- ============================================
-- 5. TABLE: credit_promotions (Promotions et offres spéciales)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'bonus_credits')),
    value INTEGER NOT NULL, -- Pourcentage ou montant selon le type
    min_purchase_xaf INTEGER DEFAULT 0,
    max_uses INTEGER, -- NULL = illimité
    uses_count INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_credit_promotions_code ON credit_promotions(code);
CREATE INDEX IF NOT EXISTS idx_credit_promotions_active ON credit_promotions(is_active, valid_from, valid_until);

-- ============================================
-- 6. RLS POLICIES (Row Level Security)
-- ============================================

-- Enable RLS
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_promotions ENABLE ROW LEVEL SECURITY;

-- Policies pour credit_packages (lecture publique)
CREATE POLICY "Anyone can view active packages" ON credit_packages
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage packages" ON credit_packages
    FOR ALL USING (auth.role() = 'service_role');

-- Policies pour user_credits
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user credits" ON user_credits
    FOR ALL USING (auth.role() = 'service_role');

-- Policies pour credit_transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions" ON credit_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Policies pour credit_costs (lecture publique)
CREATE POLICY "Anyone can view active costs" ON credit_costs
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage costs" ON credit_costs
    FOR ALL USING (auth.role() = 'service_role');

-- Policies pour credit_promotions (lecture publique pour codes actifs)
CREATE POLICY "Anyone can view active promotions" ON credit_promotions
    FOR SELECT USING (is_active = true AND NOW() BETWEEN valid_from AND COALESCE(valid_until, NOW() + INTERVAL '100 years'));

CREATE POLICY "Service role can manage promotions" ON credit_promotions
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 7. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour obtenir le solde total (balance + bonus_balance)
CREATE OR REPLACE FUNCTION get_total_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
    v_bonus_balance INTEGER;
BEGIN
    SELECT balance, bonus_balance INTO v_balance, v_bonus_balance
    FROM user_credits
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(v_balance, 0) + COALESCE(v_bonus_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour initialiser le compte crédits d'un nouvel utilisateur
CREATE OR REPLACE FUNCTION initialize_user_credits(p_user_id UUID, p_welcome_bonus INTEGER DEFAULT 50)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_credits (user_id, bonus_balance, total_earned)
    VALUES (p_user_id, p_welcome_bonus, p_welcome_bonus)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Enregistrer la transaction de bienvenue
    IF p_welcome_bonus > 0 THEN
        INSERT INTO credit_transactions (
            user_id, type, amount, balance_after, bonus_balance_after,
            description, service_name, status
        ) VALUES (
            p_user_id, 'welcome_bonus', p_welcome_bonus, 0, p_welcome_bonus,
            'Crédits de bienvenue', 'welcome_bonus', 'completed'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour consommer des crédits (utilise d'abord les bonus, puis les crédits achetés)
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_service_name TEXT,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
    v_new_balance INTEGER;
    v_new_bonus_balance INTEGER;
    v_amount_from_bonus INTEGER;
    v_amount_from_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Vérifier que le montant est positif
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Le montant doit être positif'
        );
    END IF;
    
    -- Récupérer le solde actuel avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Si l'utilisateur n'existe pas, créer son compte
    IF NOT FOUND THEN
        INSERT INTO user_credits (user_id, balance, bonus_balance)
        VALUES (p_user_id, 0, 0)
        RETURNING * INTO v_user_credits;
    END IF;
    
    -- Vérifier si l'utilisateur a assez de crédits
    IF (v_user_credits.balance + v_user_credits.bonus_balance) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Solde insuffisant',
            'balance', v_user_credits.balance,
            'bonus_balance', v_user_credits.bonus_balance,
            'required', p_amount
        );
    END IF;
    
    -- Calculer la répartition (bonus d'abord, puis balance)
    v_amount_from_bonus := LEAST(v_user_credits.bonus_balance, p_amount);
    v_amount_from_balance := p_amount - v_amount_from_bonus;
    
    v_new_bonus_balance := v_user_credits.bonus_balance - v_amount_from_bonus;
    v_new_balance := v_user_credits.balance - v_amount_from_balance;
    
    -- Mettre à jour le solde
    UPDATE user_credits
    SET 
        balance = v_new_balance,
        bonus_balance = v_new_bonus_balance,
        total_spent = total_spent + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, service_name, reference_id, metadata, status
    ) VALUES (
        p_user_id, 'consume', -p_amount, v_new_balance, v_new_bonus_balance,
        p_description, p_service_name, p_reference_id, p_metadata, 'completed'
    ) RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance', v_new_balance,
        'bonus_balance', v_new_bonus_balance,
        'total_balance', v_new_balance + v_new_bonus_balance,
        'consumed', p_amount,
        'from_bonus', v_amount_from_bonus,
        'from_balance', v_amount_from_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour ajouter des crédits (achat)
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_credits INTEGER,
    p_bonus_credits INTEGER DEFAULT 0,
    p_package_id UUID DEFAULT NULL,
    p_price_paid_xaf INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'admin',
    p_payment_reference TEXT DEFAULT NULL,
    p_description TEXT DEFAULT 'Achat de crédits'
)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
    v_new_balance INTEGER;
    v_new_bonus_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Vérifier que les montants sont positifs
    IF p_credits < 0 OR p_bonus_credits < 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Les montants doivent être positifs'
        );
    END IF;
    
    -- Récupérer le solde actuel avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Si l'utilisateur n'existe pas, créer son compte
    IF NOT FOUND THEN
        INSERT INTO user_credits (user_id, balance, bonus_balance, total_earned, last_purchase_at)
        VALUES (p_user_id, p_credits, p_bonus_credits, p_credits + p_bonus_credits, NOW())
        RETURNING * INTO v_user_credits;
        
        v_new_balance := p_credits;
        v_new_bonus_balance := p_bonus_credits;
    ELSE
        -- Mettre à jour le solde
        v_new_balance := v_user_credits.balance + p_credits;
        v_new_bonus_balance := v_user_credits.bonus_balance + p_bonus_credits;
        
        UPDATE user_credits
        SET 
            balance = v_new_balance,
            bonus_balance = v_new_bonus_balance,
            total_earned = total_earned + p_credits + p_bonus_credits,
            last_purchase_at = NOW(),
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;
    
    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, package_id, payment_method, payment_reference,
        price_paid_xaf, status
    ) VALUES (
        p_user_id, 'purchase', p_credits + p_bonus_credits, v_new_balance, v_new_bonus_balance,
        p_description, p_package_id, p_payment_method, p_payment_reference,
        p_price_paid_xaf, 'completed'
    ) RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance', v_new_balance,
        'bonus_balance', v_new_bonus_balance,
        'total_balance', v_new_balance + v_new_bonus_balance,
        'credits_added', p_credits,
        'bonus_added', p_bonus_credits
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour rembourser des crédits
CREATE OR REPLACE FUNCTION refund_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Récupérer le solde actuel avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Utilisateur non trouvé'
        );
    END IF;
    
    v_new_balance := v_user_credits.balance + p_amount;
    
    -- Mettre à jour le solde
    UPDATE user_credits
    SET 
        balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, reference_id, status
    ) VALUES (
        p_user_id, 'refund', p_amount, v_new_balance, v_user_credits.bonus_balance,
        p_description, p_reference_id, 'completed'
    ) RETURNING id INTO v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance', v_new_balance,
        'bonus_balance', v_user_credits.bonus_balance,
        'total_balance', v_new_balance + v_user_credits.bonus_balance,
        'refunded', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. TRIGGER: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_credit_packages_updated_at BEFORE UPDATE ON credit_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_costs_updated_at BEFORE UPDATE ON credit_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_promotions_updated_at BEFORE UPDATE ON credit_promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. SEED DATA: Packages de crédits
-- ============================================

INSERT INTO credit_packages (name, slug, credits, bonus_credits, price_xaf, price_usd, discount_percentage, is_popular, sort_order, description, features) VALUES
-- Pack Starter
('Pack Starter', 'starter', 100, 0, 5000, 8.50, 0, false, 1, 
'Idéal pour découvrir nos services premium',
'["100 crédits", "Valable 6 mois", "Support email"]'::jsonb),

-- Pack Standard (POPULAIRE)
('Pack Standard', 'standard', 300, 50, 12000, 20.00, 17, true, 2,
'Le meilleur rapport qualité-prix',
'["300 crédits", "50 crédits bonus", "Économie de 17%", "Valable 1 an", "Support prioritaire"]'::jsonb),

-- Pack Premium
('Pack Premium', 'premium', 600, 150, 20000, 34.00, 33, false, 3,
'Pour les utilisateurs intensifs',
'["600 crédits", "150 crédits bonus", "Économie de 33%", "Valable 1 an", "Support VIP", "Accès anticipé aux nouvelles fonctionnalités"]'::jsonb),

-- Pack Business
('Pack Business', 'business', 1500, 500, 45000, 75.00, 40, false, 4,
'Solution professionnelle complète',
'["1500 crédits", "500 crédits bonus", "Économie de 40%", "Valable 2 ans", "Support dédié 24/7", "API Access", "Rapports personnalisés", "Formation incluse"]'::jsonb);

-- ============================================
-- 10. SEED DATA: Coûts des services
-- ============================================

INSERT INTO credit_costs (service_name, display_name, cost_credits, description, category, is_active) VALUES
-- Contenu Premium
('article_premium', 'Article Premium', 1, 'Accès à un article premium complet', 'content', true),
('article_archive', 'Article Archive', 2, 'Accès à un article d''archive (>6 mois)', 'content', true),
('pdf_export', 'Export PDF', 3, 'Exporter un article en PDF', 'content', true),

-- Services IA
('ai_summary', 'Résumé IA', 5, 'Génération d''un résumé IA d''un article', 'ai', true),
('ai_analysis', 'Analyse IA Approfondie', 10, 'Analyse IA détaillée d''un article ou sujet', 'ai', true),
('ai_translation', 'Traduction IA', 8, 'Traduction automatique d''un article', 'ai', true),
('audio_summary', 'Résumé Audio', 5, 'Génération d''un résumé audio', 'ai', true),

-- Veille et Opportunités
('veille_report', 'Rapport de Veille', 20, 'Génération d''un rapport de veille personnalisé', 'premium', true),
('opportunity_analysis', 'Analyse d''Opportunité', 15, 'Analyse d''opportunité business', 'premium', true),
('competitor_analysis', 'Analyse Concurrentielle', 25, 'Analyse concurrentielle approfondie', 'premium', true),

-- Alertes et Notifications
('custom_alert', 'Alerte Personnalisée', 3, 'Création d''une alerte personnalisée', 'alert', true),
('alert_premium', 'Alerte Premium (temps réel)', 5, 'Alerte en temps réel avec notifications push', 'alert', true);

-- ============================================
-- 11. SEED DATA: Promotions (exemples)
-- ============================================

INSERT INTO credit_promotions (code, type, value, min_purchase_xaf, max_uses, valid_from, valid_until, description) VALUES
('WELCOME2025', 'bonus_credits', 50, 10000, 1000, NOW(), NOW() + INTERVAL '30 days', 'Offre de bienvenue: +50 crédits bonus pour tout achat ≥ 10 000 XAF'),
('BLACKFRIDAY', 'percentage', 30, 0, NULL, NOW(), NOW() + INTERVAL '7 days', 'Black Friday: -30% sur tous les packs'),
('NEWYEAR', 'fixed_amount', 2000, 15000, 500, NOW(), NOW() + INTERVAL '15 days', 'Nouvel An: -2000 XAF sur les achats ≥ 15 000 XAF');

-- ============================================
-- FIN DU SCRIPT
-- ============================================

-- Afficher un message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Système de crédits premium créé avec succès!';
    RAISE NOTICE '📦 4 packages de crédits configurés';
    RAISE NOTICE '💰 10 services avec coûts définis';
    RAISE NOTICE '🎁 3 promotions actives';
END $$;
