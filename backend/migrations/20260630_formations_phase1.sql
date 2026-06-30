-- =====================================================
-- Formations Entrepreneur BCEG — Phase 1 (candidatures + inscriptions)
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

-- 1. Candidatures (formulaire public, sélection admin)
CREATE TABLE IF NOT EXISTS formation_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- si connecté
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  province TEXT,
  city TEXT,
  sector TEXT,
  project_title TEXT,
  project_stage TEXT,          -- idée / en cours / existant
  preferred_format TEXT,       -- distanciel / présentiel / les deux
  motivation TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','selected','waitlist','rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_formation_candidates_status ON formation_candidates(status);
CREATE INDEX IF NOT EXISTS idx_formation_candidates_province ON formation_candidates(province);
CREATE INDEX IF NOT EXISTS idx_formation_candidates_created ON formation_candidates(created_at DESC);

ALTER TABLE formation_candidates ENABLE ROW LEVEL SECURITY;
-- Écriture/lecture via le backend (service role) uniquement → pas de policy publique.

-- 2. Inscriptions (candidats sélectionnés → apprenants), niveau débloqué
CREATE TABLE IF NOT EXISTS formation_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES formation_candidates(id) ON DELETE SET NULL,
  level_unlocked INTEGER NOT NULL DEFAULT 0,  -- 0 = pas encore, 1/2/3 = niveau validé max
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','dropped')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_formation_enrollments_user ON formation_enrollments(user_id);

SELECT 'formation_candidates + formation_enrollments créées' AS result;
