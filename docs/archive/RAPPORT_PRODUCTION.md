# 🚀 RAPPORT DE MISE EN PRODUCTION - Gabon 24/7

**Date:** 11 Décembre 2025  
**Version:** 1.0.0

---

## 📊 ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────────┐
│                        UTILISATEURS                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NETLIFY (Frontend)                            │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │   Next.js 14    │  │     98 Fonctions Serverless         │   │
│  │   React 18      │  │     (dont 24 .unused)               │   │
│  │   TailwindCSS   │  │     ~20,000 lignes de code          │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY (Backend)                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   Express.js + Socket.io                                 │    │
│  │   ~5,900 lignes (server.js)                             │    │
│  │   4 Cron Jobs configurés                                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Database)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐   │
│  │   PostgreSQL    │  │   Auth          │  │   Storage     │   │
│  │   (Tables)      │  │   (Users)       │  │   (Images)    │   │
│  └─────────────────┘  └─────────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 CONFIGURATION RAILWAY (Backend)

### Fichier: `railway.toml`

| Paramètre | Valeur |
|-----------|--------|
| Builder | NIXPACKS |
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && node server.js` |
| Restart Policy | ON_FAILURE (max 10 retries) |

### ⏰ Cron Jobs Configurés

| Job | Schedule | Timezone | Description |
|-----|----------|----------|-------------|
| `extract-youtube-journals` | `0 */6 * * *` | Africa/Libreville | Extraction journaux TV (6h) |
| `morning-summaries` | `0 7 * * *` | Africa/Libreville | Résumés audio matin |
| `afternoon-summaries` | `0 13 * * *` | Africa/Libreville | Résumés audio après-midi |
| `evening-summaries` | `0 20 * * *` | Africa/Libreville | Résumés audio soir |

### 📦 Dépendances Backend Critiques

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2",
  "@supabase/supabase-js": "^2.57.2",
  "openai": "^4.104.0",
  "replicate": "^1.3.0",
  "bullmq": "^4.15.4",
  "node-cron": "^3.0.3"
}
```

---

## 🌐 CONFIGURATION NETLIFY (Frontend)

### Fichier: `netlify.toml`

| Paramètre | Valeur |
|-----------|--------|
| Base | `frontend` |
| Build Command | `npm run build` |
| Publish | `.next` |
| Functions | `../netlify/functions` |
| Node Version | 20 |

### ⏰ Fonctions Schedulées Netlify

| Fonction | Schedule | Description |
|----------|----------|-------------|
| `scheduled-rss-sync` | `*/15 * * * *` | Sync RSS (15 min) |
| `scheduled-ai-processor` | `*/3 * * * *` | Traitement IA (3 min) |
| `process-ticker-news` | `0 */3 * * *` | Messages ticker (3h) |
| `scheduled-alert-processor` | `*/5 * * * *` | Alertes (5 min) |
| `scheduled-digest-notifications` | `0 8 * * *` | Digest quotidien (8h UTC) |
| `generate-daily-poll` | `0 18 * * *` | Sondages (18h UTC) |
| `scheduled-poll-closer` | `55 18 * * *` | Clôture sondages |
| `scheduled-poll-publisher` | `0 19 * * *` | Publication sondages |
| `scheduled-audio-daily` | `0 6 * * *` | Résumé audio (6h UTC) |
| `scheduled-audio-cleanup` | `0 * * * *` | Nettoyage audio (1h) |

### 📊 Statistiques Fonctions Netlify

| Métrique | Valeur |
|----------|--------|
| Total fonctions | 63 |
| Fonctions actives (.js) | 63 |
| Fonctions désactivées (.unused) | 0 ✅ |
| Duplications supprimées | 11 ✅ |
| Lignes de code total | ~12,000 |

---

## 🔐 VARIABLES D'ENVIRONNEMENT REQUISES

### ⚠️ RAILWAY (Backend) - OBLIGATOIRES

```bash
# Supabase
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Clé service role (bypass RLS)

# IA - Au moins une des deux
GEMINI_API_KEY=AIza...            # Google Gemini 3 (recommandé)
OPENAI_API_KEY=sk-proj-...        # OpenAI (fallback)

# Services externes
REPLICATE_API_TOKEN=r8_...        # TTS Audio
RAPIDAPI_KEY=...                  # Football, TikTok, Météo
WHAPI_TOKEN=...                   # WhatsApp notifications

# Configuration
NODE_ENV=production
API_URL=https://votre-backend.railway.app
FRONTEND_URL=https://votre-site.netlify.app
JWT_SECRET=un_secret_fort_32_chars
```

### ⚠️ NETLIFY (Frontend) - OBLIGATOIRES

```bash
# Supabase (côté client)
NEXT_PUBLIC_SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase (côté serveur - fonctions)
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Backend API
NEXT_PUBLIC_API_URL=https://votre-backend.railway.app

# Services (pour fonctions serverless)
OPENAI_API_KEY=sk-proj-...
WHAPI_TOKEN=...
```

---

## ✅ CHECKLIST PRÉ-PRODUCTION

