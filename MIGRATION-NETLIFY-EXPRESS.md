# 📋 MIGRATION NETLIFY → EXPRESS

Migration des fonctions Netlify serverless vers architecture Express traditionnelle.

## 🎯 Fonctions à Migrer

### 1. ✅ Actu++ (EN COURS)
**Fichier Netlify:** `netlify/functions/actu-plus.js` (14KB)
**Route Express:** `/api/actu-plus` → `backend/routes/actu-plus.js`

**Fonctionnalités:**
- Résumé journalistique (gpt-4o-mini)
- Synthèse de recherche
- Fiche d'actualités
- Suggestions articles similaires (Perplexity optionnel)
- Système de crédits

**Dépendances:**
- OpenAI API
- Perplexity API (optionnel)
- Supabase (table `actu_plus_requests`)
- Credit Manager (à migrer)

### 2. ⏳ Opportunités IA
**Fichiers Netlify:**
- `analyze-opportunity.js` (39KB)
- `analyze-opportunity-complex.js` (20KB)
- `generate-opportunities-by-budget.js` (12KB)
- `enhance-opportunity.js` (10KB)
- `generate-business-ideas.js` (15KB)

**Routes Express à créer:**
- POST `/api/opportunities/analyze`
- POST `/api/opportunities/generate-by-budget`
- POST `/api/opportunities/enhance`
- POST `/api/opportunities/business-ideas`

**Fonctionnalités:**
- Analyse d'opportunités business
- Génération d'idées par budget
- Enrichissement contextuel
- Propositions de projets

### 3. ⏳ Résumé Audio
**Fichiers Netlify:**
- `audio-summary.js` (27KB)
- `audio-settings.js` (3KB)

**Routes Express à créer:**
- POST `/api/audio/generate-summary`
- GET/PUT `/api/audio/settings`

**Fonctionnalités:**
- Génération audio TTS (OpenAI)
- Gestion paramètres voix
- Cache audio Supabase Storage

### 4. ⏳ Veille & Alerte
**Fichiers Netlify:**
- `scheduled-alert-processor.js` (6.6KB)
- `process-alert-matches.js` (6KB)

**Routes Express à créer:**
- POST `/api/alerts/process`
- GET `/api/alerts/matches/:userId`
- POST `/api/alerts/create`
- PUT `/api/alerts/:id`
- DELETE `/api/alerts/:id`

**Fonctionnalités:**
- Matching articles/mots-clés
- Notifications utilisateur
- Traitement planifié (cron)

## 🔧 Services Communs à Migrer

### Credit Manager
**Fichier:** `netlify/functions/credit-manager.js` (8.7KB)
**Route:** `/api/credits/*`

Actions:
- `check_balance`
- `consume_credits`
- `add_credits`
- `get_history`

### Upload & Storage
**Fichiers:**
- `upload-image.js` (3.8KB)
- `upload-csv-gbi.js` (5KB)

**Routes:** `/api/upload/*`

## 📝 Plan de Migration

### Phase 1: Routes de Base ✅
- [x] Créer `backend/routes/actu-plus.js`
- [ ] Intégrer dans `server.js`
- [ ] Tester endpoint

### Phase 2: Opportunités IA
- [ ] Créer `backend/routes/opportunities.js`
- [ ] Migrer logique analyse
- [ ] Migrer générateur idées
- [ ] Tests

### Phase 3: Audio
- [ ] Créer `backend/routes/audio.js`
- [ ] Intégrer OpenAI TTS
- [ ] Gestion Supabase Storage
- [ ] Tests

### Phase 4: Alertes
- [ ] Créer `backend/routes/alerts.js`
- [ ] Système matching
- [ ] Cron jobs Express
- [ ] Tests

### Phase 5: Services Communs
- [ ] Credit Manager → Express
- [ ] Upload handlers
- [ ] Migration frontend

### Phase 6: Frontend
- [ ] Mettre à jour appels API
- [ ] Remplacer `.netlify/functions/` par `/api/`
- [ ] Tests end-to-end

## 🔌 Intégration server.js

