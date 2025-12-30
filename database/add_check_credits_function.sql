-- ============================================
-- Fonction pour vérifier les crédits avant consommation
-- ============================================

CREATE OR REPLACE FUNCTION check_user_credits(
    p_user_id UUID,
    p_service_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
    v_bonus_balance INTEGER;
    v_total_balance INTEGER;
    v_required_credits INTEGER;
    v_has_enough BOOLEAN;
    v_missing INTEGER;
BEGIN
    -- Récupérer le solde de l'utilisateur
    SELECT balance, bonus_balance
    INTO v_balance, v_bonus_balance
    FROM user_credits
    WHERE user_id = p_user_id;
    
    -- Si l'utilisateur n'existe pas, retourner 0
    IF NOT FOUND THEN
        v_balance := 0;
        v_bonus_balance := 0;
    END IF;
    
    v_total_balance := COALESCE(v_balance, 0) + COALESCE(v_bonus_balance, 0);
    
    -- Récupérer le coût du service
    SELECT cost_credits
    INTO v_required_credits
    FROM credit_costs
    WHERE service_name = p_service_name
    AND is_active = true;
    
    -- Si le service n'existe pas, retourner une erreur
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service % non trouvé', p_service_name;
    END IF;
    
    -- Vérifier si l'utilisateur a assez de crédits
    v_has_enough := v_total_balance >= v_required_credits;
    v_missing := GREATEST(0, v_required_credits - v_total_balance);
    
    -- Retourner le résultat en JSON
    RETURN json_build_object(
        'has_enough', v_has_enough,
        'balance', v_total_balance,
        'required', v_required_credits,
        'missing', v_missing,
        'balance_details', json_build_object(
            'purchased', v_balance,
            'bonus', v_bonus_balance
        )
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION check_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_credits TO anon;