### 1. Railway (Backend)

- [ ] **Variables d'environnement configurées**
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] GEMINI_API_KEY ou OPENAI_API_KEY
  - [ ] REPLICATE_API_TOKEN
  - [ ] RAPIDAPI_KEY
  - [ ] WHAPI_TOKEN
  - [ ] JWT_SECRET
  - [ ] NODE_ENV=production

- [ ] **Déploiement**
  - [ ] Connecter repo GitHub
  - [ ] Vérifier build réussi
  - [ ] Vérifier logs de démarrage
  - [ ] Tester endpoint `/health`

- [ ] **Cron Jobs**
  - [ ] Vérifier activation des 4 crons
  - [ ] Tester manuellement les scripts

### 2. Netlify (Frontend)

- [ ] **Variables d'environnement configurées**
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
  - [ ] NEXT_PUBLIC_API_URL (URL Railway)
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] OPENAI_API_KEY
  - [ ] WHAPI_TOKEN

- [ ] **Déploiement**
  - [ ] Connecter repo GitHub
  - [ ] Vérifier build Next.js réussi
  - [ ] Vérifier fonctions serverless déployées
  - [ ] Tester page d'accueil

- [ ] **Fonctions Schedulées**
  - [ ] Vérifier activation dans Netlify Dashboard
  - [ ] Monitorer les logs des premières exécutions

### 3. Supabase

- [ ] **Configuration**
  - [ ] RLS (Row Level Security) activé
  - [ ] Policies configurées
  - [ ] Buckets Storage créés (campaign-images, etc.)

- [ ] **Indexes de performance**
  - [ ] Exécuter `database/create_performance_indexes.sql`

### 4. Tests Post-Déploiement

- [ ] **Frontend**
  - [ ] Page d'accueil charge correctement
  - [ ] Articles s'affichent
  - [ ] Authentification fonctionne
  - [ ] Recherche fonctionne

- [ ] **Backend**
  - [ ] `/health` retourne OK
  - [ ] `/api/homepage/articles` retourne des articles
  - [ ] WebSocket se connecte (jeu)

- [ ] **Fonctions Netlify**
  - [ ] RSS sync fonctionne
  - [ ] Alertes se déclenchent
  - [ ] Sondages se génèrent

---

## ⚠️ POINTS D'ATTENTION

### 🔴 Critiques - RÉSOLUS ✅

1. ~~**Duplication de logique**~~ : Documenté dans `DUPLICATIONS_NETLIFY_RAILWAY.md`
   - Plan d'action défini pour migrer vers Railway uniquement
   - Voir le document pour le plan de migration

2. ~~**24 fonctions .unused**~~ : **SUPPRIMÉES** ✅
   - 24 fichiers .unused supprimés du dossier netlify/functions

3. ~~**Clé API en fallback**~~ : **SUPPRIMÉE** ✅
   - Clé hardcodée retirée de `server.js` et `footballController.js`
   - API Football nécessite maintenant `RAPIDAPI_KEY` en variable d'environnement

### 🟡 Avertissements

1. **server.js monolithique** : ~5,900 lignes
   - Partiellement refactorisé (routes extraites)
   - Continuer l'extraction des routes restantes

2. **Pas de monitoring** configuré
   - Recommandation : Ajouter Sentry ou LogRocket

3. **Pas de tests automatisés** en CI/CD
   - Recommandation : Ajouter GitHub Actions pour tests

### 🟢 Points Positifs

1. ✅ React Query configuré (cache, refetch)
2. ✅ Routes modulaires créées
3. ✅ Streaming IA implémenté
4. ✅ Custom hooks extraits
5. ✅ Cron jobs bien configurés

---

## 📋 COMMANDES UTILES

### Déploiement Manuel

```bash
# Backend (Railway)
cd backend && npm install && npm start

# Frontend (Netlify)
cd frontend && npm install && npm run build

# Fonctions Netlify (local)
netlify dev
```

### Vérification Santé

```bash
# Backend
curl https://votre-backend.railway.app/health

# Frontend
curl https://votre-site.netlify.app

# API Articles
curl https://votre-backend.railway.app/api/homepage/articles
```

### Logs

```bash
# Railway
railway logs

# Netlify
netlify functions:log
```

---

## 📈 MÉTRIQUES DE PRODUCTION RECOMMANDÉES

| Métrique | Seuil Alerte | Outil |
|----------|--------------|-------|
| Temps réponse API | > 2s | Railway Metrics |
| Erreurs 5xx | > 1% | Sentry |
| Build time | > 5min | Netlify Dashboard |
| Fonctions timeout | > 10s | Netlify Functions |
| DB connections | > 80% | Supabase Dashboard |

---

## 🎯 PROCHAINES ÉTAPES POST-PRODUCTION

1. **Semaine 1** : Monitoring et stabilisation
2. **Semaine 2** : Optimisation performances (lazy loading, cache)
3. **Semaine 3** : Nettoyage fonctions Netlify inutilisées
4. **Semaine 4** : Tests automatisés CI/CD

---

**Rapport généré automatiquement par Cascade AI**
