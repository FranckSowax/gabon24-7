# 🔴 Diagnostic : Backend Railway DOWN - Erreurs CORS

**Date:** 13 novembre 2025  
**Statut:** Backend inaccessible depuis Netlify

---

## 🚨 Problème identifié

Le backend Railway (`https://gabon24-7-production.up.railway.app`) retourne **404** avec `x-railway-fallback: true`, indiquant que **le serveur Node.js n'est pas démarré**.

### Symptômes observés

```
❌ GET /api/articles/trending → 404 Not Found
❌ GET /api/articles/week → 404 Not Found
❌ GET /api/audio/latest-public → CORS Error
❌ POST /api/slides → CORS Error
❌ GET /api/polls → 404 Not Found
```

### Réponse serveur Railway

```http
HTTP/2 404
x-railway-fallback: true
x-railway-edge: railway/asia-southeast1-eqsg3a
```

Le flag `x-railway-fallback: true` signifie que Railway ne peut pas router vers votre application.

---

## 🔍 Causes possibles

### 1. **Variables d'environnement manquantes** ⚠️

D'après `backend/RAILWAY_SETUP.md`, la clé `SUPABASE_SERVICE_ROLE_KEY` est **CRITIQUE** :

```
⚠️ ATTENTION: Sans cette clé, le serveur utilise la clé ANON
❌ Résultat: Politiques RLS activées → Aucun article trouvé
❌ Le serveur peut crasher au démarrage
```

### 2. **Serveur crashé au démarrage**

Le serveur `server.js` démarre le processeur RSS automatiquement :

```javascript
// Ligne 5716-5720
console.log('\n📡 Initialisation du processeur RSS...');
rssAggregator.start()
  .then(() => console.log('✅ Processeur RSS démarré avec succès'))
  .catch(err => console.error('❌ Erreur démarrage RSS:', err));
```

Si une dépendance manque (Redis, Supabase), le serveur peut crasher.

### 3. **Port non configuré**

Le serveur écoute sur `process.env.PORT || 3001`. Railway doit définir la variable `PORT`.

---

## ✅ Solutions

### **Étape 1 : Vérifier les logs Railway**

1. Allez sur https://railway.app/dashboard
2. Sélectionnez votre projet `gabon24-7-production`
3. Cliquez sur l'onglet **"Deployments"**
4. Consultez les logs du dernier déploiement

**Recherchez ces erreurs :**
- `Error: Missing required environment variable`
- `ECONNREFUSED` (Redis/Supabase)
- `Cannot find module`
- `Port already in use`

---

### **Étape 2 : Configurer les variables d'environnement**

Dans Railway Dashboard → Variables, ajoutez :

```bash
# 🔑 CRITIQUE - Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🌐 URLs
FRONTEND_URL=https://gabon24-7.netlify.app
API_URL=https://gabon24-7-production.up.railway.app

# 🚀 Configuration serveur
PORT=3001
NODE_ENV=production

# 🤖 IA (optionnel mais recommandé)
OPENAI_API_KEY=sk-proj-...
REPLICATE_API_TOKEN=r8_...

# 🔒 JWT
JWT_SECRET=votre_secret_jwt_securise
```

**Comment obtenir `SUPABASE_SERVICE_ROLE_KEY` :**
1. https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api
2. Section "Project API keys"
3. Copiez la clé **`service_role`** (⚠️ PAS la clé `anon`)

---

### **Étape 3 : Vérifier la configuration Railway**

Dans Railway Dashboard → Settings :

**Start Command:**
```bash
node server.js
```

**Build Command:**
```bash
npm install
```

**Root Directory:**
```
backend
```

---

### **Étape 4 : Corriger la configuration CORS (si nécessaire)**

Le fichier `backend/server.js` (lignes 156-178) autorise déjà Netlify :

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://gabon24-7.netlify.app',  // ✅ Déjà configuré
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

**✅ CORS est correctement configuré** - Le problème vient du serveur qui ne démarre pas.

---

## 🧪 Tests de vérification

Une fois le serveur redémarré, testez ces endpoints :

### Test 1 : Santé du serveur
```bash
curl https://gabon24-7-production.up.railway.app/
```
**Attendu:** Code 200 avec page HTML

### Test 2 : Articles trending
```bash
curl https://gabon24-7-production.up.railway.app/api/articles/trending
```
**Attendu:** JSON avec liste d'articles

### Test 3 : Articles de la semaine
```bash
curl https://gabon24-7-production.up.railway.app/api/articles/week
```
**Attendu:** JSON avec articles des 7 derniers jours

### Test 4 : Audio summaries
```bash
curl https://gabon24-7-production.up.railway.app/api/audio/latest-public?language=fr
```
**Attendu:** JSON avec résumés audio

### Test 5 : CORS depuis Netlify
```bash
curl -H "Origin: https://gabon24-7.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://gabon24-7-production.up.railway.app/api/articles/trending
```
**Attendu:** Headers CORS présents

---

## 📊 Checklist de résolution

- [ ] Consulter les logs Railway
- [ ] Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Railway
- [ ] Ajouter `SUPABASE_URL` dans Railway
- [ ] Ajouter `SUPABASE_ANON_KEY` dans Railway
- [ ] Configurer `FRONTEND_URL=https://gabon24-7.netlify.app`
- [ ] Vérifier que `PORT` est défini (Railway le fait automatiquement)
- [ ] Redémarrer le déploiement Railway
- [ ] Attendre 30-60 secondes
- [ ] Tester l'endpoint `/` (devrait retourner 200)
- [ ] Tester `/api/articles/trending` depuis le navigateur
- [ ] Vérifier que le frontend Netlify charge les articles

---

## 🔗 Ressources

- **Dashboard Railway:** https://railway.app/dashboard
- **Supabase API Keys:** https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api
- **Frontend Netlify:** https://gabon24-7.netlify.app
- **Documentation CORS:** `backend/server.js` lignes 155-178

---

## 📝 Notes importantes

1. **La configuration CORS est correcte** - Le problème n'est PAS lié à CORS mais au fait que le serveur ne démarre pas
2. **`SUPABASE_SERVICE_ROLE_KEY` est CRITIQUE** - Sans elle, le serveur peut crasher ou ne pas trouver d'articles
3. **Railway redémarre automatiquement** après modification des variables d'environnement
4. **Attendre 30-60 secondes** après le redémarrage pour que le serveur soit opérationnel

---

**Prochaine étape:** Consultez les logs Railway pour identifier l'erreur exacte au démarrage.
