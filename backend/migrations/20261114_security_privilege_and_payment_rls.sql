-- ============================================================
-- 20261114_security_privilege_and_payment_rls.sql
-- Audit de mise en production du 2026-11-14 — correctifs base de données
-- ============================================================
-- Ferme quatre failles exploitables avec la clé anon + le JWT d'un simple inscrit :
--   1. Admin à l'inscription : handle_new_user copiait is_admin / role depuis
--      raw_user_meta_data, que le client contrôle au signUp.
--   2. Auto-promotion : la policy UPDATE de public.users laissait modifier toute
--      sa ligne (is_admin, subscription_type, credits_balance...).
--   3. Tables de crédits / paiements / abonnements : policies "service role"
--      écrites USING (true) sans TO service_role, donc valables pour tous.
--   4. Buckets de stockage ouverts en écriture / suppression à tout le monde.
--
-- Le backend utilise la clé service_role (bypass RLS) : il n'est pas impacté.
-- Effets voulus côté navigateur (c'étaient les failles) :
--   - plus d'écriture directe sur les soldes, transactions et abonnements ;
--   - seul l'essai gratuit de 7 jours reste créable à l'inscription (1 par compte) ;
--   - un utilisateur peut toujours BAISSER son solde (consommation), jamais l'augmenter.
--
-- Idempotente : chaque bloc vérifie l'existence des objets avant d'agir, le
-- schéma réel de production n'étant pas reconstructible depuis le dépôt.
--
-- AVANT D'APPLIQUER, vérifier qu'aucun compte ne s'est déjà promu :
--   SELECT id, email, created_at FROM public.users WHERE is_admin = true ORDER BY created_at;
-- ============================================================


-- ------------------------------------------------------------
-- 0. Helpers
-- ------------------------------------------------------------

-- Vrai si l'appelant est admin. SECURITY DEFINER pour lire public.users sans
-- dépendre de ses policies (évite toute récursion RLS).
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT u.is_admin FROM public.users u WHERE u.id = auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, service_role;

-- Vrai si le compte a déjà eu un abonnement (sert à limiter l'essai gratuit à un seul).
CREATE OR REPLACE FUNCTION public.user_has_any_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found boolean := false;
BEGIN
  IF to_regclass('public.subscriptions') IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = $1)'
    INTO found USING p_user_id;
  RETURN found;
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_any_subscription(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_any_subscription(uuid) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 1. Inscription : ne plus jamais lire is_admin / role depuis le client
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'user',   -- SECURITE : jamais depuis raw_user_meta_data
    false,    -- SECURITE : jamais depuis raw_user_meta_data
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

  INSERT INTO public.user_credits (user_id, balance, updated_at)
  VALUES (NEW.id, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Ne pas bloquer la création du compte si le profil échoue
    RAISE WARNING 'Erreur dans handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crée le profil à l''inscription. role et is_admin sont fixés côté serveur, jamais lus dans les métadonnées client.';


-- ------------------------------------------------------------
-- 2. public.users : colonnes privilégiées protégées
-- ------------------------------------------------------------
-- La RLS ne sait pas restreindre par colonne : un trigger refuse toute
-- modification des colonnes privilégiées par un appelant anon/authenticated
-- non admin. service_role, postgres (SQL editor) et les admins ne sont pas concernés.
-- to_jsonb() permet de ne référencer que les colonnes réellement présentes.
CREATE OR REPLACE FUNCTION public.protect_users_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := COALESCE(auth.role(), '');
  locked_columns constant text[] := ARRAY[
    'is_admin', 'role',
    'subscription_type', 'subscription_status',
    'subscription_start_date', 'subscription_end_date',
    'journalist_verified', 'is_active'
  ];
  balance_columns constant text[] := ARRAY['credits_balance', 'whatsapp_credits'];
  old_row jsonb;
  new_row jsonb;
  col text;
  forced jsonb := '{}'::jsonb;
BEGIN
  -- Backend (service_role) et sessions SQL directes : aucun contrôle
  IF caller_role NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- Les admins gèrent les comptes depuis le back-office
  IF public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  new_row := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    -- Profil créé depuis le navigateur : valeurs privilégiées forcées
    IF new_row ? 'is_admin'            THEN forced := forced || jsonb_build_object('is_admin', false); END IF;
    IF new_row ? 'role'                THEN forced := forced || jsonb_build_object('role', 'user'); END IF;
    IF new_row ? 'subscription_type'   THEN forced := forced || jsonb_build_object('subscription_type', 'free'); END IF;
    IF new_row ? 'journalist_verified' THEN forced := forced || jsonb_build_object('journalist_verified', false); END IF;
    IF new_row ? 'credits_balance'     THEN forced := forced || jsonb_build_object('credits_balance', 0); END IF;
    IF new_row ? 'whatsapp_credits'    THEN forced := forced || jsonb_build_object('whatsapp_credits', 0); END IF;
    RETURN jsonb_populate_record(NEW, forced);
  END IF;

  old_row := to_jsonb(OLD);

  FOREACH col IN ARRAY locked_columns LOOP
    IF (new_row -> col) IS DISTINCT FROM (old_row -> col) THEN
      RAISE EXCEPTION 'Modification non autorisée de la colonne %', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- Soldes : la consommation (baisse) reste possible, jamais la hausse
  FOREACH col IN ARRAY balance_columns LOOP
    IF (new_row ->> col) IS DISTINCT FROM (old_row ->> col)
       AND COALESCE((new_row ->> col)::numeric, 0) > COALESCE((old_row ->> col)::numeric, 0) THEN
      RAISE EXCEPTION 'Augmentation non autorisée de la colonne %', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS protect_users_privileged_columns ON public.users;
    CREATE TRIGGER protect_users_privileged_columns
      BEFORE INSERT OR UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.protect_users_privileged_columns();

    -- Policy UPDATE : ajouter le WITH CHECK manquant (on ne peut pas "donner" sa ligne)
    DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
    CREATE POLICY "Users can update own profile"
      ON public.users
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);

    -- Back-office : gestion des comptes par les admins (is_admin lu en base)
    DROP POLICY IF EXISTS "Admins manage users" ON public.users;
    CREATE POLICY "Admins manage users"
      ON public.users
      FOR ALL
      TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin());
  END IF;
END $$;


-- ------------------------------------------------------------
-- 3. Tables financières : écriture réservée au backend
-- ------------------------------------------------------------
-- Pour chaque table : toute policy d'écriture applicable à anon / authenticated /
-- public est restreinte à service_role ; puis lecture de ses propres lignes et
-- accès complet des admins (back-office).
DO $$
DECLARE
  t text;
  pol record;
  has_user_id boolean;
  financial_tables constant text[] := ARRAY[
    'user_credits', 'credit_transactions', 'transactions',
    'pvit_payments', 'ebilling_payments', 'campaign_payments',
    'quiz_participants', 'subscriptions', 'user_subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY financial_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Table public.% absente, ignorée', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
        AND policyname NOT IN ('admin_all', 'trial_insert_own')
    LOOP
      EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', pol.policyname, t);
      RAISE NOTICE 'Policy "%" sur % restreinte à service_role', pol.policyname, t;
    END LOOP;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) INTO has_user_id;

    IF has_user_id THEN
      EXECUTE format('DROP POLICY IF EXISTS own_select ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY own_select ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated '
      'USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin())', t);
  END LOOP;
END $$;

-- Essai gratuit à l'inscription : seule écriture navigateur conservée sur
-- subscriptions. Uniquement pour soi, en statut 'trialing', 8 jours maximum,
-- et une seule fois par compte.
DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'current_period_end')
  THEN
    DROP POLICY IF EXISTS trial_insert_own ON public.subscriptions;
    CREATE POLICY trial_insert_own
      ON public.subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND status::text = 'trialing'
        AND current_period_end <= NOW() + INTERVAL '8 days'
        AND NOT public.user_has_any_subscription(auth.uid())
      );
  END IF;
