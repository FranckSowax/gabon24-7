# 🎉 SOLUTION COMPLÈTE - WIDGET ÉVÉNEMENTS

## 🔍 PROBLÈME IDENTIFIÉ

**Symptôme:** Les mêmes cartes d'événements tournent en boucle depuis longtemps

**Cause racine:** Pas de synchronisation automatique avec la source de données (Eventime.ga)

## ✅ SOLUTIONS IMPLÉMENTÉES

### 1. Extracteur RSS Événements (`events-rss-extractor.js`)

**Fichier:** `/backend/events-rss-extractor.js`

**Fonctionnalités:**

#### A. Extraction depuis le flux RSS
```bash
node events-rss-extractor.js
```

- Récupère le flux RSS: `https://rss.app/feeds/S4lUk8j474PjWeYr.xml`
- Parse le XML avec `xml2js`
- Extrait les données:
  - Titre, description, lien
  - Image (`media:thumbnail`, `media:content`, `enclosure` ou extraction HTML)
  - Lieu (extraction depuis description)
  - Date de publication

#### B. Synchronisation avec Supabase
- Vérifie si l'événement existe déjà (par URL)
- Insère les nouveaux événements
- Met à jour les événements modifiés (titre ou image changés)
- Gère les erreurs individuellement
- Logs détaillés pour chaque opération

#### C. Nettoyage automatique
```bash
node events-rss-extractor.js --clean
```

- Supprime les événements de plus de 30 jours
- Maintient la base propre

### 2. API Backend Améliorée

**Fichier:** `/backend/server.js`

#### Endpoint GET `/api/events`
```javascript
// Récupère les événements actifs depuis Supabase
// Support ancien format (event_date) et nouveau format (published_at)
// Transforme les données pour le frontend
```

**Réponse:**
```json
{
  "success": true,
  "events": [
    {
      "id": "...",
      "title": "La couronne Bantu",
      "description": "...",
      "published_at": "2025-10-09T00:03:00Z",
      "location": "Libreville, Gabon",
      "url": "https://eventime.ga/...",
      "image_url": "https://...",
      "category": "Événement",
      "organizer": "Eventime.ga",
      "formattedDate": "mercredi 9 octobre 2025 à 00:03"
    }
  ],
  "total": 8
}
```

#### Endpoint POST `/api/events/sync`
```javascript
// Synchronisation manuelle depuis le RSS
// Utile pour forcer une mise à jour immédiate
```

**Réponse:**
```json
{
  "success": true,
  "message": "Synchronisation des événements terminée",
  "inserted": 5,
  "updated": 2,
  "errors": 0,
  "total": 8
}
```

### 3. Cron Job Quotidien

**Planification:** Tous les jours à **6h du matin** (heure de Libreville)

```javascript
cron.schedule('0 6 * * *', async () => {
  // Synchronise automatiquement les événements
  // Depuis le flux RSS Eventime.ga
}, { timezone: 'Africa/Libreville' });
```

**Logs:**
```
⏰ Planification synchronisation événements (tous les jours à 6h)...
🎉 Cron: synchronisation des événements depuis RSS...
✅ Cron: événements synchronisés - 5 ajoutés, 2 mis à jour
```

### 4. Widget Frontend (Déjà Existant)

**Fichier:** `/frontend/src/components/widgets/UpcomingEvents.tsx`

**Fonctionnalités:**
- Appelle `/api/events` au chargement
- Cache local (localStorage) pour performance
- Carrousel automatique (8 secondes par événement)
- Navigation manuelle (indicateurs et flèches)
- Affichage responsive
- Image proxy pour éviter CORS
- Lien vers Eventime.ga

## 🚀 UTILISATION

### Synchronisation Manuelle Immédiate

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/backend

# Synchroniser les événements
node events-rss-extractor.js

# Synchroniser + nettoyer les vieux événements
node events-rss-extractor.js --clean
```

### Via API (depuis le frontend ou Postman)

```bash
# POST pour synchroniser
curl -X POST http://localhost:3001/api/events/sync

# GET pour récupérer les événements
curl http://localhost:3001/api/events
```

### Test du Widget

1. **Ouvrir** http://localhost:3000
2. **Regarder la sidebar droite** - Widget "Événements à venir"
3. **Vérifier:**
   - Les nouveaux événements s'affichent
   - Les images sont visibles
   - Le carrousel fonctionne
   - Le clic ouvre Eventime.ga

## 📊 RÉSULTAT ATTENDU

### Avant
```
Widget affiche: 3 vieux événements qui tournent en boucle
Source: Données statiques ou très anciennes
Mise à jour: Jamais automatique
```

### Après
```
Widget affiche: 8 événements récents depuis Eventime.ga
Source: Flux RSS synchronisé quotidiennement
Mise à jour: Automatique tous les jours à 6h
```

## 🗃️ STRUCTURE DE LA TABLE `events`

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  location TEXT DEFAULT 'Libreville, Gabon',
  published_at TIMESTAMP WITH TIME ZONE,
  source TEXT DEFAULT 'Eventime.ga',
  is_active BOOLEAN DEFAULT true,
  category TEXT,
  organizer TEXT,
  event_date TIMESTAMP WITH TIME ZONE,  -- Support ancien format
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 CONFIGURATION

### Flux RSS Source

```javascript
const RSS_URL = 'https://rss.app/feeds/S4lUk8j474PjWeYr.xml';
```

### Cron Schedule

```javascript
// Tous les jours à 6h (Africa/Libreville)
cron.schedule('0 6 * * *', ...)

