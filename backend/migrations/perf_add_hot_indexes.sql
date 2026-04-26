-- =====================================================================
-- PERF: Indexes sur colonnes filtrées chaudes (audit P1)
-- À exécuter sur Supabase SQL Editor (toutes IF NOT EXISTS, idempotent).
--
-- Note: Pas de CONCURRENTLY car le SQL Editor Supabase encapsule en
-- transaction. Sur tables très volumineuses (>1M rows), exécuter via
-- `psql` direct avec CONCURRENTLY (voir bas du fichier).
-- =====================================================================

-- Articles : feed_id (filtré dans aggregation RSS, journal, par source)
CREATE INDEX IF NOT EXISTS idx_articles_feed_id
  ON articles(feed_id);

-- Articles : category (déjà partial, on ajoute global pour filtrage simple)
CREATE INDEX IF NOT EXISTS idx_articles_category_simple
  ON articles(category)
  WHERE category IS NOT NULL;

-- Articles : published_at standalone (tri rapide page d'accueil sans filter)
CREATE INDEX IF NOT EXISTS idx_articles_published_at
  ON articles(published_at DESC)
  WHERE is_published = true;

-- Reading history : par user (historique perso)
CREATE INDEX IF NOT EXISTS idx_reading_history_user_created
  ON reading_history(user_id, created_at DESC);

-- Favorites : par user (favoris perso)
CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON favorites(user_id, created_at DESC);

-- Notifications : par admin destinataire (dashboard admin, badge non-lus)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC)
  WHERE read_at IS NULL;

-- Project actions tracking : par user / par projet
CREATE INDEX IF NOT EXISTS idx_project_actions_user
  ON project_actions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_actions_project
  ON project_actions(project_id, created_at DESC);

-- Action plans : par user
CREATE INDEX IF NOT EXISTS idx_action_plans_user
  ON action_plans(user_id, created_at DESC);

-- Saved projects (Dossiers) : par user
CREATE INDEX IF NOT EXISTS idx_saved_projects_user
  ON saved_projects(user_id, created_at DESC);

-- Mise à jour des statistiques du planner pour utiliser les nouveaux indexes
ANALYZE articles;
ANALYZE reading_history;
ANALYZE favorites;

-- =====================================================================
-- ALTERNATIVE PROD : exécuter une par une via psql (pas de lock long)
-- =====================================================================
-- Pour tables volumineuses, ouvrir psql et lancer chaque ligne séparément :
--
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_category_simple ON articles(category) WHERE category IS NOT NULL;"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC) WHERE is_published = true;"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reading_history_user_created ON reading_history(user_id, created_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC) WHERE read_at IS NULL;"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_actions_user ON project_actions(user_id, created_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_actions_project ON project_actions(project_id, created_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_action_plans_user ON action_plans(user_id, created_at DESC);"
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_projects_user ON saved_projects(user_id, created_at DESC);"