END $$;


-- ------------------------------------------------------------
-- 4. Tables internes (clé prestataire, journaux de callbacks) : backend seul
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  internal_tables constant text[] := ARRAY[
    'pvit_current_key', 'pvit_callback_logs', 'ebilling_callback_logs'
  ];
BEGIN
  FOREACH t IN ARRAY internal_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Table public.% absente, ignorée', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    LOOP
      EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', pol.policyname, t);
      RAISE NOTICE 'Policy "%" sur % restreinte à service_role', pol.policyname, t;
    END LOOP;
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- 5. Catalogue publicitaire : lecture inchangée, écriture backend + admins
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  had_open_read boolean;
  catalog_tables constant text[] := ARRAY['ad_campaigns', 'ad_packages', 'promotional_slides'];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Table public.% absente, ignorée', t;
      CONTINUE;
    END IF;

    -- Une policy ALL ouverte donnait aussi la lecture : on la conserve à l'identique
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'ALL'
        AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
        AND qual = 'true'
        AND policyname <> 'admin_all'
    ) INTO had_open_read;

    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
        AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
        AND policyname <> 'admin_all'
    LOOP
      EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', pol.policyname, t);
      RAISE NOTICE 'Policy "%" sur % restreinte à service_role', pol.policyname, t;
    END LOOP;

    IF had_open_read THEN
      EXECUTE format('DROP POLICY IF EXISTS public_read ON public.%I', t);
      EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT USING (true)', t);
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated '
      'USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin())', t);
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- 6. Fonctions exposées à tort
-- ------------------------------------------------------------
-- create_demo_campaign : créait une campagne "payée" sans paiement.
-- check_user_credits  : lisait le solde de n'importe qui en anonyme.
-- REVOKE plutôt que DROP (réversible) ; le backend (service_role) garde l'accès.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_demo_campaign', 'check_user_credits')
  LOOP
    IF fn.proname = 'create_demo_campaign' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.signature);
    END IF;
    RAISE NOTICE 'Droits EXECUTE resserrés sur %', fn.signature;
  END LOOP;
