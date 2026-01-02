-- =====================================================
-- MIGRATION: Fonctions RPC pour gestion des crédits d'abonnement
-- Date: 2026-01-02
-- Description: Fonctions pour attribuer et gérer les crédits des abonnements
-- =====================================================

-- S'assurer que la table user_credits existe
CREATE TABLE IF NOT EXISTS user_credits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    total_consumed INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- S'assurer que la table credit_transactions existe
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'subscription', 'bonus', 'consumption', 'refund', 'expiry')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);

-- RLS sur user_credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leur propre solde
DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

-- Politique: Service role peut tout faire
DROP POLICY IF EXISTS "Service role manages credits" ON user_credits;
CREATE POLICY "Service role manages credits" ON user_credits
    FOR ALL USING (true);

-- RLS sur credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- FONCTION: add_user_credits
-- Ajoute des crédits au compte d'un utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION add_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT DEFAULT 'manual',
    p_description TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    -- Insérer ou mettre à jour le solde
    INSERT INTO user_credits (user_id, balance, total_purchased, updated_at)
    VALUES (p_user_id, p_amount, p_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = user_credits.balance + p_amount,
        total_purchased = user_credits.total_purchased + p_amount,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- Enregistrer la transaction
    INSERT INTO credit_transactions (user_id, amount, type, description, metadata)
    VALUES (
        p_user_id,
        p_amount,
        CASE
            WHEN p_reason LIKE 'subscription%' THEN 'subscription'
            WHEN p_reason LIKE 'admin%' THEN 'bonus'
            WHEN p_reason = 'purchase' THEN 'purchase'
            ELSE 'bonus'
        END,
        COALESCE(p_description, 'Crédits ajoutés: ' || p_reason),
        jsonb_build_object('reason', p_reason, 'added_at', NOW())
    );

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: grant_subscription_credits
-- Attribue les crédits mensuels d'un abonnement
-- =====================================================
CREATE OR REPLACE FUNCTION grant_subscription_credits(
    p_user_id UUID,
    p_plan_slug TEXT
) RETURNS JSONB AS $$
DECLARE
    v_monthly_credits INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Récupérer les crédits mensuels du plan
    SELECT monthly_credits INTO v_monthly_credits
    FROM subscription_plans
    WHERE slug = p_plan_slug;

    IF v_monthly_credits IS NULL OR v_monthly_credits = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'credits', 0,
            'message', 'Plan gratuit, pas de crédits'
        );
    END IF;

    -- Attribuer les crédits
    v_new_balance := add_user_credits(
        p_user_id,
        v_monthly_credits,
        'subscription_monthly',
        'Crédits mensuels - Plan ' || p_plan_slug
    );

    RETURN jsonb_build_object(
        'success', true,
        'credits', v_monthly_credits,
        'new_balance', v_new_balance,
        'plan', p_plan_slug
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: get_user_by_email
-- Récupère l'ID utilisateur par email (pour admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: get_user_credit_balance
-- Récupère le solde de crédits d'un utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT balance INTO v_balance
    FROM user_credits
    WHERE user_id = p_user_id;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION: consume_user_credits
-- Consomme des crédits du compte utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION consume_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_feature TEXT DEFAULT 'unknown',
    p_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Récupérer le solde actuel
    SELECT balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id;

    v_current_balance := COALESCE(v_current_balance, 0);

    -- Vérifier si suffisant
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_credits',
            'current_balance', v_current_balance,
            'required', p_amount
        );
    END IF;

    -- Déduire les crédits
    UPDATE user_credits
    SET balance = balance - p_amount,
        total_consumed = total_consumed + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    -- Enregistrer la transaction
    INSERT INTO credit_transactions (user_id, amount, type, description, metadata)
    VALUES (
        p_user_id,
        -p_amount,
        'consumption',
        COALESCE(p_description, 'Utilisation: ' || p_feature),
        jsonb_build_object('feature', p_feature, 'consumed_at', NOW())
    );

    RETURN jsonb_build_object(
        'success', true,
        'consumed', p_amount,
        'new_balance', v_new_balance,
        'feature', p_feature
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Attribution automatique des crédits à la création d'abonnement
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_grant_subscription_credits()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_slug TEXT;
BEGIN
    -- Seulement pour les nouveaux abonnements actifs
    IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
        -- Récupérer le slug du plan
        SELECT slug INTO v_plan_slug
        FROM subscription_plans
        WHERE id = NEW.plan_id;

        IF v_plan_slug IS NOT NULL THEN
            -- Attribuer les crédits
            PERFORM grant_subscription_credits(NEW.user_id, v_plan_slug);

            RAISE NOTICE 'Crédits attribués pour abonnement % (plan: %)', NEW.id, v_plan_slug;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS on_subscription_activated ON subscriptions;

-- Créer le trigger
CREATE TRIGGER on_subscription_activated
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_grant_subscription_credits();

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON FUNCTION add_user_credits IS 'Ajoute des crédits au compte d''un utilisateur';
COMMENT ON FUNCTION grant_subscription_credits IS 'Attribue les crédits mensuels selon le plan d''abonnement';
COMMENT ON FUNCTION consume_user_credits IS 'Consomme des crédits pour une fonctionnalité IA';
COMMENT ON FUNCTION get_user_credit_balance IS 'Récupère le solde de crédits d''un utilisateur';
COMMENT ON TRIGGER on_subscription_activated ON subscriptions IS 'Attribution automatique des crédits lors de l''activation d''un abonnement';
