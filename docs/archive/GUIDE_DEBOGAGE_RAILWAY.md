# 🔧 Guide de débogage Railway - Gabon24-7

**Pour:** Diagnostiquer et résoudre les problèmes backend Railway  
**Temps:** 10-15 minutes  
**Niveau:** Intermédiaire

---

## 🎯 Arbre de décision

```
┌─────────────────────────────────────────┐
│  Le frontend affiche des erreurs ?      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │  Erreurs CORS  │
         │  ou 404 ?      │
         └────┬───────┬───┘
              │       │
        CORS  │       │  404
              ▼       ▼
    ┌─────────────┐ ┌──────────────────┐
    │ Vérifier    │ │ Backend Railway  │
    │ origine     │ │ est DOWN         │
    │ autorisée   │ │                  │
    └─────────────┘ └────────┬─────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Consulter logs       │
                  │ Railway              │
                  └──────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ Erreur au démarrage ?    │
              └──────┬───────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   Variables    Module      Port
   manquantes   manquant    occupé
        │            │            │
        ▼            ▼            ▼
   Ajouter      npm install  Changer
   variables    sur Railway  PORT
```

---

## 🔍 Checklist de diagnostic

### 1️⃣ Vérifier l'état du backend

```bash
# Test rapide
curl -I https://gabon24-7-production.up.railway.app/

# Résultat attendu: HTTP/2 200
# Résultat actuel: HTTP/2 404 + x-railway-fallback: true
```

**Si 404 avec fallback → Backend DOWN, passer à l'étape 2**

---

### 2️⃣ Consulter les logs Railway

**Accès:**
1. https://railway.app/dashboard
2. Projet `gabon24-7-production`
3. Onglet "Deployments"
4. Dernier déploiement
5. "View Logs"

**Erreurs courantes à rechercher:**

#### ❌ Erreur 1: Variable d'environnement manquante

```bash
Error: Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY
    at /app/supabase-config.js:10:11
```

**Solution:**
```bash
Railway Dashboard → Variables → New Variable
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Clé depuis Supabase Dashboard]
```

#### ❌ Erreur 2: Connexion Supabase échouée

```bash
Error: Invalid Supabase credentials
    at createClient (/app/node_modules/@supabase/supabase-js/...)
```

**Solution:**
- Vérifier que `SUPABASE_URL` est correct
- Vérifier que `SUPABASE_SERVICE_ROLE_KEY` est valide
- Tester les clés dans Supabase Dashboard

#### ❌ Erreur 3: Module manquant

```bash
Error: Cannot find module 'express'
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:...)
```

**Solution:**
```bash
Railway Dashboard → Settings
Build Command: npm install
Vérifier que package.json est présent
```

#### ❌ Erreur 4: Port déjà utilisé

```bash
Error: listen EADDRINUSE: address already in use :::3001
    at Server.setupListenHandle [as _listen2] (net.js:...)
```

**Solution:**
```bash
Railway définit automatiquement PORT
Vérifier que le code utilise: process.env.PORT || 3001
```

#### ❌ Erreur 5: Crash au démarrage RSS

```bash
❌ Erreur démarrage RSS: Error: Redis connection failed
    at RSSAggregator.start (/app/rss-aggregator.js:...)
```

**Solution:**
- Redis n'est pas requis pour le démarrage
- Vérifier la configuration Redis (optionnelle)
- Ou désactiver temporairement le processeur RSS

---

### 3️⃣ Vérifier les variables d'environnement

**Variables CRITIQUES (requis):**

```bash
✅ SUPABASE_SERVICE_ROLE_KEY
✅ SUPABASE_URL
✅ SUPABASE_ANON_KEY
```

**Variables IMPORTANTES (recommandées):**

```bash
✅ FRONTEND_URL=https://gabon24-7.netlify.app
✅ NODE_ENV=production
✅ PORT (défini automatiquement par Railway)
```

**Comment vérifier:**

```bash
Railway Dashboard → Variables
Vérifier que toutes les variables sont présentes
Vérifier qu'il n'y a pas d'espaces ou de caractères invisibles
```

---

### 4️⃣ Vérifier la configuration Railway

**Settings à vérifier:**

```bash
Railway Dashboard → Settings

✅ Start Command: node server.js
✅ Build Command: npm install
✅ Root Directory: backend
✅ Node Version: 18.x ou supérieur
```

---

### 5️⃣ Tester les endpoints

**Une fois le serveur redémarré:**

```bash
# Test 1: Santé du serveur
curl https://gabon24-7-production.up.railway.app/
# Attendu: HTML de la page d'accueil

# Test 2: Articles trending
curl https://gabon24-7-production.up.railway.app/api/articles/trending
# Attendu: JSON avec articles

# Test 3: CORS
curl -H "Origin: https://gabon24-7.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://gabon24-7-production.up.railway.app/api/articles/trending
# Attendu: Headers CORS présents
```

**Ou utiliser le script automatique:**

```bash
./test-railway-backend.sh
```

---

## 🛠️ Solutions par type d'erreur

### 🔴 Backend DOWN (404 + fallback)

**Symptômes:**
- Tous les endpoints retournent 404
- `x-railway-fallback: true` dans les headers
- Frontend affiche erreurs CORS

**Causes possibles:**
1. Variables d'environnement manquantes
2. Erreur au démarrage du serveur
3. Crash pendant l'initialisation

**Solution:**
1. Consulter les logs Railway
2. Identifier l'erreur spécifique
3. Appliquer la solution correspondante
4. Attendre le redémarrage (30-60s)
5. Tester avec `./test-railway-backend.sh`

---

### 🟡 CORS Errors (mais serveur accessible)

