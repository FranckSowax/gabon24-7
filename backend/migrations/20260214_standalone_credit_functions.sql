-- ============================================
-- Migration: Standalone credit functions
-- Date: 2026-02-14
-- Description: Creates add_credits and consume_credits RPC functions
--              as standalone (previously embedded in PVIT migration)
-- ============================================

-- Function: add_credits
-- Adds credits to a user's account with transaction logging
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_credits INTEGER,
    p_bonus_credits INTEGER DEFAULT 0,
    p_package_id UUID DEFAULT NULL,
    p_price_paid_xaf INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'ebilling',
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
    -- Récupérer ou créer le compte crédits avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO user_credits (user_id, balance, bonus_balance, total_earned)
        VALUES (p_user_id, 0, 0, 0)
        RETURNING * INTO v_user_credits;
    END IF;

    -- Calculer les nouveaux soldes
    v_new_balance := COALESCE(v_user_credits.balance, 0) + p_credits;
    v_new_bonus_balance := COALESCE(v_user_credits.bonus_balance, 0) + p_bonus_credits;

    -- Mettre à jour les soldes
    UPDATE user_credits
    SET
        balance = v_new_balance,
        bonus_balance = v_new_bonus_balance,
        total_earned = COALESCE(total_earned, 0) + p_credits + p_bonus_credits,
        last_purchase_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, package_id, payment_method, payment_reference,
        price_paid_xaf, status
    ) VALUES (
        p_user_id, 'purchase', p_credits + p_bonus_credits,
        v_new_balance, v_new_bonus_balance,
        p_description, p_package_id, p_payment_method,
        p_payment_reference, p_price_paid_xaf, 'completed'
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
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: consume_credits
-- Consumes credits from a user's account
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_service_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
    v_remaining INTEGER;
    v_from_balance INTEGER;
    v_from_bonus INTEGER;
BEGIN
    -- Récupérer le compte crédits avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Aucun compte crédits trouvé'
        );
    END IF;

    -- Vérifier le solde total
    IF (COALESCE(v_user_credits.balance, 0) + COALESCE(v_user_credits.bonus_balance, 0)) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Solde insuffisant',
            'balance', COALESCE(v_user_credits.balance, 0),
            'bonus_balance', COALESCE(v_user_credits.bonus_balance, 0)
        );
    END IF;

    -- Consommer d'abord les bonus, puis le solde principal
    v_remaining := p_amount;
    v_from_bonus := LEAST(v_remaining, COALESCE(v_user_credits.bonus_balance, 0));
    v_remaining := v_remaining - v_from_bonus;
    v_from_balance := v_remaining;

    -- Mettre à jour les soldes
    UPDATE user_credits
    SET
        balance = COALESCE(balance, 0) - v_from_balance,
        bonus_balance = COALESCE(bonus_balance, 0) - v_from_bonus,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, service_name, status
    ) VALUES (
        p_user_id, 'consumption', -p_amount,
        COALESCE(v_user_credits.balance, 0) - v_from_balance,
        COALESCE(v_user_credits.bonus_balance, 0) - v_from_bonus,
        COALESCE(p_description, 'Utilisation ' || p_service_name),
        p_service_name, 'completed'
    );

    RETURN jsonb_build_object(
        'success', true,
        'balance', COALESCE(v_user_credits.balance, 0) - v_from_balance,
        'bonus_balance', COALESCE(v_user_credits.bonus_balance, 0) - v_from_bonus,
        'amount_consumed', p_amount
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