// Pour changer l'heure, modifier le pattern cron:
// '0 6 * * *'  = 6h du matin tous les jours
// '0 */6 * * *'  = Toutes les 6 heures
// '0 0 * * *'  = Minuit tous les jours
```

### Nettoyage Automatique

```javascript
// Événements de plus de 30 jours supprimés
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
```

## 🧪 TESTS

### 1. Test de l'extracteur

```bash
cd backend
node events-rss-extractor.js
```

**Résultat attendu:**
```
🎉 EXTRACTION DES ÉVÉNEMENTS DEPUIS RSS
✅ 8 événements trouvés dans le flux RSS

1. 09/10 00:03 | Image: ✅ OUI
   📰 La couronne Bantu
   🖼️  https://...

✅ Ajouté: La couronne Bantu
...

📊 RÉSULTAT:
   ✅ Événements ajoutés: 5
   🔄 Événements mis à jour: 2
   ❌ Erreurs: 0
```

### 2. Test de l'API

```bash
# Récupérer les événements
curl http://localhost:3001/api/events | jq

# Synchroniser manuellement
curl -X POST http://localhost:3001/api/events/sync | jq
```

### 3. Test du Widget

- Ouvrir http://localhost:3000
- Widget "Événements à venir" dans la sidebar droite
- Vérifier le carrousel automatique
- Cliquer sur "Voir sur Eventime.ga"

## 🔄 FLUX DE DONNÉES

```
┌─────────────────────┐
│  Eventime.ga RSS    │
│  (Source externe)   │
└──────────┬──────────┘
           │
           │ Flux RSS
           ▼
┌─────────────────────┐
│ events-rss-         │
│ extractor.js        │
│ (Parse & Extract)   │
└──────────┬──────────┘
           │
           │ Insert/Update
           ▼
┌─────────────────────┐
│   Supabase DB       │
│   Table: events     │
└──────────┬──────────┘
           │
           │ API Query
           ▼
┌─────────────────────┐
│  GET /api/events    │
│  (Backend API)      │
└──────────┬──────────┘
           │
           │ JSON Response
           ▼
┌─────────────────────┐
│  UpcomingEvents     │
│  Widget (Frontend)  │
└─────────────────────┘
```

## 📝 PROCHAINES ÉTAPES

1. ✅ **Synchronisation initiale**
   ```bash
   cd backend
   node events-rss-extractor.js
   ```

2. ✅ **Redémarrer le backend**
   ```bash
   pkill -f "node server.js"
   node server.js
   ```

3. ✅ **Rafraîchir le frontend**
   - Ouvrir http://localhost:3000
   - Les nouveaux événements apparaissent immédiatement

4. ⏭️  **Optionnel: Ajuster la fréquence**
   - Modifier le cron schedule dans `server.js`
   - Par exemple: `'0 */6 * * *'` pour toutes les 6 heures

## 🎯 COMMANDES RAPIDES

```bash
# 1. Synchroniser les événements maintenant
cd backend
node events-rss-extractor.js

# 2. Vérifier les événements dans la base
node -e "
const s = require('./supabase-config');
s.supabase.from('events').select('title, published_at, location, image_url')
  .eq('is_active', true).order('published_at', { ascending: false }).limit(5)
  .then(({data}) => console.log(JSON.stringify(data, null, 2)));
"

# 3. Tester l'API
curl http://localhost:3001/api/events | python3 -m json.tool

# 4. Forcer une synchronisation via API
curl -X POST http://localhost:3001/api/events/sync
```

## 💡 DÉPANNAGE

### Problème: Aucun événement retourné

**Vérifier la connexion au flux RSS:**
```bash
curl -I https://rss.app/feeds/S4lUk8j474PjWeYr.xml
```

**Vérifier les événements dans Supabase:**
```bash
node -e "
const s = require('./supabase-config');
s.supabase.from('events').select('count').then(({count}) => console.log('Total événements:', count));
"
```

### Problème: Images ne s'affichent pas

**Vérifier les URLs d'images:**
```bash
node events-rss-extractor.js | grep "🖼️"
```

**Le proxy d'images devrait gérer les CORS automatiquement.**

### Problème: Cron ne s'exécute pas

**Vérifier les logs du serveur:**
```bash
tail -f backend/server.log | grep "🎉 Cron"
```

**Forcer une exécution manuelle:**
```bash
curl -X POST http://localhost:3001/api/events/sync
```

---

**Status:** ✅ Solution implémentée et prête à déployer  
**Dernière mise à jour:** 2025-10-09 00:01  
**Synchronisation:** Quotidienne à 6h (Africa/Libreville)
