il -- Migration: aligner la contrainte CHECK due_diligence_documents.doc_type
-- avec les types réellement utilisés par l'app (FINANCE_DOC_TYPES).
--
-- Contexte: l'insertion d'un doc_type 'business_plan' (import business plan)
-- échouait avec "violates check constraint due_diligence_documents_doc_type_check"
-- car la contrainte (table créée manuellement) ne contenait pas cette valeur.
--
-- À exécuter dans Supabase → SQL Editor.

-- (Optionnel) Voir la contrainte actuelle avant modification :
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'due_diligence_documents'::regclass AND contype = 'c';

ALTER TABLE due_diligence_documents
  DROP CONSTRAINT IF EXISTS due_diligence_documents_doc_type_check;

ALTER TABLE due_diligence_documents
  ADD CONSTRAINT due_diligence_documents_doc_type_check
  CHECK (doc_type IN (
    'plan_action',
    'business_plan',
    'cni',
    'rccm',
    'rib',
    'devis'
  ));

-- Vérification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'due_diligence_documents'::regclass AND contype = 'c';