END $$;


-- ------------------------------------------------------------
-- 7. Stockage : plus d'écriture ni de suppression anonymes
-- ------------------------------------------------------------
-- audio-summaries, hero-videos : alimentés par le backend -> service_role.
-- video-campaigns, project-files : dépôt par un utilisateur connecté.
-- Bloc tolérant : si le rôle courant n'est pas propriétaire de storage.objects,
-- un avis est émis et les policies sont à corriger depuis le tableau de bord.
DO $$
DECLARE
  pol record;
  target_role text;
BEGIN
  FOR pol IN
    SELECT policyname,
           COALESCE(qual, '') || ' ' || COALESCE(with_check, '') AS expr
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND roles && ARRAY['public', 'anon']::name[]
  LOOP
    IF pol.expr LIKE '%audio-summaries%' OR pol.expr LIKE '%hero-videos%' THEN
      target_role := 'service_role';
    ELSIF pol.expr LIKE '%video-campaigns%' OR pol.expr LIKE '%project-files%' THEN
      target_role := 'authenticated';
    ELSE
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('ALTER POLICY %I ON storage.objects TO %I', pol.policyname, target_role);
      RAISE NOTICE 'Policy stockage "%" restreinte à %', pol.policyname, target_role;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Droits insuffisants pour modifier la policy stockage "%" : à restreindre à % depuis le tableau de bord Supabase',
          pol.policyname, target_role;
    END;
  END LOOP;
END $$;


-- ============================================================
-- Vérifications après application
-- ============================================================
-- a) Plus aucune policy d'écriture ouverte sur les tables financières :
--   SELECT tablename, policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('user_credits','credit_transactions','transactions','pvit_payments',
--                       'ebilling_payments','campaign_payments','quiz_participants',
--                       'subscriptions','user_subscriptions','pvit_current_key')
--   ORDER BY tablename, policyname;
--
-- b) Avec la clé anon + le JWT d'un compte de test non admin, ces requêtes doivent échouer :
--   update users set is_admin = true where id = auth.uid();
--   update users set credits_balance = credits_balance + 1000 where id = auth.uid();
--   update user_credits set balance = 999999 where user_id = auth.uid();
--
-- c) Une inscription avec options.data = { is_admin: true, role: 'admin' } doit
--    produire une ligne users avec is_admin = false et role = 'user'.
