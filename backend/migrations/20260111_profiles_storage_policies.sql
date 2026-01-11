-- Migration: Politiques Storage pour le bucket profiles
-- Date: 2026-01-11
-- Description: Permettre aux utilisateurs authentifiés d'uploader leur photo de profil

-- Politique: Lecture publique des avatars
DROP POLICY IF EXISTS "Public read access for profiles" ON storage.objects;
CREATE POLICY "Public read access for profiles"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Politique: Les utilisateurs authentifiés peuvent uploader leur avatar
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Politique: Les utilisateurs peuvent mettre à jour leur propre avatar
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profiles')
WITH CHECK (bucket_id = 'profiles');

-- Politique: Les utilisateurs peuvent supprimer leur propre avatar
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profiles');
