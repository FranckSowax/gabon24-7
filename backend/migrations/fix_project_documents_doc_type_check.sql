-- Migration: débloquer les nouveaux document_type (logo, flyer, illustration…)
-- dans project_documents.
--
-- Contexte: l'insertion d'un document image (logo/flyer/illustration) échoue avec
-- "violates check constraint check_document_type". La contrainte (table créée
-- manuellement) n'autorise qu'une liste figée de types, ce qui casse à chaque
-- nouveau type d'outil IA.
--
-- Solution recommandée: supprimer la contrainte (document_type = texte libre,
-- déjà contrôlé côté application). Zéro risque sur les lignes existantes.
--
-- À exécuter dans Supabase → SQL Editor.

-- (Optionnel) voir la définition actuelle avant suppression :
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'project_documents'::regclass AND contype = 'c';

ALTER TABLE project_documents
  DROP CONSTRAINT IF EXISTS check_document_type;

-- Vérification (ne doit plus lister check_document_type) :
SELECT conname
FROM pg_constraint
WHERE conrelid = 'project_documents'::regclass AND contype = 'c';
