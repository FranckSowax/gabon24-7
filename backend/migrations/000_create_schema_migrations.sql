-- 000_create_schema_migrations.sql
-- Table de tracking des migrations SQL appliquées.
-- À appliquer en premier dans Supabase (idempotente).

CREATE TABLE IF NOT EXISTS schema_migrations (
  version       TEXT PRIMARY KEY,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum      TEXT NOT NULL,
  applied_by    TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
  ON schema_migrations (applied_at DESC);

COMMENT ON TABLE schema_migrations IS
  'Tracker des migrations SQL appliquées par scripts/migrate.js. version = nom du fichier sans .sql, checksum = sha256 du contenu au moment de l''application.';
