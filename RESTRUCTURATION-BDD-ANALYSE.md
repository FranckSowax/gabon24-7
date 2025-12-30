# 🔍 ANALYSE COMPLÈTE - RESTRUCTURATION BASE DE DONNÉES

## 📊 CHANGEMENTS DE COLONNES IDENTIFIÉS

### Table `articles`

| Ancien Nom | Nouveau Nom | Type | Impact |
|------------|-------------|------|--------|
| `rss_feed_id` | `feed_id` | UUID | ⚠️ CRITIQUE |
| `image_url` | `image_urls` | TEXT → TEXT[] | ⚠️ CRITIQUE |
| `ai_summary` | `summary_ai` | TEXT | ⚠️ CRITIQUE |
| `ai_category` | `category` | TEXT | ⚠️ CRITIQUE |
| `ai_sentiment` | `sentiment_score` | FLOAT | ⚠️ CRITIQUE |
| `ai_importance` | `importance` | INTEGER (1-10) | ⚠️ CRITIQUE |
| `ai_is_breaking` | `is_breaking` | BOOLEAN | ⚠️ CRITIQUE |
| `ai_keywords` | `keywords` | TEXT[] | ⚠️ CRITIQUE |

---

## ✅ FICHIERS DÉJÀ CORRIGÉS

### Backend

1. **`backend/server.js`**
   - ✅ Ligne 1028: `feed_id` au lieu de `rss_feed_id` (stats)
   - ⚠️ Ligne 1261, 1312, 2437, 2499: Utilise encore `ai_category`
   - ⚠️ Ligne 3933-3936: Utilise encore `ai_category`, `ai_sentiment`, `ai_keywords`

2. **`backend/rss-aggregator.js`**
   - ✅ Ligne 178: `summary_ai` correct
   - ✅ Ligne 597: `feed_id` correct
   - ✅ Ligne 594: `image_urls` array correct
   - ⚠️ Lignes 179-184: Utilise encore `ai_category`, `ai_sentiment`, etc.
   - ✅ Lignes 605-611: Mapping correct vers nouveaux noms

3. **`backend/rss-processor.js`**
   - ✅ Ligne 342: `summary_ai` correct
   - ✅ Ligne 393: `image_urls` array correct
   - ⚠️ Lignes 354-358: Utilise encore anciennes colonnes IA
   - ⚠️ Lignes 401-405: Insert avec anciennes colonnes IA

4. **`frontend/src/components/widgets/YouTubeWidget.tsx`**
   - ✅ Ligne 99: `published_at` au lieu de `extracted_at`

---

## ❌ FICHIERS À CORRIGER

### Backend - Colonnes IA

#### 1. `backend/rss-aggregator.js` (Lignes 179-184)
```javascript
// ❌ AVANT (utilise anciennes colonnes):
category: aiEnrichment.ai_category,
ai_category: aiEnrichment.ai_category,
ai_sentiment: aiEnrichment.ai_sentiment,
ai_importance: aiEnrichment.ai_importance,
ai_is_breaking: aiEnrichment.ai_is_breaking,
ai_keywords: aiEnrichment.ai_keywords || []

// ✅ APRÈS (utiliser nouveaux noms):
category: aiEnrichment.ai_category,
sentiment_score: aiEnrichment.ai_sentiment,
importance: aiEnrichment.ai_importance ? Math.max(1, Math.round(aiEnrichment.ai_importance * 10)) : null,
is_breaking: aiEnrichment.ai_is_breaking,
keywords: aiEnrichment.ai_keywords || []
```

#### 2. `backend/rss-processor.js` (Lignes 354-358)
```javascript
// ❌ AVANT:
ai_category: aiEnrichment.ai_category,
ai_sentiment: aiEnrichment.ai_sentiment,
ai_importance: aiEnrichment.ai_importance,
ai_is_breaking: aiEnrichment.ai_is_breaking,
ai_keywords: aiEnrichment.ai_keywords || []

// ✅ APRÈS (ne pas stocker, déjà mappé dans saveArticle):
// Supprimer ces lignes car le mapping est fait dans l'insertion
```

#### 3. `backend/rss-processor.js` (Lignes 401-405)
```javascript
// ❌ AVANT:
ai_category: article.ai_category || null,
ai_sentiment: article.ai_sentiment || null,
ai_importance: article.ai_importance || null,
ai_is_breaking: article.ai_is_breaking || false,
ai_keywords: article.ai_keywords || []

// ✅ APRÈS:
category: article.category || null,
sentiment_score: article.sentiment_score || null,
importance: article.importance || null,
is_breaking: article.is_breaking || false,
keywords: article.keywords || []
```

#### 4. `backend/server.js` (Lignes 1261, 1312, 2437, 2499)
```javascript
// ❌ AVANT:
category: article.ai_category || article.category

// ✅ APRÈS:
category: article.category
```

#### 5. `backend/server.js` (Lignes 3933-3936)
```javascript
// ❌ AVANT:
.update({
  category: enrichment.ai_category || enrichment.category,
  sentiment: enrichment.ai_sentiment || enrichment.sentiment,
  keywords: enrichment.ai_keywords || enrichment.keywords
})

// ✅ APRÈS:
.update({
  category: enrichment.ai_category || enrichment.category,
  sentiment_score: enrichment.ai_sentiment || enrichment.sentiment,
  keywords: enrichment.ai_keywords || enrichment.keywords
})
```

