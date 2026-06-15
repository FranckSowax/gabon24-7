-- ============================================================
-- 20260603_m3_wrap_auth_rls_initplan.sql
-- Jalon 3 perf — corrige l'advisor auth_rls_initplan (~180 policies).
--
-- Problème : les policies RLS qui appellent auth.uid()/auth.role()/auth.jwt()
-- DIRECTEMENT les ré-évaluent une fois PAR LIGNE scannée. En les enveloppant
-- dans un sous-SELECT — (select auth.uid()) — Postgres les évalue UNE SEULE
-- FOIS par requête (InitPlan), d'où un gain de 10×–100× sur les grosses tables
-- (users, articles, notifications, opportunity_analyses, etc.).
--
-- Approche : un bloc PL/pgSQL qui, pour chaque policy de public utilisant une
-- fonction auth.* non enveloppée, reconstruit la policy à l'identique en
-- enveloppant les appels. Idempotent (dé-wrap puis re-wrap → pas de double).
-- Transactionnel : si UNE recréation échoue, TOUT est annulé (apply_migration
-- enveloppe déjà dans une transaction).
--
-- ⚠️ À VALIDER d'abord avec la requête PREVIEW (voir bloc commenté en bas)
--    puis appliquer. Tester de préférence sur une branche Supabase.
-- ============================================================

DO $$
DECLARE
  pol           RECORD;
  v_new_qual    TEXT;
  v_new_check   TEXT;
  v_roles_csv   TEXT;
  v_stmt        TEXT;
  v_changed     INT := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual       ~ 'auth\.(uid|role|jwt)\(\)' AND qual       !~ '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.')
        OR (with_check ~ 'auth\.(uid|role|jwt)\(\)' AND with_check !~ '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.')
      )
  LOOP
    -- Réécriture idempotente : dé-wrap les (select auth.x()) existants, puis re-wrap tous les auth.x()
    v_new_qual := pol.qual;
    IF v_new_qual IS NOT NULL THEN
      v_new_qual := regexp_replace(v_new_qual, '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.(uid|role|jwt)\(\)\s*\)', 'auth.\1()', 'g');
      v_new_qual := regexp_replace(v_new_qual, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    END IF;

    v_new_check := pol.with_check;
    IF v_new_check IS NOT NULL THEN
      v_new_check := regexp_replace(v_new_check, '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.(uid|role|jwt)\(\)\s*\)', 'auth.\1()', 'g');
      v_new_check := regexp_replace(v_new_check, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    END IF;

    -- Liste des rôles (quote_ident chacun)
    SELECT string_agg(quote_ident(r), ', ') INTO v_roles_csv FROM unnest(pol.roles) AS r;

    -- DROP de l'ancienne policy
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    -- Reconstruction
    v_stmt := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                     pol.policyname, pol.schemaname, pol.tablename,
                     pol.permissive, pol.cmd, v_roles_csv);
    IF v_new_qual IS NOT NULL THEN
      v_stmt := v_stmt || format(' USING (%s)', v_new_qual);
    END IF;
    IF v_new_check IS NOT NULL THEN
      v_stmt := v_stmt || format(' WITH CHECK (%s)', v_new_check);
    END IF;

    EXECUTE v_stmt;
    v_changed := v_changed + 1;
    RAISE NOTICE 'Rewrapped policy %.% : %', pol.tablename, pol.policyname, pol.cmd;
  END LOOP;

  RAISE NOTICE '✅ % policies réécrites (auth.* enveloppées dans un sous-SELECT).', v_changed;
END $$;

-- ============================================================
-- PREVIEW (à exécuter AVANT, en lecture seule, pour valider la réécriture) :
-- ------------------------------------------------------------
-- WITH pol AS (
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname='public'
--     AND ( (qual ~ 'auth\.(uid|role|jwt)\(\)' AND qual !~ '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.')
--        OR (with_check ~ 'auth\.(uid|role|jwt)\(\)' AND with_check !~ '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.') )
-- )
-- SELECT tablename, policyname, cmd,
--   qual AS old_using,
--   regexp_replace(regexp_replace(qual,
--     '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.(uid|role|jwt)\(\)\s*\)','auth.\1()','g'),
--     'auth\.(uid|role|jwt)\(\)','(select auth.\1())','g') AS new_using
-- FROM pol ORDER BY tablename, policyname;
--
-- VÉRIFICATION APRÈS (doit renvoyer 0 ligne) :
-- ------------------------------------------------------------
-- SELECT count(*) FROM pg_policies
-- WHERE schemaname='public'
--   AND ( (qual ~ 'auth\.(uid|role|jwt)\(\)' AND qual !~ '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.')
--      OR (with_check ~ 'auth\.(uid|role|jwt)\(\)' AND with_check !~ '\(\s*[Ss][Ee][Ll][Ee][Cc][Tt]\s+auth\.') );
-- ============================================================
