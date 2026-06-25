-- Migration: autoriser le doc_type 'illustration' (infographie "business en 1 image")
-- comme pièce du dossier de financement BCEG.
--
-- L'infographie générée par GPT Image 2 est imposée dans les pièces requises ;
-- son insertion dans due_diligence_documents échoue tant que la contrainte CHECK
-- ne contient pas 'illustration'.
--
-- À exécuter dans Supabase → SQL Editor.

ALTER TABLE due_diligence_documents
  DROP CONSTRAINT IF EXISTS due_diligence_documents_doc_type_check;

ALTER TABLE due_diligence_documents
  ADD CONSTRAINT due_diligence_documents_doc_type_check
  CHECK (doc_type IN (
    'plan_action',
    'business_plan',
    'illustration',
    'cni',
    'rccm',
    'rib',
    'devis'
  ));

-- Vérification
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'due_diligence_documents'::regclass AND contype = 'c';
