-- =====================================================================
-- PERF: Indexes sur colonnes filtrées chaudes (audit P1)
-- À exécuter sur Supabase SQL Editor.
--
-- Chaque CREATE INDEX est wrappé dans un DO block défensif qui vérifie
-- que la table ET la colonne existent. Cela permet :
--   - migration idempotente
--   - aucune erreur si une table n'a pas encore été créée
--   - aucune erreur si une colonne a été renommée
--
-- Pas de CONCURRENTLY car le SQL Editor encapsule en transaction.
-- Pour tables très volumineuses, voir ALTERNATIVE PROD en bas du fichier.
-- =====================================================================

-- Helper : créer un index si table+colonne(s) existent
CREATE OR REPLACE FUNCTION pg_temp.create_index_if_columns_exist(
  p_index_name text,
  p_table_name text,
  p_column_expr text,    -- ex: 'feed_id' ou 'user_id, created_at DESC'
  p_required_cols text[], -- ex: ARRAY['feed_id'] ou ARRAY['user_id','created_at']
  p_where text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  missing text;
  ddl text;
BEGIN
  -- Vérif table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table_name
  ) THEN
    RAISE NOTICE 'SKIP %: table % introuvable', p_index_name, p_table_name;
    RETURN;
  END IF;

  -- Vérif colonnes
  FOREACH missing IN ARRAY p_required_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_table_name AND column_name = missing
    ) THEN
      RAISE NOTICE 'SKIP %: colonne %.% introuvable', p_index_name, p_table_name, missing;
      RETURN;
    END IF;
  END LOOP;

  ddl := format('CREATE INDEX IF NOT EXISTS %I ON %I(%s)', p_index_name, p_table_name, p_column_expr);
  IF p_where IS NOT NULL THEN
    ddl := ddl || ' WHERE ' || p_where;
  END IF;

  EXECUTE ddl;
  RAISE NOTICE 'OK   %', p_index_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- ARTICLES
-- =====================================================================
SELECT pg_temp.create_index_if_columns_exist(
  'idx_articles_feed_id', 'articles', 'feed_id', ARRAY['feed_id']
);

SELECT pg_temp.create_index_if_columns_exist(
  'idx_articles_category_simple', 'articles', 'category',
  ARRAY['category'], 'category IS NOT NULL'
);

SELECT pg_temp.create_index_if_columns_exist(
  'idx_articles_published_at', 'articles', 'published_at DESC',
  ARRAY['published_at', 'is_published'], 'is_published = true'
);

-- =====================================================================
-- READING HISTORY (table réelle: user_reading_history)
-- =====================================================================
SELECT pg_temp.create_index_if_columns_exist(
  'idx_user_reading_history_user_read_at', 'user_reading_history',
  'user_id, read_at DESC',
  ARRAY['user_id', 'read_at']
);

-- =====================================================================
-- FAVORITES (table réelle: user_favorites)
-- =====================================================================
SELECT pg_temp.create_index_if_columns_exist(
  'idx_user_favorites_user_created', 'user_favorites',
  'user_id, created_at DESC',
  ARRAY['user_id', 'created_at']
);

-- =====================================================================
-- NOTIFICATIONS (colonnes: user_id, is_read, created_at)
-- =====================================================================
SELECT pg_temp.create_index_if_columns_exist(
  'idx_notifications_user_created_unread', 'notifications',
  'user_id, created_at DESC',
  ARRAY['user_id', 'created_at', 'is_read'],
  'is_read = false'
);

-- =====================================================================
-- PROJECT ACTIONS / ACTION PLANS / SAVED PROJECTS
-- =====================================================================
SELECT pg_temp.create_index_if_columns_exist(
  'idx_project_actions_user', 'project_actions',
  'user_id, created_at DESC',
  ARRAY['user_id', 'created_at']
);

SELECT pg_temp.create_index_if_columns_exist(
  'idx_project_actions_project', 'project_actions',
  'project_id, created_at DESC',
  ARRAY['project_id', 'created_at']
);

SELECT pg_temp.create_index_if_columns_exist(
  'idx_action_plans_user', 'action_plans',
  'user_id, created_at DESC',
  ARRAY['user_id', 'created_at']
);

SELECT pg_temp.create_index_if_columns_exist(
  'idx_saved_projects_user_created', 'saved_projects',
  'user_id, created_at DESC',
  ARRAY['user_id', 'created_at']
);

-- =====================================================================
-- ANALYZE pour rafraîchir les stats du planner
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='articles') THEN
    EXECUTE 'ANALYZE articles';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_reading_history') THEN
    EXECUTE 'ANALYZE user_reading_history';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_favorites') THEN
    EXECUTE 'ANALYZE user_favorites';
  END IF;
END $$;

-- =====================================================================
-- ALTERNATIVE PROD : exécuter une par une via psql (pas de lock long)
-- =====================================================================
-- Sur tables volumineuses (>1M rows), préférer CONCURRENTLY hors transaction.
-- Adapter aux noms de tables/colonnes réels de ton schéma :
--
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_category_simple ON articles(category) WHERE category IS NOT NULL;"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC) WHERE is_published = true;"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reading_history_user_read_at ON user_reading_history(user_id, read_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_favorites_user_created ON user_favorites(user_id, created_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_projects_user_created ON saved_projects(user_id, created_at DESC);"
