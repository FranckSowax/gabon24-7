-- ============================================================
-- 20261117_articles_and_feeds_rls.sql
-- Audit de mise en production — suite de 20261114 et 20261116
-- (à appliquer APRÈS 20261114, dont elle réutilise current_user_is_admin)
-- ============================================================
-- Deux tables de contenu restaient à contrôler :
--
--   1. public.articles : l'ancienne page d'un article écrivait elle-même le
--      compteur de vues depuis le navigateur. Si la base l'acceptait, un simple
--      visiteur pouvait donc modifier un article (titre, contenu, image,
--      publication). Le compteur passe désormais par le serveur.
--   2. public.rss_feeds : la liste des flux importés. Modifiable par un
--      visiteur, elle permettait d'ajouter une source arbitraire au site, ou de
--      désactiver toutes les sources.
--
-- Effet : sur ces deux tables, l'écriture est réservée au backend
-- (service_role) et aux administrateurs (pages /admin). LES LECTURES SONT
-- CONSERVÉES À L'IDENTIQUE : le site continue d'afficher les articles.
--
-- Le backend utilise la clé service_role (bypass RLS) : il n'est pas impacté.
-- Ne modifie AUCUNE ligne. Idempotente, tolérante aux tables absentes.
--
-- À appliquer APRÈS le déploiement du nouveau site : l'ancienne page article
-- incrémente encore le compteur de vues depuis le navigateur ; avec cette
-- migration, cette écriture est simplement ignorée (aucune erreur visible).
--
-- Pour voir l'état actuel AVANT d'appliquer (lecture seule) :
--   SELECT c.relname AS table_name, c.relrowsecurity AS rls_active,
--          p.policyname, p.cmd, p.roles, p.qual
--   FROM pg_class c
--   LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
--   WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('articles', 'rss_feeds')
--   ORDER BY c.relname, p.policyname;
-- Une ligne avec rls_active = false, ou une policy INSERT/UPDATE/DELETE/ALL dont
-- roles contient public, anon ou authenticated, signale une écriture ouverte.
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.current_user_is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Appliquer d''abord 20261114_security_privilege_and_payment_rls.sql (fonction current_user_is_admin absente)';
  END IF;
END $$;


-- ------------------------------------------------------------
-- Articles et flux : lecture inchangée, écriture backend + admins
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  rls_was_enabled boolean;
  had_open_read boolean;
  has_user_id boolean;
  catalog_tables constant text[] := ARRAY['articles', 'rss_feeds'];
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

    -- Lecture de ses propres lignes, pour une table qui aurait une colonne user_id.
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
-- a) Relancer la requête de l'en-tête : plus aucune policy d'écriture pour
--    public, anon ou authenticated, hormis admin_all.
--
-- b) Avec la clé anon (ou le JWT d'un compte non admin), ces requêtes ne doivent
--    modifier aucune ligne :
--   update articles set title = 'x' where id = (select id from articles limit 1);
--   update rss_feeds set status = 'inactive';
--   insert into rss_feeds (name, url, category) values ('x', 'https://example.com/feed', 'test');
--
-- c) Le site doit toujours afficher l'accueil et les pages d'articles.