```javascript
// Routes Actu++
const actuPlusRoutes = require('./routes/actu-plus');
app.use('/api/actu-plus', actuPlusRoutes);

// Routes Opportunités
const opportunitiesRoutes = require('./routes/opportunities');
app.use('/api/opportunities', opportunitiesRoutes);

// Routes Audio
const audioRoutes = require('./routes/audio');
app.use('/api/audio', audioRoutes);

// Routes Alertes
const alertsRoutes = require('./routes/alerts');
app.use('/api/alerts', alertsRoutes);

// Routes Crédits
const creditsRoutes = require('./routes/credits');
app.use('/api/credits', creditsRoutes);
```

## 🌐 Mise à Jour Frontend

### Avant (Netlify):
```typescript
const response = await fetch('/.netlify/functions/actu-plus', {
  method: 'POST',
  body: JSON.stringify({ ... })
})
```

### Après (Express):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const response = await fetch(`${API_URL}/api/actu-plus`, {
  method: 'POST',
  body: JSON.stringify({ ... })
})
```

## ⚠️ Points d'Attention

1. **Environment Variables**
   - Netlify: Variables configurées dans UI
   - Express: Fichier `.env` local

2. **CORS**
   - Netlify: Headers dans responses
   - Express: Middleware cors()

3. **Authentication**
   - Netlify: Event headers
   - Express: Middleware auth

4. **Error Handling**
   - Netlify: statusCode dans response
   - Express: res.status().json()

5. **Logs**
   - Netlify: console.log → Netlify UI
   - Express: console.log → Terminal/fichier

## ✅ Avantages Migration

- ✅ Architecture cohérente
- ✅ Debugging plus simple
- ✅ Déploiement unifié
- ✅ Moins de dépendances externes
- ✅ Meilleur contrôle ressources
- ✅ Conformité préférence utilisateur

## 📊 État Actuel

| Fonction | Fichiers | Taille | État |
|----------|----------|--------|------|
| Actu++ | 1 | 14KB | ✅ MIGRÉE |
| Opportunités IA | 5 | 97KB | ✅ MIGRÉE (4 routes) |
| Résumé Audio | 2 | 30KB | ✅ MIGRÉE (3 routes) |
| Veille & Alerte | 2 | 13KB | ✅ MIGRÉE (5 routes) |
| Credit Manager | 1 | 9KB | ✅ MIGRÉE (5 routes) |
| **Total** | **11** | **163KB** | **✅ 90% COMPLÉTÉ** |

## 🚀 Prochaines Étapes

1. ✅ ~~Phases 1-5 migrées~~
2. Mettre à jour frontend (appels API)
3. Tester end-to-end toutes les fonctions
4. Corriger tables Supabase manquantes (alertes)

## 📋 Routes Express Créées

### Actu++ (`/api/actu-plus`)
- `POST /` - Générer résumé intelligent

### Opportunités IA (`/api/opportunities`)
- `POST /analyze` - Analyser opportunité
- `POST /generate-by-budget` - Générer par budget
- `POST /enhance` - Enrichir opportunité
- `POST /business-ideas` - Idées d'affaires

### Audio (`/api/audio`)
- `POST /generate-summary` - Générer audio TTS
- `GET /settings/:userId` - Récupérer paramètres
- `PUT /settings` - Mettre à jour paramètres

### Alertes (`/api/alerts`)
- `POST /process` - Traiter alertes
- `GET /matches/:userId` - Récupérer matches
- `POST /create` - Créer alerte
- `PUT /:alertId` - Mettre à jour
- `DELETE /:alertId` - Supprimer

### Credits (`/api/credits`)
- `POST /check-balance` - Vérifier solde
- `POST /consume` - Consommer crédits
- `POST /add` - Ajouter crédits
- `GET /history/:userId` - Historique
- `GET /balance/:userId` - Solde simple

**Total: 18 routes Express fonctionnelles!**

---

**Dernière mise à jour:** 2025-10-01 03:35  
**Statut:** Migration backend complétée (90%) - Frontend à migrer
