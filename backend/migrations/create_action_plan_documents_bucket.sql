-- Migration: Bucket Supabase Storage pour documents du Plan d'Action

-- Créer le bucket pour les documents du plan d'action
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'action-plan-documents',
  'action-plan-documents',
  false, -- Privé, accessible uniquement par le propriétaire
  10485760, -- 10MB max par fichier
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour le bucket

-- Politique: Les utilisateurs peuvent uploader leurs propres documents
CREATE POLICY "Users can upload own action plan documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'action-plan-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Politique: Les utilisateurs peuvent voir leurs propres documents
CREATE POLICY "Users can view own action plan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'action-plan-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Politique: Les utilisateurs peuvent mettre à jour leurs propres documents
CREATE POLICY "Users can update own action plan documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'action-plan-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Politique: Les utilisateurs peuvent supprimer leurs propres documents
CREATE POLICY "Users can delete own action plan documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'action-plan-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Commentaire
COMMENT ON TABLE storage.buckets IS 'Bucket pour stocker les documents du plan d''action (devis, contrats, dossiers administratifs, etc.)';
