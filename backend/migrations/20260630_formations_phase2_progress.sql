-- =====================================================
-- Formations BCEG — Phase 2 : progression & déblocage des paliers
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

CREATE TABLE IF NOT EXISTS formation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,         -- ex. n1-m1-idee-marche (source: code)
  level INTEGER NOT NULL,
  passed BOOLEAN DEFAULT TRUE,
  score INTEGER,
  attempts INTEGER DEFAULT 1,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_formation_progress_user ON formation_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_formation_progress_user_level ON formation_progress(user_id, level);

ALTER TABLE formation_progress ENABLE ROW LEVEL SECURITY;
-- Accès via backend (service role). Lecture du propre user autorisée :
DROP POLICY IF EXISTS "Users read own progress" ON formation_progress;
CREATE POLICY "Users read own progress" ON formation_progress FOR SELECT USING (auth.uid() = user_id);

SELECT 'formation_progress créée' AS result;
