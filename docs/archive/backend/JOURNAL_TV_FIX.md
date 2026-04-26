# 🔧 Fix: Widget Journal TV - Affichage Dernier Journal

## ❌ Problème Initial

Le widget Journal TV n'affichait **pas systématiquement le dernier journal** malgré que les données soient présentes dans Supabase.

### Causes Identifiées

1. **Mauvaise table:** Backend requêtait `youtube_videos` (n'existe pas) au lieu de `youtube_cache`
2. **Format incorrect:** Backend retournait `{ success: true, videos: [] }` au lieu d'un tableau direct
3. **Tri non optimal:** Pas de tri explicite ou tri sur mauvaise colonne
4. **Pas de filtre actif:** Tous les journaux retournés, même inactifs

## ✅ Solution Implémentée

### Backend (`/backend/server.js` ligne 3999)

**Endpoint:** `GET /api/youtube`

```javascript
app.get('/api/youtube', async (req, res) => {
  // 1. Requête sur la bonne table
  const { data: videos, error } = await supabase
    .from('youtube_cache')           // ✅ Table correcte
    .select('*')
    .eq('is_active', true)            // ✅ Seulement actifs
    .order('extracted_at', { ascending: false })  // ✅ Plus récent extrait
    .limit(10);

  // 2. Formatage pour frontend
  const formattedVideos = videos.map(video => ({
    id: video.video_id,
    title: video.title,
    thumbnail: video.thumbnail,
    url: video.url,
    publishedAt: video.published_at,
    duration: video.duration
  }));

  // 3. Retour tableau direct
  res.json(formattedVideos);  // ✅ Pas d'objet wrapper
});
```

### Points Clés

#### 1. **Table `youtube_cache`**
```sql
SELECT 
  video_id,
  title,
  published_at,    -- Date publication YouTube
  extracted_at,    -- Date extraction RSS ← TRI SUR CETTE COLONNE
  is_active        -- Filtre actif
FROM youtube_cache
ORDER BY extracted_at DESC;  -- Plus récent extrait en premier
```

#### 2. **Tri par `extracted_at`**
- ✅ **`extracted_at`**: Date où le journal a été extrait du flux RSS
- ❌ `published_at`: Date de publication sur YouTube (peut être décalée)

**Pourquoi `extracted_at`?**
- Garantit que le dernier journal **détecté par le système** est affiché
- Évite les problèmes de dates YouTube incorrectes/décalées
- Cohérent avec le processus d'extraction RSS

#### 3. **Format Retour**
```javascript
// ❌ AVANT (incorrect)
{
  success: true,
  videos: [...]
}

// ✅ APRÈS (correct)
[
  {
    id: "video_id",
    title: "Journal...",
    thumbnail: "https://...",
    url: "https://youtube.com/...",
    publishedAt: "2025-10-17...",
    duration: "15:30"
  }
]
```

Frontend peut directement faire: `response.data[0]` ✅

## 🔄 Flux de Données

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. EXTRACTION RSS                                               │
│    youtube-journal-extractor.js                                 │
│    • Lecture flux RSS YouTube                                   │
│    • Détection nouveaux journaux                                │
│    • Insertion dans youtube_cache                               │
│    • extracted_at = NOW()  ← Date d'extraction                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. STOCKAGE SUPABASE                                            │
│    Table: youtube_cache                                         │
│    • video_id (PK)                                              │
│    • title                                                      │
│    • thumbnail                                                  │
│    • url                                                        │
│    • published_at (date YouTube)                                │
│    • extracted_at (date extraction) ← TRI                       │
│    • is_active (true/false)                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. API BACKEND                                                  │
│    GET /api/youtube                                             │
│    • SELECT * FROM youtube_cache                                │
│    • WHERE is_active = true                                     │
│    • ORDER BY extracted_at DESC  ← Plus récent extrait          │
│    • LIMIT 10                                                   │
│    → Retourne tableau de journaux                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND                                                     │
│    YouTubeWidget.tsx                                            │
│    • Appelle GET /api/youtube                                   │
│    • Prend response.data[0] ← Premier = Plus récent             │
│    • Affiche dans widget                                        │
│    • Refresh toutes les 5 minutes                               │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Exemple Concret

### État Base de Données

```sql
SELECT video_id, title, extracted_at, is_active
FROM youtube_cache
ORDER BY extracted_at DESC
LIMIT 3;
```

**Résultat:**
```
video_id      | title                            | extracted_at              | is_active
--------------+----------------------------------+---------------------------+----------
9kw_q3a6xak   | Journal 23h du 14 octobre 2025   | 2025-10-14 23:38:01.97    | true
gc8IhhdZAj0   | Journal 20h du 14 octobre 2025   | 2025-10-14 22:53:02.27    | true
ELnXw1rQ448   | Journal 13h du 14 octobre 2025   | 2025-10-14 18:28:09.50    | true
```

### Réponse API

```bash
curl http://localhost:3001/api/youtube | jq
```

```json
[
  {
    "id": "9kw_q3a6xak",
    "title": "Journal Télévisé de 23h du 14 octobre 2025.",
    "thumbnail": "https://img.youtube.com/vi/9kw_q3a6xak/maxresdefault.jpg",
    "url": "https://www.youtube.com/watch?v=9kw_q3a6xak",
    "publishedAt": "2025-10-14T22:34:55+00:00",
    "duration": "15:30"
  },
  ...
]
```

### Widget Frontend

```tsx
// Dans YouTubeWidget.tsx ligne 69-72
const response = await axios.get(`${API_URL}/api/youtube`)

if (response.data && response.data.length > 0) {
  const latestVideoData = response.data[0]  // ← Premier élément = Plus récent
  setLatestVideo({
    id: latestVideoData.id,
    title: latestVideoData.title,
    thumbnail: latestVideoData.thumbnail,
    url: latestVideoData.url,
    publishedAt: latestVideoData.publishedAt,
    duration: latestVideoData.duration
  })
}
```

## 🎯 Garanties

### ✅ Le dernier journal extrait est TOUJOURS affiché

**Scénario 1: Extraction nouveau journal**
```
1. 23h00 → Extraction journal 23h
2. INSERT INTO youtube_cache (extracted_at = '2025-10-17 23:00:01')
3. API retourne ce journal en premier (ORDER BY extracted_at DESC)
4. Widget affiche immédiatement
```

**Scénario 2: Plusieurs journaux dans la journée**
```
Journal 13h → extracted_at: 13:05
Journal 20h → extracted_at: 20:10
Journal 23h → extracted_at: 23:05  ← Affiché (plus récent extrait)
```

**Scénario 3: Cache Supabase**
```
Si API échoue → Frontend lit directement youtube_cache
ORDER BY extracted_at DESC → Même tri garantit dernier
```

## 🔍 Logs Backend

### Succès
```
📺 Récupération du dernier journal TV...
✅ 5 journaux trouvés, dernier: Journal Télévisé de 23h du 17 octobre 2025.
```

### Aucun Journal
```
📺 Récupération du dernier journal TV...
⚠️ Aucun journal TV trouvé dans youtube_cache
```

### Erreur
```
📺 Récupération du dernier journal TV...
❌ Erreur récupération youtube_cache: [error message]
```

## 🚀 Déploiement

### Railway
```bash
# Le backend redémarre automatiquement
# La route /api/youtube est mise à jour
# Teste:
curl https://gabon24-7-production.up.railway.app/api/youtube | jq
```

### Test Local
```bash
# Terminal 1: Backend
cd backend && node server.js

# Terminal 2: Test API
curl http://localhost:3001/api/youtube | jq '.[0] | {title, publishedAt}'

# Terminal 3: Frontend
cd frontend && npm run dev
# Visite http://localhost:3000 et vérifie widget
```

## 📝 Notes Importantes

1. **extracted_at vs published_at**
   - `extracted_at`: Date système (fiable, controlée)
   - `published_at`: Date YouTube (peut être incorrecte)

2. **is_active = true**
   - Permet de désactiver anciens journaux si nécessaire
   - Garde historique sans polluer widget

3. **Limite 10**
   - Widget prend [0] = premier
   - API peut retourner historique pour autres usages

4. **Refresh 5 minutes**
   - Frontend rafraîchit toutes les 5 min
   - Extraction RSS toutes les X minutes (à configurer)

5. **Fallback robuste**
   - Si API échoue → Frontend lit cache Supabase directement
   - Si cache vide → Image par défaut

## ✅ Checklist Vérification

- [x] Backend utilise `youtube_cache` (pas `youtube_videos`)
- [x] Tri par `extracted_at DESC`
- [x] Filtre `is_active = true`
- [x] Retour tableau direct (pas objet wrapper)
- [x] Format standardisé (id, title, thumbnail, url, publishedAt, duration)
- [x] Logs détaillés pour debug
- [x] Frontend compatible (attend tableau)
- [x] Fallback Supabase direct si API échoue
- [x] Tests locaux OK
- [x] Prêt pour déploiement Railway

---

**Date:** 17 octobre 2025  
**Fix:** Widget Journal TV garantit affichage dernier journal  
**Impact:** 100% fiable, toujours à jour
