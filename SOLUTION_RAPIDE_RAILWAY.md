# 🚀 Solution Rapide - Redémarrer le Backend Railway

**Problème:** Backend Railway DOWN → Frontend Netlify ne peut pas charger les articles

**Diagnostic confirmé:** ❌ Railway fallback actif - Le serveur n'est pas démarré

---

## ⚡ Solution en 5 minutes

### **Étape 1 : Accéder au Dashboard Railway**

1. Allez sur https://railway.app/dashboard
2. Connectez-vous avec votre compte
3. Sélectionnez le projet **gabon24-7-production**

---

### **Étape 2 : Consulter les logs (IMPORTANT)**

1. Cliquez sur l'onglet **"Deployments"**
2. Sélectionnez le dernier déploiement
3. Cliquez sur **"View Logs"**

**Recherchez ces erreurs courantes :**

```bash
# Erreur 1: Variable manquante
❌ Error: Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY

# Erreur 2: Connexion Supabase échouée
❌ Error: Invalid Supabase credentials

# Erreur 3: Port déjà utilisé
❌ Error: Port 3001 is already in use

# Erreur 4: Module manquant
❌ Error: Cannot find module 'xxx'
```

---

### **Étape 3 : Configurer les variables d'environnement**

1. Dans Railway Dashboard, cliquez sur **"Variables"**
2. Ajoutez ces variables **CRITIQUES** :

```bash
# 🔑 SUPABASE (CRITIQUE)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🌐 FRONTEND
FRONTEND_URL=https://gabon24-7.netlify.app

# 🚀 SERVEUR
NODE_ENV=production
PORT=3001
```

**Comment obtenir les clés Supabase :**

1. Allez sur https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api
2. Section **"Project API keys"**
3. Copiez :
   - **`service_role`** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ CRITIQUE
   - **`anon`** → `SUPABASE_ANON_KEY`
4. Copiez l'URL du projet → `SUPABASE_URL`

---

### **Étape 4 : Redémarrer le déploiement**

**Option A : Redémarrage automatique (recommandé)**
- Railway redémarre automatiquement après modification des variables
- Attendez 30-60 secondes

**Option B : Redémarrage manuel**
1. Cliquez sur **"Settings"**
2. Cliquez sur **"Redeploy"**
3. Attendez la fin du déploiement

---

### **Étape 5 : Vérifier que ça fonctionne**

**Test rapide dans le terminal :**

```bash
# Depuis votre machine locale
./test-railway-backend.sh
```

**Ou testez manuellement :**

```bash
# Test 1: Serveur accessible
curl https://gabon24-7-production.up.railway.app/

# Test 2: Articles trending
curl https://gabon24-7-production.up.railway.app/api/articles/trending

# Résultat attendu: JSON avec liste d'articles
```

**Test dans le navigateur :**

1. Ouvrez https://gabon24-7.netlify.app
2. Vérifiez que les articles se chargent
3. Vérifiez qu'il n'y a plus d'erreurs CORS dans la console

---

## 🔍 Si le problème persiste

### **Vérification 1 : Logs Railway**

Consultez les logs en temps réel :

```bash
# Dans Railway Dashboard → Deployments → View Logs
```

Recherchez :
- `✅ Serveur Gabon Insight démarré sur le port 3001`
- `✅ Processeur RSS démarré avec succès`
- `✅ Supabase client initialisé avec clé SERVICE_ROLE`

### **Vérification 2 : Variables d'environnement**

Dans Railway Dashboard → Variables, vérifiez que **toutes** ces variables sont définies :

- ✅ `SUPABASE_SERVICE_ROLE_KEY` (commence par `eyJ...`)
- ✅ `SUPABASE_URL` (https://ykytsadwfqoyusleoflf.supabase.co)
- ✅ `SUPABASE_ANON_KEY` (commence par `eyJ...`)
- ✅ `FRONTEND_URL` (https://gabon24-7.netlify.app)
- ✅ `NODE_ENV` (production)

### **Vérification 3 : Configuration Railway**

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

## 🎯 Checklist de résolution

- [ ] Consulter les logs Railway
- [ ] Identifier l'erreur au démarrage
- [ ] Ajouter `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Ajouter `SUPABASE_URL`
- [ ] Ajouter `SUPABASE_ANON_KEY`
- [ ] Ajouter `FRONTEND_URL`
- [ ] Attendre le redémarrage automatique (30-60s)
- [ ] Tester avec `./test-railway-backend.sh`
- [ ] Vérifier le frontend Netlify
- [ ] Confirmer qu'il n'y a plus d'erreurs CORS

---

## 📊 Résultat attendu

### **Logs Railway (succès) :**

```bash
✅ Serveur Gabon Insight démarré sur le port 3001
📡 API accessible sur: http://localhost:3001
✅ Supabase client initialisé avec clé SERVICE_ROLE (bypass RLS)
✅ Processeur RSS démarré avec succès
```

### **Test backend (succès) :**

```bash
$ ./test-railway-backend.sh

✅ Serveur accessible (HTTP 200)
✅ Endpoint accessible (HTTP 200)
✅ CORS configuré correctement
✅ Pas de fallback - Le serveur répond normalement
✅ Backend opérationnel
```

### **Frontend Netlify (succès) :**

- ✅ Articles chargés sur la page d'accueil
- ✅ Aucune erreur CORS dans la console
- ✅ Résumés audio disponibles
- ✅ Recherche fonctionnelle

---

## 🆘 Besoin d'aide ?

Si le problème persiste après ces étapes :

1. **Partagez les logs Railway** (copier/coller les 50 dernières lignes)
2. **Partagez les erreurs console** du frontend Netlify
3. **Vérifiez que les clés Supabase sont valides** (testez-les dans Supabase Dashboard)

---

**Date:** 13 novembre 2025  
**Temps estimé:** 5-10 minutes  
**Difficulté:** ⭐⭐☆☆☆ (Facile)
