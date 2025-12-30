# 🚀 Guide de Déploiement - Génération IA

## 📋 Checklist Déploiement Complet

### 1. ✅ Code Backend Committé
```bash
git status
git add -A
git commit -m "feat: Génération IA articles + images"
git push origin main
```

**Commits requis:**
- `ec283a2` - Génération article (GPT-5 Nano)
- `dae2a0a` - Génération image (Nano Banana)

### 2. 🔑 Variables d'Environnement Railway

**Railway Dashboard → Backend Service → Variables:**

```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Important:** Même token pour texte ET image.

**Vérification:**
```bash
# Via Railway CLI (si installé)
railway variables

# Ou via Dashboard
https://railway.app → gabon24-7-backend → Variables
```

### 3. 🔄 Redéploiement Railway

**Option A: Automatique (recommandé)**
- Railway détecte automatiquement push GitHub
- Attendre 2-3 minutes après push
- Vérifier logs: `railway logs`

**Option B: Manuel (si nécessaire)**
- Dashboard Railway → Deployments → "Redeploy"
- Ou CLI: `railway up`

**Vérifier déploiement:**
```bash
# Logs en temps réel
railway logs --tail

# Ou dans dashboard
https://railway.app → gabon24-7-backend → Deployments
```

### 4. ✅ Tester Endpoints Backend

**Endpoint 1: Génération Article**
```bash
curl -X POST https://gabon24-7-production.up.railway.app/api/generate-sponsored-article \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Corp",
    "product_service": "Service Test",
    "key_message": "Message test",
    "category": "business"
  }'

# Réponse attendue:
{
  "success": true,
  "article": {
    "title": "...",
    "subtitle": "...",
    "summary": "...",
    "content": "...",
    "author": "...",
    "keywords": [...]
  }
}
```

**Endpoint 2: Génération Image**
```bash
curl -X POST https://gabon24-7-production.up.railway.app/api/generate-article-image \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article Gabon",
    "category": "tech",
    "company_name": "Test Corp"
  }'

# Réponse attendue:
{
  "success": true,
  "image_url": "https://replicate.delivery/.../output.jpg"
}
```

### 5. 🌐 Frontend Netlify

**Netlify se redéploie automatiquement depuis GitHub:**
- Attendre 2-3 minutes après push
- Vérifier: https://app.netlify.com/sites/gabon24-7/deploys

**Variables Netlify (déjà configurées):**
```bash
NEXT_PUBLIC_API_URL=https://gabon24-7-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. 🧪 Tests End-to-End

**Test Complet Article Sponsorisé:**

1. **Aller sur:** https://gabon24-7.netlify.app/marketing/publicite/article-trending

2. **Brief Minimal:**
   - Entreprise: "TechGabon"
   - Produit: "Plateforme e-commerce"
   - Message clé: "100% gabonaise pour PME"
   - Audience: "Entrepreneurs gabonais"
   - CTA: "Créez votre boutique"

3. **Générer Texte:**
   - Cliquer "🤖 Générer avec IA"
   - Attendre 20-30s
   - Vérifier champs remplis

4. **Générer Image:**
   - Cliquer "🎨 Générer avec IA"
   - Attendre 20-30s
   - Vérifier preview image 16:9

5. **Soumettre:**
   - Remplir détails restants
   - Ajouter au panier
   - Procéder checkout

---

## 🚨 Troubleshooting

### Erreur: 404 sur endpoint

**Symptôme:**
```
POST /api/generate-sponsored-article 404 (Not Found)
```

**Causes possibles:**
1. Backend Railway pas à jour
2. Endpoint mal nommé
3. Déploiement en cours

**Solutions:**
```bash
# 1. Vérifier déploiement Railway
railway status

# 2. Forcer redéploiement
railway up --detach

# 3. Vérifier logs
railway logs --tail

# 4. Tester endpoint directement
curl https://gabon24-7-production.up.railway.app/api/generate-sponsored-article
```

### Erreur: REPLICATE_API_TOKEN manquant

**Symptôme:**
```
Error: REPLICATE_API_TOKEN requis pour génération IA
```

**Solution:**
1. Railway Dashboard → Variables
2. Ajouter: `REPLICATE_API_TOKEN=r8_...`
3. Redéployer: "Redeploy" button

