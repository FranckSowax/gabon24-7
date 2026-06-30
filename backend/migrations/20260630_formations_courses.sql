-- =====================================================
-- Formations BCEG — contenu des cours en base (éditable admin)
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

CREATE TABLE IF NOT EXISTS formation_courses (
  id TEXT PRIMARY KEY,                 -- ex. n1-m1-idee-marche (= module_id)
  level INTEGER NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  summary TEXT,
  duration_min INTEGER DEFAULT 20,
  content TEXT NOT NULL,               -- markdown léger
  quiz JSONB NOT NULL DEFAULT '{"passScore":70,"questions":[]}'::jsonb,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formation_courses_level ON formation_courses(level, is_published, order_index);

ALTER TABLE formation_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read published courses" ON formation_courses;
CREATE POLICY "Public read published courses" ON formation_courses FOR SELECT USING (is_published = true);
-- Écritures via le backend (service role).

SELECT 'formation_courses créée' AS result;
