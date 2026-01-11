-- Migration: Corriger le trigger handle_new_user
-- Date: 2026-01-11
-- Problème: Le trigger échoue car il n'insère pas toutes les colonnes requises
-- Solution: Ajouter toutes les colonnes avec des valeurs par défaut

-- 1. Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Recréer la fonction handle_new_user avec toutes les colonnes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    role,
    is_admin,
    full_name,
    subscription_type,
    subscription_status,
    subscription_start_date,
    preferred_language,
    notification_preferences,
    is_active,
    journalist_verified,
    credits_balance,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'free',
    'active',
    NOW(),
    'fr',
    '{"sms": false, "email": true, "whatsapp": true}'::jsonb,
    true,
    false,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    updated_at = NOW();

  -- Créer aussi l'entrée user_credits
  INSERT INTO public.user_credits (user_id, balance, updated_at)
  VALUES (NEW.id, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log l'erreur mais ne pas bloquer la création de l'utilisateur
    RAISE WARNING 'Erreur dans handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recréer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Vérifier que la table users a les bonnes colonnes avec des défauts
-- (Au cas où certaines colonnes seraient NOT NULL sans défaut)
DO $$
BEGIN
  -- S'assurer que subscription_type a un défaut
  ALTER TABLE public.users ALTER COLUMN subscription_type SET DEFAULT 'free';
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- S'assurer que subscription_status a un défaut
  ALTER TABLE public.users ALTER COLUMN subscription_status SET DEFAULT 'active';
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- S'assurer que is_active a un défaut
  ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT true;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- S'assurer que credits_balance a un défaut
  ALTER TABLE public.users ALTER COLUMN credits_balance SET DEFAULT 0;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Commentaire
COMMENT ON FUNCTION public.handle_new_user() IS 'Crée automatiquement un profil utilisateur quand un nouvel utilisateur s''inscrit via Supabase Auth';