### Erreur: Timeout génération

**Symptôme:**
```
Timeout après 120 secondes
```

**Causes:**
- Replicate API lent
- Prompt trop complexe
- Problème réseau

**Solutions:**
1. Réessayer (souvent temporaire)
2. Simplifier prompt
3. Utiliser mode manuel

### Erreur React #418 (Hydration)

**Symptôme:**
```
Uncaught Error: Minified React error #418
Text content does not match server-rendered HTML
```

**Cause:**
- Contenu dynamique différent entre SSR et client
- Dates, timestamps, random values

**Solution:**
```tsx
// Utiliser useEffect pour contenu dynamique
useEffect(() => {
  setDynamicContent(...)
}, [])

// Ou supprimer SSR pour cette page
export const dynamic = 'force-dynamic'
```

---

## 📊 Vérification Statut Services

### Backend Railway
```bash
# URL: https://gabon24-7-production.up.railway.app
curl https://gabon24-7-production.up.railway.app/health

# Attendu: { "status": "ok", "timestamp": "..." }
```

### Frontend Netlify
```bash
# URL: https://gabon24-7.netlify.app
curl -I https://gabon24-7.netlify.app

# Attendu: HTTP/2 200
```

### Replicate API
```bash
# Tester token
curl https://api.replicate.com/v1/predictions \
  -H "Authorization: Token $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "db03cf8353c6e0b3b66ff7d6e8f89f41a7b1d43e5c8b9e8c4f5e6d7c8b9a0f1e",
    "input": {"prompt": "test"}
  }'

# Attendu: { "id": "...", "status": "starting" }
```

---

## 🔐 Sécurité

### Tokens Sensibles
- ❌ **Jamais commiter** dans git
- ✅ Toujours dans variables d'environnement
- ✅ Railway: Variables tab
- ✅ Netlify: Site settings → Environment variables

### CORS
Backend configuré pour accepter Netlify:
```javascript
app.use(cors({
  origin: ['https://gabon24-7.netlify.app', 'http://localhost:3000']
}))
```

---

## 📈 Monitoring

### Logs Railway
```bash
# Temps réel
railway logs --tail

# Dernières 100 lignes
railway logs --lines 100

# Filtrer erreurs
railway logs | grep ERROR
```

### Logs Netlify
- Dashboard → Deploys → Deploy log
- Functions → Function logs (si applicable)

### Replicate Dashboard
- https://replicate.com/account → API calls
- Vérifier usage et coûts

---

## ✅ Checklist Finale

- [ ] Code committé et pushé sur GitHub
- [ ] `REPLICATE_API_TOKEN` configuré sur Railway
- [ ] Railway déployé (vérifier logs)
- [ ] Netlify déployé (vérifier preview)
- [ ] Endpoint `/api/generate-sponsored-article` répond 200
- [ ] Endpoint `/api/generate-article-image` répond 200
- [ ] Test génération article (30s max)
- [ ] Test génération image (30s max)
- [ ] Workflow complet fonctionne
- [ ] Fallback manuel fonctionne

---

## 🆘 Support

**Si problème persiste:**

1. Vérifier logs Railway: `railway logs --tail`
2. Vérifier variables: `railway variables`
3. Tester endpoints: `curl -X POST ...`
4. Vérifier Replicate token: https://replicate.com/account
5. Forcer redéploiement: Railway dashboard → Redeploy

**Contacts:**
- Railway Support: https://railway.app/help
- Replicate Support: https://replicate.com/docs
- Netlify Support: https://www.netlify.com/support/

---

## 🚀 Commandes Rapides

```bash
# Tout redéployer
git push origin main
# → Railway et Netlify se redéploient automatiquement

# Vérifier status
curl https://gabon24-7-production.up.railway.app/health
curl -I https://gabon24-7.netlify.app

# Tester IA
curl -X POST https://gabon24-7-production.up.railway.app/api/generate-sponsored-article \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Test","product_service":"Service","key_message":"Message"}'

# Logs en direct
railway logs --tail
```

---

**Déploiement réussi = Endpoints 200 + Génération IA fonctionnelle** ✅