### Backend - Scripts d'enrichissement

#### 6. `backend/enrich-*.js` (Tous les scripts)
```javascript
// ❌ AVANT:
.select('id, title, content, summary, ai_summary, category')

// ✅ APRÈS:
.select('id, title, content, summary, summary_ai, category')

// ❌ AVANT:
article.summary || article.ai_summary || ''

// ✅ APRÈS:
article.summary || article.summary_ai || ''

// ❌ AVANT:
.update({
  ai_summary: enrichment.ai_summary,
  ai_category: enrichment.ai_category,
  ai_sentiment: enrichment.ai_sentiment,
  ...
})

// ✅ APRÈS:
.update({
  summary_ai: enrichment.ai_summary,
  category: enrichment.ai_category,
  sentiment_score: enrichment.ai_sentiment,
  importance: enrichment.ai_importance ? Math.max(1, Math.round(enrichment.ai_importance * 10)) : null,
  is_breaking: enrichment.ai_is_breaking,
  keywords: enrichment.ai_keywords
})
```

### Backend - Tests

#### 7. `backend/test-home-route.js`
```javascript
// ❌ AVANT:
console.log(`      - rss_feed_id: ${a.rss_feed_id || 'NULL'}`);
rss_feeds:rss_feed_id (media_name)

// ✅ APRÈS:
console.log(`      - feed_id: ${a.feed_id || 'NULL'}`);
rss_feeds:feed_id (media_name)
```

#### 8. `backend/import-csv-articles.js`
```javascript
// ✅ DÉJÀ CORRECT:
feed_id: rssFeedId
```

### Backend - Services TypeScript

#### 9. `backend/src/services/rss.service.ts`
```javascript
// ❌ AVANT:
rss_feed_id: feedId

// ✅ APRÈS:
feed_id: feedId
```

#### 10. `backend/src/config/database.ts`
```javascript
// ❌ AVANT:
rss_feed_id: string

// ✅ APRÈS:
feed_id: string
```

### Frontend

#### 11. `frontend/src/app/admin/campaigns/page.tsx`
```typescript
// ⚠️ Vérifier si utilise image_url ou image_urls
// Ligne 30: image_url: string
// Devrait être: image_urls: string[]
```

#### 12. `frontend/src/lib/favorites.ts`
```typescript
// ⚠️ Ligne 134:
article_image_url: h.article_image_url ?? h.image_url ?? h.imageUrl

// Vérifier si doit utiliser image_urls[0]
```

---

## 🎯 PRIORITÉS DE CORRECTION

### 🔴 CRITIQUE (Bloque fonctionnalités)

1. **`backend/rss-processor.js`** - Insertion articles RSS
2. **`backend/rss-aggregator.js`** - Sauvegarde articles
3. **`backend/server.js`** - Endpoints API principaux

### 🟡 IMPORTANT (Affecte données)

4. **Scripts d'enrichissement** - Mise à jour métadonnées IA
5. **`backend/server.js`** - Endpoint enrichissement

### 🟢 MINEUR (Logs/Tests)

6. **Scripts de test** - Affichage debug
7. **Services TypeScript** - Types/interfaces

---

## 📝 PLAN D'ACTION

### Phase 1: Corrections Backend Critiques ✅
1. ✅ `rss_feed_id` → `feed_id` (stats)
2. ✅ `image_url` → `image_urls` (array)
3. ✅ `ai_summary` → `summary_ai` (mapping)
4. ⏳ Colonnes IA dans rss-processor.js
5. ⏳ Colonnes IA dans rss-aggregator.js
6. ⏳ Colonnes IA dans server.js

### Phase 2: Scripts d'Enrichissement
1. ⏳ Mettre à jour tous les `enrich-*.js`
2. ⏳ Corriger les SELECT et UPDATE

### Phase 3: Tests et Services
1. ⏳ Corriger test-home-route.js
2. ⏳ Mettre à jour types TypeScript

### Phase 4: Vérification Frontend
1. ⏳ Vérifier usage image_urls
2. ⏳ Tester affichage articles

---

## 🧪 TESTS RECOMMANDÉS

### Après Corrections Backend:
```bash
# 1. Tester insertion RSS
node backend/force-rss-sync.js

# 2. Vérifier articles dans Supabase
SELECT id, title, feed_id, image_urls, summary_ai, category, 
       sentiment_score, importance, is_breaking, keywords
FROM articles 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC 
LIMIT 5;

# 3. Tester endpoint home
curl https://gabon24-7-production.up.railway.app/api/articles/home

# 4. Vérifier enrichissement
node backend/enrich-latest.js
```

### Après Corrections Frontend:
1. Ouvrir https://gabon24-7.netlify.app
2. Vérifier affichage images
3. Vérifier catégories articles
4. Tester favoris

---

## 📊 RÉSUMÉ

**Total fichiers affectés:** ~15 fichiers
**Corrections critiques:** 6 fichiers
**Corrections importantes:** 5 fichiers
**Corrections mineures:** 4 fichiers

**État actuel:**
- ✅ 30% corrigé (colonnes principales)
- ⏳ 70% à corriger (colonnes IA, scripts)

**Temps estimé:** 1-2 heures pour tout corriger

---

## 🔗 RÉFÉRENCES

- Migration BDD: 12 octobre 2025
- Colonnes renommées pour cohérence
- Format `image_urls` pour multi-images
- Colonnes IA normalisées (sans préfixe `ai_`)
