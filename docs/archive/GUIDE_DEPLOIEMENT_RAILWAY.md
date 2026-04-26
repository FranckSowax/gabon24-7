# 🚂 GUIDE COMPLET : DÉPLOIEMENT BACKEND SUR RAILWAY

## 📋 PRÉREQUIS

✅ **Backend préparé** : `package.json` et `Procfile` configurés
✅ **Compte GitHub** : Votre code doit être sur GitHub
✅ **Variables d'environnement** : Supabase + OpenAI prêtes

---

## 🚀 ÉTAPE 1 : CRÉER UN COMPTE RAILWAY

1. **Allez sur** : https://railway.app
2. **Cliquez sur "Start a New Project"**
3. **Connectez votre compte GitHub**
4. **Autorisez Railway** à accéder à vos repos

---

## 📦 ÉTAPE 2 : DÉPLOYER LE BACKEND

### A. Créer le projet Railway

1. **Cliquez sur "New Project"**
2. **Sélectionnez "Deploy from GitHub repo"**
3. **Choisissez** : `FranckSowax/gabon24-7`
4. **Railway va détecter automatiquement** votre backend

### B. Configuration du service

Railway va automatiquement :
- ✅ Installer les dépendances (`npm install`)
- ✅ Exécuter `npm start`
- ✅ Générer une URL publique

---

## 🔐 ÉTAPE 3 : CONFIGURER LES VARIABLES D'ENVIRONNEMENT

Dans le dashboard Railway, allez dans l'onglet **Variables** et ajoutez :

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Server
PORT=3001
NODE_ENV=production

# CORS (Important!)
FRONTEND_URL=https://gabon24-7.netlify.app
```

### 📝 Où trouver vos clés Supabase ?

1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet
3. **Settings** → **API**
4. Copiez :
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` → `SUPABASE_SERVICE_KEY`
   - `anon public key` → `SUPABASE_ANON_KEY`

---

## 🌐 ÉTAPE 4 : RÉCUPÉRER L'URL RAILWAY

Une fois déployé, Railway génère une URL comme :
```
https://gabon24-7-backend-production.up.railway.app
```

**Copiez cette URL !** Vous en aurez besoin pour Netlify.

---

## 🔧 ÉTAPE 5 : VÉRIFIER LE DÉPLOIEMENT

### A. Logs Railway

Dans Railway, cliquez sur **Deployments** pour voir les logs :

```bash
✅ npm install completed
✅ npm start executing
✅ Server listening on port 3001
✅ Supabase connected successfully
```

### B. Tester l'API

Ouvrez dans votre navigateur :
```
https://votre-url-railway.up.railway.app/api/articles?limit=5
```

Vous devriez voir des articles JSON.

---

## 🌍 ÉTAPE 6 : CONNECTER NETLIFY AU BACKEND RAILWAY

### A. Variables d'environnement Netlify

1. Allez sur **Netlify Dashboard**
2. Site Settings → **Environment variables**
3. **Ajoutez** :

```bash
NEXT_PUBLIC_API_URL=https://votre-url-railway.up.railway.app
```

### B. Redéployer Netlify

1. Dans Netlify, allez dans **Deploys**
2. Cliquez sur **Trigger deploy** → **Clear cache and deploy site**

---

## ✅ ÉTAPE 7 : VÉRIFICATION FINALE

### Test 1 : Backend accessible
```bash
curl https://votre-url-railway.up.railway.app/api/articles
```

### Test 2 : Frontend connecté
- Ouvrez `https://gabon24-7.netlify.app`
- Ouvrez la **Console du navigateur** (F12)
- Vous ne devriez plus voir d'erreurs CORS
- Les articles doivent s'afficher

---

## 🔄 ÉTAPE 8 : ACTIVER LES CRON JOBS (OPTIONNEL)

Railway supporte les cron jobs. Dans votre `server.js`, les crons démarrent automatiquement :

```javascript
// Vérifiez que ces lignes sont présentes
cron.schedule('*/15 * * * *', async () => {
  console.log('🔄 Exécution RSS Aggregator...');
  // Votre code RSS
});
```

Les crons s'exécuteront automatiquement sur Railway ! ✅

---

## 💡 COMMANDES UTILES

### Redéployer manuellement
```bash
# Dans Railway dashboard
Deployments → Redeploy
```

### Voir les logs en temps réel
```bash
# Dans Railway dashboard
Deployments → View Logs
```

### Restart le service
```bash
# Dans Railway dashboard
Settings → Restart
```

---

## 🚨 TROUBLESHOOTING

### ❌ Erreur : "Module not found"
**Solution** : Vérifiez que toutes les dépendances sont dans `package.json`

### ❌ Erreur : "Port already in use"
**Solution** : Railway assigne automatiquement un port via `process.env.PORT`

Vérifiez dans `server.js` :
```javascript
const PORT = process.env.PORT || 3001;
```

### ❌ Erreur CORS persistante
**Solution** : Vérifiez la config CORS dans `server.js` :
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://gabon24-7.netlify.app',
  credentials: true
}));
```

---

## 📊 COÛTS RAILWAY

Railway offre :
- ✅ **$5 de crédit gratuit/mois**
- ✅ **500 heures d'exécution gratuites**
- ✅ **1 GB RAM**
- ✅ **1 GB de données sortantes**

Largement suffisant pour votre projet ! 🎉

---

## 🎯 RÉSULTAT FINAL

Après ces étapes, vous aurez :

✅ Backend Express sur Railway
✅ Frontend Next.js sur Netlify
✅ Base de données Supabase
✅ CORS configuré correctement
✅ Cron jobs automatiques
✅ Logs accessibles
✅ Variables d'environnement sécurisées

**Votre architecture traditionnelle est maintenant en production !** 🚀

---

## 📞 PROCHAINES ÉTAPES

Une fois Railway déployé, revenez me dire :
1. ✅ "Backend déployé avec succès"
2. 🔗 L'URL Railway générée
3. ❓ S'il y a des erreurs dans les logs

Je vous guiderai pour configurer Netlify ! 😊
