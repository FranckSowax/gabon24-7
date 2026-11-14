-- ============================================================
-- 20261115_refund_credits_split.sql
-- Remboursement de crédits qui respecte l'origine du débit
-- ============================================================
-- consume_credits débite d'abord le solde bonus, puis le solde principal, et
-- renvoie la répartition (from_bonus / from_balance). L'ancienne fonction
-- refund_credits recréditait tout sur le solde principal : un service payé en
-- crédits bonus puis remboursé transformait du bonus en crédits achetés.
--
-- Cette migration AJOUTE refund_credits_split sans toucher à refund_credits.
-- Le backend appelle la nouvelle fonction et retombe sur l'ancienne tant que
-- cette migration n'est pas appliquée.
--
-- Garde anti-double remboursement : quand p_reference_id est fourni (id de la
-- transaction de débit d'origine), un second remboursement portant la même
-- référence pour le même utilisateur est refusé.
--
-- Idempotente (CREATE OR REPLACE). Réservée à service_role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_credits_split(
    p_user_id UUID,
    p_from_balance INTEGER,
    p_from_bonus INTEGER,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from_balance INTEGER := COALESCE(p_from_balance, 0);
    v_from_bonus INTEGER := COALESCE(p_from_bonus, 0);
    v_user_credits RECORD;
    v_new_balance INTEGER;
    v_new_bonus_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    IF v_from_balance < 0 OR v_from_bonus < 0 OR (v_from_balance + v_from_bonus) <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Montant de remboursement invalide');
    END IF;

    -- Verrouille le compte : sérialise aussi le contrôle anti-doublon ci-dessous.
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
    END IF;

    IF p_reference_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM credit_transactions
        WHERE user_id = p_user_id AND type = 'refund' AND reference_id = p_reference_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Déjà remboursé', 'already_refunded', true);
    END IF;

    v_new_balance := COALESCE(v_user_credits.balance, 0) + v_from_balance;
    v_new_bonus_balance := COALESCE(v_user_credits.bonus_balance, 0) + v_from_bonus;

    UPDATE user_credits
    SET
        balance = v_new_balance,
        bonus_balance = v_new_bonus_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, reference_id, status
    ) VALUES (
        p_user_id, 'refund', v_from_balance + v_from_bonus, v_new_balance, v_new_bonus_balance,
        p_description, p_reference_id, 'completed'
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance', v_new_balance,
        'bonus_balance', v_new_bonus_balance,
        'total_balance', v_new_balance + v_new_bonus_balance,
        'refunded', v_from_balance + v_from_bonus,
        'to_balance', v_from_balance,
        'to_bonus', v_from_bonus
    );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits_split(uuid, integer, integer, text, text) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION public.refund_credits_split(uuid, integer, integer, text, text) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION public.refund_credits_split(uuid, integer, integer, text, text) FROM authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.refund_credits_split(uuid, integer, integer, text, text) TO service_role;
    END IF;
END $$;
