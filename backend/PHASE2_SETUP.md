# ⚙️ CONFIGURATION PHASE 2 - ENRICHISSEMENT

## ❌ PROBLÈME DÉTECTÉ

Le fichier `backend/.env` contient des valeurs d'exemple au lieu des vraies credentials.

```
Actuel: https://your-project.supabase.co
Requis: https://ykytsadwfqoyusleoflf.supabase.co
```

---

## ✅ SOLUTION : METTRE À JOUR LE .ENV

### **1. Ouvrir le fichier .env**

```bash
cd backend
nano .env
# OU
code .env
# OU
open .env
```

### **2. Remplacer les valeurs d'exemple**

```env
# ❌ AVANT (exemple)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
OPENAI_API_KEY=sk-proj-VOTRE_CLE_ICI

# ✅ APRÈS (vraies valeurs)
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI... (votre clé anon)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI... (votre clé service role)
OPENAI_API_KEY=sk-proj-... (votre clé OpenAI)
```

---

## 🔑 OÙ TROUVER LES CLÉS

### **Supabase**

1. **Dashboard Supabase** : https://supabase.com/dashboard
2. **Projet** : GABON 24/7 (ykytsadwfqoyusleoflf)
3. **Settings** → **API**

```
Project URL: https://ykytsadwfqoyusleoflf.supabase.co
anon/public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **OpenAI**

1. **Dashboard OpenAI** : https://platform.openai.com/api-keys
2. **Create new secret key**
3. **Copier la clé** : `sk-proj-...`

⚠️ **La clé OpenAI ne s'affiche qu'une seule fois !**

---

## 🧪 VÉRIFIER LA CONFIGURATION

### **Script de vérification**

```bash
cd backend/scripts
node check-env.js
```

**Résultat attendu** :

```
🔍 VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT

============================================================
SUPABASE_URL: https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_SERVICE_ROLE_KEY: ✅ Définie
OPENAI_API_KEY: ✅ Définie
============================================================

🧪 Test connexion Supabase...

✅ Connexion Supabase OK - 12144 articles trouvés
```

---

## 🚀 LANCER L'ENRICHISSEMENT

### **Une fois le .env configuré**

```bash
# 1. Test sur 5 articles
cd backend/scripts
node enrich-articles-test.js

# 2. Si le test réussit, enrichissement massif
node enrich-articles-batch.js
```

---

## 📝 EXEMPLE DE .ENV COMPLET

```env
# 🔑 CLÉS API
OPENAI_API_KEY=sk-proj-abc123xyz789...

# 📊 SUPABASE
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl...

# 🌐 URLs
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# 📧 NEWSLETTER (optionnel)
SENDGRID_API_KEY=

# 💬 WHATSAPP (optionnel)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# 🔒 JWT (optionnel)
JWT_SECRET=votre_secret_jwt_aleatoire_et_securise
```

---

## ⚠️ IMPORTANT

### **NE JAMAIS COMMITER LE .ENV !**

Le fichier `.env` est dans `.gitignore` pour une bonne raison :
- ❌ Ne pas push sur GitHub
- ❌ Ne pas partager les clés
- ✅ Garder les credentials en local uniquement

### **Service Role Key vs Anon Key**

- **Anon Key** : Frontend (publique, limitée)
- **Service Role Key** : Backend (privée, tous les pouvoirs)

Pour l'enrichissement, on utilise la **Service Role Key** car on a besoin d'accès complet à la base.

---

## 🔍 TROUBLESHOOTING

### **Erreur : TypeError: fetch failed**

```bash
# Vérifier l'URL Supabase
echo $SUPABASE_URL
# Doit afficher: https://ykytsadwfqoyusleoflf.supabase.co

# Si vide ou incorrect, mettre à jour .env
```

### **Erreur : supabaseKey is required**

```bash
# Vérifier la Service Role Key
cat backend/.env | grep SUPABASE_SERVICE_ROLE_KEY
# Doit afficher une longue clé JWT
```

### **Erreur : OpenAI API key**

```bash
# Vérifier la clé OpenAI
cat backend/.env | grep OPENAI_API_KEY
# Doit afficher: sk-proj-...
```

---

## ✅ CHECKLIST

Avant de lancer l'enrichissement :

- [ ] Fichier `backend/.env` existe
- [ ] URL Supabase correcte (ykytsadwfqoyusleoflf)
- [ ] Service Role Key définie (pas anon key)
- [ ] OpenAI API Key définie (sk-proj-)
- [ ] Script `check-env.js` réussit
- [ ] Test connexion Supabase OK

---

## 🎯 PROCHAINES ÉTAPES

Une fois le `.env` configuré correctement :

1. **Vérifier** : `node check-env.js` ✅
2. **Tester** : `node enrich-articles-test.js` (5 articles)
3. **Lancer** : `node enrich-articles-batch.js` (12,134 articles)

**Coût total estimé : $1.20-$1.50 pour 100% d'articles enrichis !** 🚀
