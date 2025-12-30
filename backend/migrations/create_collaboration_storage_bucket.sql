-- Créer bucket pour fichiers de collaboration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  true,
  10485760, -- 10MB max
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour le bucket
CREATE POLICY "Public can upload collaboration documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Public can read collaboration documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-files');

CREATE POLICY "Users can delete their own collaboration documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-files');

COMMENT ON BUCKET project_files IS 'Fichiers de collaboration sur projets (documents, images, PDF)';
