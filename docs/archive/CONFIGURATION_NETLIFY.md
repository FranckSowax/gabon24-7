# 🌐 CONFIGURATION NETLIFY → RAILWAY

## ✅ PRÉREQUIS

Backend Railway déployé : `https://gabon24-7-production.up.railway.app`

---

## 📝 ÉTAPE 1 : CONFIGURER LA VARIABLE D'ENVIRONNEMENT NETLIFY

### **A. Accéder aux Variables Netlify**

1. Allez sur **Netlify Dashboard** : https://app.netlify.com
2. Sélectionnez votre site : **gabon24-7** (ou le nom de votre site)
3. **Site Settings** → **Environment variables**

### **B. Ajouter la Variable API_URL**

Cliquez sur **"Add a variable"** ou **"New variable"**

```bash
Key: NEXT_PUBLIC_API_URL
Value: https://gabon24-7-production.up.railway.app
```

**⚠️ IMPORTANT** : 
- Le préfixe `NEXT_PUBLIC_` est **OBLIGATOIRE** pour Next.js
- Pas de `/` à la fin de l'URL
- Utilisez **HTTPS**, pas HTTP

### **C. Scopes (Portée)**

Assurez-vous que la variable est définie pour :
- ✅ **Production**
- ✅ **Deploy Previews** (optionnel)
- ✅ **Branch deploys** (optionnel)

---

## 🔄 ÉTAPE 2 : REDÉPLOYER NETLIFY

### **Option A : Trigger Deploy (Recommandé)**

1. Allez dans **Deploys**
2. Cliquez sur **"Trigger deploy"**
3. Sélectionnez **"Clear cache and deploy site"**

### **Option B : Push GitHub**

Les nouvelles variables seront utilisées au prochain déploiement automatique.

---

## 🧪 ÉTAPE 3 : VÉRIFICATION

Une fois Netlify redéployé :

### **Test 1 : Vérifier la Variable**

Ouvrez la console du navigateur (F12) sur votre site Netlify et tapez :

```javascript
console.log(process.env.NEXT_PUBLIC_API_URL)
// Devrait afficher: https://gabon24-7-production.up.railway.app
```

### **Test 2 : Vérifier les Requêtes**

Dans la console :
- Allez sur l'onglet **Network**
- Rafraîchissez la page (F5)
- Cherchez les requêtes vers `gabon24-7-production.up.railway.app`
- Vérifiez qu'il n'y a **plus d'erreurs CORS**

### **Test 3 : Vérifier les Articles**

Les articles doivent s'afficher sur la page d'accueil sans erreur.

---

## ✅ RÉSULTAT ATTENDU

### **Avant :**
```
❌ Access to fetch at 'http://localhost:3001/api/articles' blocked by CORS
❌ Failed to fetch
```

### **Après :**
```
✅ 200 OK https://gabon24-7-production.up.railway.app/api/articles
✅ Articles chargés
✅ Pas d'erreur CORS
```

---

## 🔍 VÉRIFICATIONS FINALES

### **Logs Netlify** (Build Logs)

Cherchez cette ligne dans les logs de build :

```bash
✓ Collecting page data
✓ Generating static pages
```

### **Console Navigateur** (Runtime)

Plus d'erreurs :
- ~~Mixed Content~~
- ~~CORS policy~~
- ~~Failed to fetch~~

---

## 🎯 ARCHITECTURE FINALE

```
┌─────────────────────────────────────────┐
│         UTILISATEUR                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  NETLIFY (Frontend Next.js)             │
│  https://gabon24-7.netlify.app          │
│                                          │
│  NEXT_PUBLIC_API_URL =                  │
│  https://gabon24-7-production...        │
└──────────────┬──────────────────────────┘
               │
               ▼ fetch()
┌─────────────────────────────────────────┐
│  RAILWAY (Backend Express)              │
│  https://gabon24-7-production...        │
│                                          │
│  • CORS: Netlify autorisé ✅            │
│  • API endpoints actifs ✅              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  SUPABASE (Database)                    │
│  Articles, Users, Events...             │
└─────────────────────────────────────────┘
```

---

## ❓ TROUBLESHOOTING

### **Problème : Variables non prises en compte**

**Solution :**
1. Vérifiez le préfixe `NEXT_PUBLIC_`
2. Clear cache and redeploy
3. Attendez 2-3 minutes (propagation)

### **Problème : CORS toujours bloqué**

**Solution :**
1. Vérifiez les logs Railway (CORS configuré ?)
2. Vérifiez que Railway a bien redémarré après ajout variables
3. Testez directement l'API Railway :
   ```bash
   curl -H "Origin: https://gabon24-7.netlify.app" \
        https://gabon24-7-production.up.railway.app/api/articles
   ```

### **Problème : Articles ne chargent pas**

**Solution :**
1. F12 → Network → Vérifier les requêtes
2. Vérifier que `SUPABASE_SERVICE_KEY` est bien dans Railway
3. Vérifier les logs Railway pour erreurs Supabase

---

## 📞 SUPPORT

Si problème persistant :
1. Logs Netlify (Build + Function logs)
2. Logs Railway (Deployments)
3. Console navigateur (F12 → Console + Network)

**Copiez-collez les erreurs et demandez de l'aide !** 🆘

---

## 🎉 SUCCÈS !

Quand tout fonctionne, vous devriez voir :

✅ Articles chargés depuis Railway  
✅ Images affichées  
✅ Aucune erreur CORS  
✅ Temps de chargement rapide  
✅ Logs propres  

**Votre architecture traditionnelle est maintenant en production !** 🚀
