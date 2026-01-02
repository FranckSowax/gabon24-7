-- =====================================================
-- MIGRATION: Système de paiement PVIT complet
-- Date: 2026-01-02
-- Description: Tables et fonctions pour paiements Mobile Money
-- =====================================================

-- =====================================================
-- 1. TABLE: pvit_current_key
-- Stockage sécurisé des clés API PVIT
-- =====================================================
CREATE TABLE IF NOT EXISTS pvit_current_key (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_account_code VARCHAR(255) NOT NULL,
    secret_key TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    key_source VARCHAR(50) DEFAULT 'pvit_api',
    is_valid BOOLEAN DEFAULT true,
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Supprimer l'index s'il existe et le recréer
DROP INDEX IF EXISTS idx_pvit_key_account;
CREATE UNIQUE INDEX idx_pvit_key_account ON pvit_current_key(operation_account_code) WHERE is_valid = true;

DROP INDEX IF EXISTS idx_pvit_key_valid_expires;
CREATE INDEX idx_pvit_key_valid_expires ON pvit_current_key(is_valid, expires_at DESC) WHERE is_valid = true;

-- =====================================================
-- 2. TABLE: pvit_payments
-- Enregistrement des transactions PVIT
-- =====================================================
CREATE TABLE IF NOT EXISTS pvit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_id VARCHAR(255),
    reference VARCHAR(255) NOT NULL,
    merchant_reference_id VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    -- Type de paiement
    payment_type VARCHAR(50) DEFAULT 'credits' CHECK (payment_type IN ('credits', 'subscription', 'quiz')),
    -- Pour les crédits
    package_id UUID,
    credits_to_add INTEGER DEFAULT 0,
    bonus_credits INTEGER DEFAULT 0,
    -- Pour les abonnements
    plan_slug VARCHAR(100),
    plan_duration INTEGER DEFAULT 1,
    -- Pour les quiz
    quiz_id UUID,
    -- Réponses PVIT
    pvit_response JSONB,
    callback_data JSONB,
    metadata JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
);

-- Index pour recherches fréquentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvit_payments_reference ON pvit_payments(reference);
CREATE INDEX IF NOT EXISTS idx_pvit_payments_user_id ON pvit_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pvit_payments_status ON pvit_payments(status);
CREATE INDEX IF NOT EXISTS idx_pvit_payments_type ON pvit_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_pvit_payments_created_at ON pvit_payments(created_at DESC);

-- =====================================================
-- 3. TABLE: pvit_callback_logs
-- Logs de tous les callbacks reçus (audit)
-- =====================================================
CREATE TABLE IF NOT EXISTS pvit_callback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(255),
    merchant_reference_id VARCHAR(255),
    status VARCHAR(50),
    amount DECIMAL(15, 2),
    raw_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvit_callback_logs_reference ON pvit_callback_logs(reference);
CREATE INDEX IF NOT EXISTS idx_pvit_callback_logs_created_at ON pvit_callback_logs(created_at DESC);

