-- =====================================================
-- Campagne BCEG : traçage de la source d'acquisition
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

ALTER TABLE formation_candidates ADD COLUMN IF NOT EXISTS source TEXT;

SELECT 'formation_candidates.source ajouté' AS result;
