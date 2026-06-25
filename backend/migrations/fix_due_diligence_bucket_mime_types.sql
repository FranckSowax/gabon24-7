-- Migration: élargir les types MIME autorisés du bucket Storage "due-diligence"
-- Contexte: l'import du business plan / plan d'action génère un fichier .doc
-- (application/msword) qui était rejeté en 400 ("mime type not supported") car
-- le bucket (créé manuellement) n'autorisait que PDF/images.
--
-- À exécuter dans Supabase → SQL Editor (projet ykytsadwfqoyusleoflf).

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       -- .xlsx
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/html',
    'text/csv'
  ],
  file_size_limit = 10485760  -- 10 Mo
WHERE id = 'due-diligence';

-- Vérification
SELECT id, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'due-diligence';
