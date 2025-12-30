# 🗄️ CONFIGURATION SUPABASE STORAGE

Ce guide explique comment configurer Supabase Storage pour l'upload d'avatars.

## 📦 CRÉER LE BUCKET

### 1. Accéder à Supabase Dashboard
```
https://app.supabase.com
→ Sélectionner votre projet
→ Storage (menu gauche)
→ Create bucket
```

### 2. Créer le bucket 'profiles'
```
Nom: profiles
Public: ✅ Oui (pour les URLs publiques)
Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
Max file size: 5MB
```

## 🔒 CONFIGURER LES POLICIES RLS

### Policy 1: Permettre l'upload (INSERT)
```sql
-- Politique: Les utilisateurs peuvent uploader leur propre avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 2: Permettre la lecture publique (SELECT)
```sql
-- Politique: Tout le monde peut voir les avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profiles');
```

### Policy 3: Permettre la mise à jour (UPDATE)
```sql
-- Politique: Les utilisateurs peuvent mettre à jour leur propre avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### Policy 4: Permettre la suppression (DELETE)
```sql
-- Politique: Les utilisateurs peuvent supprimer leur propre avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## 📁 STRUCTURE DES FICHIERS

Les avatars sont stockés avec la structure suivante:
```
profiles/
  └── avatars/
      ├── {userId}-{timestamp}.jpg
      ├── {userId}-{timestamp}.png
      └── ...
```

**Exemple**:
```
profiles/avatars/a1b2c3d4-1234567890.jpg
```

## 🔗 OBTENIR L'URL PUBLIQUE

Le code utilise automatiquement:
```typescript
const { data: { publicUrl } } = supabase.storage
  .from('profiles')
  .getPublicUrl(filePath)
```

L'URL finale ressemble à:
```
https://abcdefg.supabase.co/storage/v1/object/public/profiles/avatars/userId-timestamp.jpg
```

## ✅ VÉRIFICATION

### Tester l'upload
1. Aller sur `/mon-profil`
2. Cliquer sur "Choisir une photo"
3. Sélectionner une image
4. Valider l'upload
5. Vérifier dans Supabase Storage que le fichier apparaît

### Vérifier les permissions
```sql
-- Dans Supabase SQL Editor
SELECT * FROM storage.objects WHERE bucket_id = 'profiles';
```

## 🛠️ CONFIGURATION CÔTÉ CODE

Le code est déjà configuré dans:
```typescript
// frontend/src/components/profile/AvatarUpload.tsx
const { data, error } = await supabase.storage
  .from('profiles')
  .upload(filePath, resizedBlob, {
    cacheControl: '3600',
    upsert: true
  })
```

## 📝 NOTES IMPORTANTES

1. **Bucket public**: Nécessaire pour afficher les avatars sans authentification
2. **Upsert**: Remplace l'ancien avatar automatiquement
3. **Cache**: Les images sont cachées 1 heure (3600s)
4. **Redimensionnement**: Automatique côté client (400x400px)
5. **Compression**: JPEG 85% qualité pour optimiser la taille

## 🚨 SÉCURITÉ

Les policies RLS garantissent que:
- ✅ Seul le propriétaire peut uploader/modifier son avatar
- ✅ Tout le monde peut voir les avatars (public)
- ✅ Les fichiers sont dans le bon dossier (foldername check)
- ✅ Authentification requise pour upload

## 🔄 MIGRATION EXISTANTE

Si vous avez déjà des utilisateurs avec des avatars dans `users.avatar_url`:
```sql
-- Pas de migration nécessaire
-- Le nouveau système coexiste avec l'ancien
-- Les anciens avatars continueront de fonctionner
```

## 📦 ALTERNATIVE: Storage dans BDD

Si vous préférez stocker les images en base64 dans la BDD:
```typescript
// Modifier AvatarUpload.tsx ligne ~70
// Au lieu de supabase.storage.upload()
await supabase
  .from('users')
  .update({ avatar_base64: base64String })
  .eq('id', userId)
```

⚠️ **Non recommandé**: Les images en base64 augmentent la taille de la BDD.

## 🎯 RÉSUMÉ

1. Créer bucket `profiles` (public)
2. Ajouter les 4 policies RLS
3. Tester l'upload depuis `/mon-profil`
4. Vérifier que l'avatar s'affiche
5. ✅ Terminé !
