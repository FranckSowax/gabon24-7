-- =====================================================
-- Modèle de commission BCEG : suivi des commissions sur
-- dossiers financés (acceptés). À exécuter dans Supabase.
-- =====================================================

CREATE TABLE IF NOT EXISTS bceg_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES bceg_submissions(id) ON DELETE CASCADE,
  project_id UUID,
  user_id UUID,
  montant_finance NUMERIC NOT NULL DEFAULT 0,
  taux NUMERIC NOT NULL DEFAULT 0.03,
  montant_commission NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | invoiced | paid | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bceg_commissions_status ON bceg_commissions(status);

ALTER TABLE bceg_commissions ENABLE ROW LEVEL SECURITY;
-- Écritures/lectures via le backend (service role). Aucune policy publique.

SELECT 'bceg_commissions créée' AS result;
