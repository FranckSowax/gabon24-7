-- =====================================================================
-- PERF: Indexes sur colonnes filtrées chaudes (audit P1)
-- À exécuter sur Supabase. Toutes les CREATE INDEX sont idempotentes.
-- Utiliser CONCURRENTLY pour ne pas bloquer en prod (1 statement par ligne)
-- =====================================================================

-- Articles : feed_id (filtré dans aggregation RSS, journal, par source)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_feed_id
  ON articles(feed_id);

-- Articles : category (déjà partial, on ajoute global pour filtrage simple)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_category_simple
  ON articles(category)
  WHERE category IS NOT NULL;

-- Articles : enrichment_status partiel (boucles d'enrichissement IA)
-- Note : déjà créé dans optimize_articles_table.sql, IF NOT EXISTS protège

-- Articles : published_at standalone (tri rapide page d'accueil sans filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_published_at
  ON articles(published_at DESC)
  WHERE is_published = true;

-- Reading history : par user (historique perso)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reading_history_user_created
  ON reading_history(user_id, created_at DESC);

-- Favorites : par user (favoris perso)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_user
  ON favorites(user_id, created_at DESC);

-- Notifications : par admin destinataire (dashboard admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC)
  WHERE read_at IS NULL;

-- Project actions tracking : par user / par projet
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_actions_user
  ON project_actions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_actions_project
  ON project_actions(project_id, created_at DESC);

-- Action plans : par user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_action_plans_user
  ON action_plans(user_id, created_at DESC);

-- Saved projects (Dossiers) : par user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_projects_user
  ON saved_projects(user_id, created_at DESC);

-- ANALYZE après création pour mettre à jour les statistiques planner
ANALYZE articles;
ANALYZE reading_history;
ANALYZE favorites;
