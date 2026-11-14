-- ============================================================
-- 20261116_campaigns_and_price_catalog_rls.sql
-- Audit de mise en production — suite de 20261114 (à appliquer APRÈS elle)
-- ============================================================
-- 20261114 a fermé l'écriture navigateur sur les soldes, paiements et
-- abonnements. Restaient ouvertes, avec la clé anon + le JWT d'un simple inscrit :
--
--   1. public.campaigns : une page du site y écrivait directement. Un inscrit
--      pouvait donc créer sa campagne déjà « active » et « payée », sans passer
--      par le serveur (prix, créneau, paiement, validation).
--   2. Les grilles de prix (credit_packages, credit_costs, subscription_plans,
--      pricing_config) : le serveur y lit le montant à facturer. Modifiables
--      par un inscrit, elles permettaient d'acheter un pack à 100 FCFA.
--   3. payment_history et veille_subscriptions : mêmes policies « service role »
--      écrites USING (true) sans TO service_role que les tables de 20261114.
--
-- Le backend utilise la clé service_role (bypass RLS) : il n'est pas impacté.
-- Le back-office (pages /admin) continue d'écrire via la policy admin_all.
-- Les lectures existantes sont conservées à l'identique.
--
-- Ne modifie AUCUNE ligne : uniquement des règles d'accès. Idempotente, et
-- tolérante aux tables absentes (schéma réel non reconstructible depuis le dépôt).
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.current_user_is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Appliquer d''abord 20261114_security_privilege_and_payment_rls.sql (fonction current_user_is_admin absente)';
  END IF;
END $$;


-- ------------------------------------------------------------
-- 1. Campagnes et grilles de prix : lecture inchangée, écriture backend + admins
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  rls_was_enabled boolean;
  had_open_read boolean;
  has_user_id boolean;
  catalog_tables constant text[] := ARRAY[
    'campaigns',
    'credit_packages', 'credit_costs', 'subscription_plans', 'pricing_config'
  ];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Table public.% absente, ignorée', t;
      CONTINUE;
    END IF;

    SELECT c.relrowsecurity INTO rls_was_enabled
    FROM pg_class c
    WHERE c.oid = to_regclass(format('public.%I', t));

    -- La table était lisible par tous si la RLS était coupée, ou si une policy
    -- ALL ouverte (USING true) donnait aussi la lecture : on conserve cette lecture.
    SELECT (NOT rls_was_enabled) OR EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd = 'ALL'
        AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
        AND qual = 'true'
        AND policyname <> 'admin_all'
    ) INTO had_open_read;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT rls_was_enabled THEN
      RAISE NOTICE 'RLS activée sur % (elle était désactivée : table ouverte en écriture à tous)', t;
    END IF;

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

    -- Un annonceur lit toujours ses propres campagnes, même si la lecture
    -- publique n'existait pas.
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


-- ------------------------------------------------------------
-- 2. Tables financières oubliées par 20261114 : écriture réservée au backend
-- ------------------------------------------------------------
-- Même traitement que le bloc 3 de 20261114 : écriture service_role, lecture de
-- ses propres lignes, accès complet des admins.
DO $$
DECLARE
  t text;
  pol record;
  has_user_id boolean;
  financial_tables constant text[] := ARRAY['payment_history', 'veille_subscriptions'];
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
        AND policyname <> 'admin_all'
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


-- ============================================================
-- Vérifications après application
-- ============================================================
-- a) Plus aucune policy d'écriture ouverte :
--   SELECT tablename, policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('campaigns','credit_packages','credit_costs','subscription_plans',
--                       'pricing_config','payment_history','veille_subscriptions')
--   ORDER BY tablename, policyname;
--
-- b) Avec la clé anon + le JWT d'un compte de test non admin, ces requêtes doivent échouer :
--   insert into campaigns (name, status, payment_status) values ('x', 'active', 'completed');
--   update credit_packages set price = 100;
--   update subscription_plans set price_monthly = 0;
--
-- c) Le site doit toujours afficher les packs de crédits, les plans et la vidéo
--    publicitaire d'accueil (lectures conservées).
