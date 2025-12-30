# 🔧 Migration: Nettoyage des Colonnes en Doublon

## 📋 Vue d'ensemble

Cette migration nettoie les colonnes en doublon dans la table `articles` pour éliminer la redondance et optimiser le schéma.

## 🎯 Objectifs

### Colonnes à Fusionner
- `category` → `ai_category` (catégorie IA)
- `keywords` → `ai_keywords` (keywords IA)
- `sentiment` → `ai_sentiment` (sentiment numérique)
- `image_urls` → `image_url` (URL unique)

### Colonnes à Ajouter
- `ai_keywords` (TEXT[]) - Mots-clés IA
- `normalized_url` (TEXT) - URL normalisée
- `source` (VARCHAR) - Source média

## 🚀 Méthode 1: Interface Supabase (RECOMMANDÉ)

### Étapes:
1. Ouvrez votre projet Supabase: https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête
4. Copiez/Collez le contenu du fichier `cleanup_duplicate_columns.sql`
5. Cliquez sur **Run** (F5)

### Avantages:
- ✅ Interface visuelle
- ✅ Logs en temps réel
- ✅ Rollback facile si erreur

## 🖥️ Méthode 2: Script Backend

### Option A: Script Simple
```bash
cd backend
node apply-migration-simple.js
```

### Option B: Script Complet
```bash
cd backend
node run-migration.js
```

## 📊 Vérification Post-Migration

### 1. Vérifier les colonnes
```sql
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'articles' 
  AND column_name IN (
    'ai_keywords', 
    'normalized_url', 
    'source',
    'ai_category',
    'category',
    'keywords'
  )
ORDER BY column_name;
```

### 2. Vérifier les données migrées
```sql
SELECT 
  id,
  title,
  category,
  ai_category,
  keywords,
  ai_keywords,
  image_url,
  normalized_url,
  source
FROM articles
WHERE ai_category IS NOT NULL
LIMIT 10;
```

### 3. Compter les articles enrichis
```sql
SELECT 
  COUNT(*) as total,
  COUNT(ai_category) as with_ai_category,
  COUNT(ai_keywords) as with_ai_keywords,
  COUNT(normalized_url) as with_normalized_url,
  COUNT(source) as with_source
FROM articles;
```

## ⚠️ Points d'Attention

### Avant d'exécuter:
1. ✅ Vérifier que Supabase est accessible
2. ✅ Faire un backup si nécessaire
3. ✅ Vérifier que le backend est arrêté (éviter conflits)

### Après exécution:
1. ✅ Vérifier les logs pour erreurs
2. ✅ Tester l'API `/api/articles`
3. ✅ Redémarrer le backend

## 🔄 Rollback (si problème)

Si vous devez annuler la migration:

```sql
-- Annuler les migrations de données
UPDATE articles SET ai_category = NULL WHERE category IS NOT NULL;
UPDATE articles SET ai_keywords = NULL WHERE keywords IS NOT NULL;

-- Supprimer les nouvelles colonnes
ALTER TABLE articles DROP COLUMN IF EXISTS ai_keywords;
ALTER TABLE articles DROP COLUMN IF EXISTS normalized_url;
ALTER TABLE articles DROP COLUMN IF EXISTS source;
```

## 📝 Notes Importantes

### Colonnes Conservées (ne seront PAS supprimées)
- `category` - Conservée pour compatibilité legacy
- `keywords` - Conservée pour compatibilité legacy
- `sentiment` - Conservée pour compatibilité legacy
- `image_urls` - Conservée pour compatibilité legacy

**Raison:** Le code existant peut encore les utiliser. Elles seront supprimées dans une future migration après mise à jour du code.

### Impact sur le Code
- ✅ `RSSAggregator` déjà mis à jour pour utiliser les nouvelles colonnes
- ✅ `RSSProcessor` déjà mis à jour (mais désactivé)
- ⚠️ Certains scripts d'enrichissement peuvent nécessiter une mise à jour

## 📞 Support

Si vous rencontrez des erreurs:
1. Vérifier les logs Supabase
2. Vérifier que les colonnes n'existent pas déjà
3. Exécuter les commandes une par une pour identifier le problème
