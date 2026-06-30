-- =====================================================
-- Formations sectorielles : tag secteur sur les cours
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

ALTER TABLE formation_courses ADD COLUMN IF NOT EXISTS sector TEXT;
CREATE INDEX IF NOT EXISTS idx_formation_courses_sector ON formation_courses(sector);

-- NULL = cours générique (tous secteurs). Une valeur = cours spécifique au secteur.
SELECT 'formation_courses.sector ajouté' AS result;