-- =====================================================
-- 4. TABLE: quiz_participants (pour les inscriptions Quiz)
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_reference VARCHAR(255),
    payment_amount DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'registered' CHECK (status IN ('registered', 'playing', 'eliminated', 'winner')),
    score INTEGER DEFAULT 0,
    rank INTEGER,
    registered_at TIMESTAMP DEFAULT NOW(),
    played_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_quiz_participants_quiz ON quiz_participants(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_user ON quiz_participants(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_participants_unique ON quiz_participants(quiz_id, user_id);

-- =====================================================
-- 5. RLS Policies
-- =====================================================

-- pvit_payments
ALTER TABLE pvit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON pvit_payments;
CREATE POLICY "Users can view own payments" ON pvit_payments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access payments" ON pvit_payments;
CREATE POLICY "Service role full access payments" ON pvit_payments
    FOR ALL USING (true);

-- pvit_current_key (admin only)
ALTER TABLE pvit_current_key ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages keys" ON pvit_current_key;
CREATE POLICY "Service role manages keys" ON pvit_current_key
    FOR ALL USING (true);

-- pvit_callback_logs (admin only)
ALTER TABLE pvit_callback_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages callback logs" ON pvit_callback_logs;
CREATE POLICY "Service role manages callback logs" ON pvit_callback_logs
    FOR ALL USING (true);

-- quiz_participants
ALTER TABLE quiz_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quiz participation" ON quiz_participants;
CREATE POLICY "Users can view own quiz participation" ON quiz_participants
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages quiz participants" ON quiz_participants;
CREATE POLICY "Service role manages quiz participants" ON quiz_participants
    FOR ALL USING (true);

-- =====================================================
-- 6. FONCTION: process_pvit_callback
-- Traite un callback PVIT et exécute l'action appropriée
-- =====================================================
CREATE OR REPLACE FUNCTION process_pvit_callback(
    p_reference TEXT,
    p_status TEXT,
    p_merchant_reference_id TEXT DEFAULT NULL,
    p_callback_data JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_internal_status TEXT;
    v_plan RECORD;
    v_result JSONB;
BEGIN
    -- Mapper le statut PVIT
    v_internal_status := CASE UPPER(p_status)
        WHEN 'SUCCESS' THEN 'completed'
        WHEN 'SUCCESSFUL' THEN 'completed'
        WHEN 'COMPLETED' THEN 'completed'
        WHEN 'FAILED' THEN 'failed'
        WHEN 'FAILURE' THEN 'failed'
        WHEN 'CANCELLED' THEN 'cancelled'
        ELSE 'pending'
    END;

    -- Récupérer le paiement
    SELECT * INTO v_payment
    FROM pvit_payments
    WHERE reference = p_reference
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
    END IF;

    -- Ne pas retraiter un paiement complété
    IF v_payment.status = 'completed' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Déjà traité');
    END IF;

    -- Mettre à jour le paiement
    UPDATE pvit_payments
    SET status = v_internal_status,
        merchant_reference_id = COALESCE(p_merchant_reference_id, merchant_reference_id),
        callback_data = p_callback_data,
        updated_at = NOW(),
        completed_at = CASE WHEN v_internal_status = 'completed' THEN NOW() ELSE NULL END
    WHERE id = v_payment.id;

    -- Si complété, exécuter l'action
    IF v_internal_status = 'completed' AND v_payment.user_id IS NOT NULL THEN
        CASE v_payment.payment_type
            WHEN 'credits' THEN
                -- Ajouter les crédits
                IF v_payment.credits_to_add > 0 THEN
                    PERFORM add_credits(
                        v_payment.user_id,
                        v_payment.credits_to_add,
                        COALESCE(v_payment.bonus_credits, 0),
                        v_payment.package_id,
                        v_payment.amount::INTEGER,
                        'pvit',
                        p_merchant_reference_id,
                        'Achat Mobile Money - ' || p_reference
                    );
                END IF;

            WHEN 'subscription' THEN
                -- Récupérer le plan
                SELECT * INTO v_plan
                FROM subscription_plans
                WHERE slug = v_payment.plan_slug;

                IF FOUND THEN
                    -- Désactiver les anciens abonnements
                    UPDATE subscriptions
                    SET status = 'expired', updated_at = NOW()
                    WHERE user_id = v_payment.user_id AND status = 'active';

                    -- Créer le nouvel abonnement
                    INSERT INTO subscriptions (
                        user_id, plan_id, status, payment_method,
                        current_period_start, current_period_end, metadata
                    ) VALUES (
                        v_payment.user_id,
                        v_plan.id,
                        'active',
                        'mobile_money',
                        NOW(),
                        NOW() + (COALESCE(v_payment.plan_duration, 1) || ' months')::INTERVAL,
                        jsonb_build_object(
                            'pvit_reference', p_merchant_reference_id,
                            'payment_amount', v_payment.amount
                        )
                    );

                    -- Attribuer les crédits mensuels
                    IF v_plan.monthly_credits > 0 THEN
                        PERFORM add_user_credits(
                            v_payment.user_id,
                            v_plan.monthly_credits,
                            'subscription_activation',
                            'Crédits mensuels - Abonnement ' || v_plan.name
                        );
                    END IF;
                END IF;

            WHEN 'quiz' THEN
                -- Inscrire au quiz
                IF v_payment.quiz_id IS NOT NULL THEN
                    INSERT INTO quiz_participants (
                        quiz_id, user_id, payment_reference, payment_amount, status
                    ) VALUES (
                        v_payment.quiz_id,
                        v_payment.user_id,
                        p_merchant_reference_id,
                        v_payment.amount,
                        'registered'
                    ) ON CONFLICT (quiz_id, user_id) DO NOTHING;
                END IF;
        END CASE;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_internal_status,
        'payment_type', v_payment.payment_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FONCTION: get_user_payments
-- Récupère l'historique des paiements d'un utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_payments(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    reference TEXT,
    amount DECIMAL,
    status TEXT,
    payment_type TEXT,
    description TEXT,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.id,
        pp.reference::TEXT,
        pp.amount,
        pp.status::TEXT,
        pp.payment_type::TEXT,
        pp.description::TEXT,
        pp.created_at,
        pp.completed_at
    FROM pvit_payments pp
    WHERE pp.user_id = p_user_id
    ORDER BY pp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTAIRES
-- =====================================================
COMMENT ON TABLE pvit_payments IS 'Transactions de paiement PVIT (Mobile Money)';
COMMENT ON TABLE pvit_current_key IS 'Clés secrètes PVIT (rotation automatique)';
COMMENT ON TABLE pvit_callback_logs IS 'Logs des callbacks PVIT pour audit';
COMMENT ON TABLE quiz_participants IS 'Participants aux quiz payants';
COMMENT ON FUNCTION process_pvit_callback IS 'Traite un callback PVIT et exécute l''action (crédits/abonnement/quiz)';