**Symptômes:**
- Backend répond (pas de 404)
- Erreur "No 'Access-Control-Allow-Origin' header"
- Frontend bloqué par la politique CORS

**Causes possibles:**
1. Origine non autorisée dans `allowedOrigins`
2. Configuration CORS incorrecte
3. Middleware CORS mal placé

**Solution:**

Vérifier `backend/server.js` lignes 156-178:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://gabon24-7.netlify.app',  // ✅ Doit être présent
  'https://gabon-insight.netlify.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

**Si l'origine n'est pas autorisée:**
1. Ajouter l'origine dans `allowedOrigins`
2. Ou ajouter `FRONTEND_URL` dans Railway Variables
3. Redéployer

---

### 🟢 Lenteur ou timeouts

**Symptômes:**
- Backend répond mais très lentement
- Timeouts fréquents
- Erreurs `ERR_TIMED_OUT`

**Causes possibles:**
1. Requêtes Supabase lentes
2. Processeur RSS bloque le démarrage
3. Trop de requêtes simultanées

**Solution:**
1. Vérifier les index Supabase
2. Optimiser les requêtes SQL
3. Implémenter du caching
4. Augmenter les timeouts frontend

---

## 📊 Logs Railway - Interprétation

### ✅ Logs de succès

```bash
🚀 Serveur Gabon Insight démarré sur le port 3001
📡 API accessible sur: http://localhost:3001
🏠 Page d'accueil: http://localhost:3001
✅ Fichiers statiques servis depuis /public
✅ Supabase client initialisé avec clé SERVICE_ROLE (bypass RLS)
📡 Initialisation du processeur RSS...
✅ Processeur RSS démarré avec succès
```

**→ Backend opérationnel**

---

### ❌ Logs d'erreur

```bash
Error: Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY
    at /app/supabase-config.js:10:11
    at Module._compile (internal/modules/cjs/loader.js:...)
```

**→ Variable manquante, ajouter dans Railway**

---

```bash
⚠️  ATTENTION: Utilisation de la clé ANON au lieu de la clé SERVICE_ROLE
❌ Erreur: "Aucun article trouvé dans les dernières 24h"
```

**→ Mauvaise clé configurée, utiliser SERVICE_ROLE**

---

```bash
Error: listen EADDRINUSE: address already in use :::3001
```

**→ Port occupé (rare sur Railway), vérifier configuration**

---

## 🧪 Tests de vérification

### Test 1: Santé du serveur

```bash
curl -I https://gabon24-7-production.up.railway.app/
```

**Résultat attendu:**
```http
HTTP/2 200
content-type: text/html
```

**Résultat actuel (problème):**
```http
HTTP/2 404
x-railway-fallback: true
```

---

### Test 2: Endpoint API

```bash
curl https://gabon24-7-production.up.railway.app/api/articles/trending
```

**Résultat attendu:**
```json
{
  "success": true,
  "articles": [...]
}
```

**Résultat actuel (problème):**
```json
{
  "error": "Not Found"
}
```

---

### Test 3: CORS

```bash
curl -H "Origin: https://gabon24-7.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     -I https://gabon24-7-production.up.railway.app/api/articles/trending
```

**Résultat attendu:**
```http
HTTP/2 200
access-control-allow-origin: https://gabon24-7.netlify.app
access-control-allow-credentials: true
```

---

## 📝 Checklist de résolution complète

### Avant de commencer
- [ ] Accès au Dashboard Railway
- [ ] Accès au Dashboard Supabase
- [ ] Terminal avec curl installé

### Diagnostic
- [ ] Tester l'endpoint `/` (devrait retourner 200)
- [ ] Vérifier les logs Railway
- [ ] Identifier l'erreur spécifique

### Configuration
- [ ] Obtenir `SUPABASE_SERVICE_ROLE_KEY` depuis Supabase
- [ ] Obtenir `SUPABASE_URL` depuis Supabase
- [ ] Obtenir `SUPABASE_ANON_KEY` depuis Supabase
- [ ] Ajouter les 3 variables dans Railway
- [ ] Ajouter `FRONTEND_URL=https://gabon24-7.netlify.app`
- [ ] Vérifier `NODE_ENV=production`

### Vérification
- [ ] Attendre redémarrage Railway (30-60s)
- [ ] Consulter les nouveaux logs
- [ ] Vérifier message de succès dans les logs
- [ ] Tester avec `./test-railway-backend.sh`
- [ ] Tester manuellement les endpoints
- [ ] Vérifier le frontend Netlify

### Validation finale
- [ ] Articles chargés sur le frontend
- [ ] Aucune erreur CORS dans la console
- [ ] Résumés audio disponibles
- [ ] Recherche fonctionnelle
- [ ] Toutes les fonctionnalités opérationnelles

---

## 🆘 Escalade

Si le problème persiste après avoir suivi ce guide :

### Niveau 1: Documentation
1. Relire `SOLUTION_RAPIDE_RAILWAY.md`
2. Relire `DIAGNOSTIC_RAILWAY_CORS.md`
3. Consulter `backend/RAILWAY_SETUP.md`

### Niveau 2: Support Railway
1. Copier les logs Railway (50 dernières lignes)
2. Créer un ticket support Railway
3. Inclure les informations de diagnostic

### Niveau 3: Support Supabase
1. Vérifier que les clés sont valides
2. Tester les clés dans Supabase Dashboard
3. Régénérer les clés si nécessaire

---

## 📚 Ressources

- **Dashboard Railway:** https://railway.app/dashboard
- **Dashboard Supabase:** https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf
- **Documentation Railway:** https://docs.railway.app
- **Documentation Supabase:** https://supabase.com/docs

---

**Dernière mise à jour:** 13 novembre 2025  
**Auteur:** Guide de débogage Cascade AI
