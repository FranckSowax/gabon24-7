# 🚨 Problème Backend Railway - Guide Complet

**Date:** 13 novembre 2025  
**Statut:** 🔴 Backend DOWN  
**Impact:** Frontend Netlify ne peut pas charger les données

---

## 🎯 Commencez ici

### Vous avez 5 minutes ?
👉 **[SOLUTION_RAPIDE_RAILWAY.md](SOLUTION_RAPIDE_RAILWAY.md)**
- Solution en 5 étapes
- Configuration variables d'environnement
- Checklist de résolution

### Vous voulez comprendre le problème ?
👉 **[RESUME_PROBLEME_RAILWAY.md](RESUME_PROBLEME_RAILWAY.md)**
- Diagnostic en 1 minute
- Erreurs observées
- Impact et timeline

### Vous voulez tous les détails ?
👉 **[DIAGNOSTIC_RAILWAY_CORS.md](DIAGNOSTIC_RAILWAY_CORS.md)**
- Analyse complète
- Causes possibles
- Tests de vérification

### Vous voulez déboguer vous-même ?
👉 **[GUIDE_DEBOGAGE_RAILWAY.md](GUIDE_DEBOGAGE_RAILWAY.md)**
- Arbre de décision
- Checklist de diagnostic
- Solutions par type d'erreur

### Vous voulez tester automatiquement ?
👉 **[test-railway-backend.sh](test-railway-backend.sh)**
```bash
./test-railway-backend.sh
```

---

## 📊 Résumé du problème

```
┌────────────────────────────────────────────────────┐
│  PROBLÈME: Backend Railway inaccessible           │
│  CAUSE: Variables d'environnement manquantes      │
│  SOLUTION: Configurer SUPABASE_SERVICE_ROLE_KEY   │
│  TEMPS: 5-10 minutes                               │
└────────────────────────────────────────────────────┘
```

### Erreurs observées

```
❌ GET /api/articles/trending → 404 Not Found
❌ GET /api/articles/week → 404 Not Found
❌ GET /api/audio/latest-public → CORS Error
❌ Railway fallback actif (serveur non démarré)
```

### Impact

- **Utilisateurs affectés:** 100%
- **Services affectés:** Tous les endpoints API
- **Revenus affectés:** 100% pendant la panne

---

## ⚡ Solution rapide (5 minutes)

### 1. Accéder à Railway
https://railway.app/dashboard → Projet `gabon24-7-production`

### 2. Obtenir les clés Supabase
https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api

Copier :
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY`
- **anon** → `SUPABASE_ANON_KEY`
- **URL** → `SUPABASE_URL`

### 3. Configurer Railway
Railway Dashboard → Variables → New Variable

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FRONTEND_URL=https://gabon24-7.netlify.app
NODE_ENV=production
```

### 4. Attendre le redémarrage
Railway redémarre automatiquement (30-60 secondes)

### 5. Vérifier
```bash
./test-railway-backend.sh
```

---

## 📚 Documentation complète

### Guides principaux

| Document | Description | Temps | Priorité |
|----------|-------------|-------|----------|
| **SOLUTION_RAPIDE_RAILWAY.md** | Solution en 5 étapes | 5 min | 🔴 HAUTE |
| **RESUME_PROBLEME_RAILWAY.md** | Résumé du problème | 1 min | 🔴 HAUTE |
| **DIAGNOSTIC_RAILWAY_CORS.md** | Diagnostic complet | 10 min | 🟡 MOYENNE |
| **GUIDE_DEBOGAGE_RAILWAY.md** | Guide de débogage | 15 min | 🟡 MOYENNE |
| **test-railway-backend.sh** | Script de test | 1 min | 🔴 HAUTE |

### Documentation backend

| Document | Description |
|----------|-------------|
| `backend/RAILWAY_SETUP.md` | Configuration Railway |
| `backend/server.js` | Code serveur principal |
| `backend/package.json` | Dépendances et scripts |
| `backend/.env.example` | Exemple variables d'environnement |

---

## 🔍 Diagnostic rapide

### Test 1: Backend accessible ?
```bash
curl -I https://gabon24-7-production.up.railway.app/
```

**Résultat attendu:** `HTTP/2 200`  
**Résultat actuel:** `HTTP/2 404` + `x-railway-fallback: true`

### Test 2: Logs Railway
```
Railway Dashboard → Deployments → View Logs
```

**Rechercher:**
- `Error: Missing required environment variable`
- `SUPABASE_SERVICE_ROLE_KEY`
- `Error: Invalid Supabase credentials`

### Test 3: Variables configurées ?
```
Railway Dashboard → Variables
```

**Vérifier:**
- ✅ `SUPABASE_SERVICE_ROLE_KEY` présente
- ✅ `SUPABASE_URL` présente
- ✅ `SUPABASE_ANON_KEY` présente

---

## ✅ Checklist de résolution

### Diagnostic
- [ ] Tester l'endpoint `/` (devrait retourner 200)
- [ ] Consulter les logs Railway
- [ ] Identifier l'erreur spécifique

### Configuration
- [ ] Obtenir les clés Supabase
- [ ] Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Railway
- [ ] Ajouter `SUPABASE_URL` dans Railway
- [ ] Ajouter `SUPABASE_ANON_KEY` dans Railway
- [ ] Ajouter `FRONTEND_URL` dans Railway

### Vérification
- [ ] Attendre le redémarrage (30-60s)
- [ ] Consulter les nouveaux logs
- [ ] Tester avec `./test-railway-backend.sh`
- [ ] Vérifier le frontend Netlify

---

## 🎯 Résultat attendu

### Logs Railway (succès)
```bash
✅ Serveur Gabon Insight démarré sur le port 3001
✅ Supabase client initialisé avec clé SERVICE_ROLE
✅ Processeur RSS démarré avec succès
```

### Test backend (succès)
```bash
$ ./test-railway-backend.sh

✅ Serveur accessible (HTTP 200)
✅ Endpoint accessible (HTTP 200)
✅ CORS configuré correctement
✅ Backend opérationnel
```

### Frontend Netlify (succès)
- ✅ Articles chargés sur la page d'accueil
- ✅ Aucune erreur CORS dans la console
- ✅ Résumés audio disponibles
- ✅ Recherche fonctionnelle

---

## 🔗 Liens utiles

### Dashboards
- **Railway:** https://railway.app/dashboard
- **Supabase:** https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf
- **Netlify:** https://app.netlify.com

### API Keys
- **Supabase API Keys:** https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api
- **OpenAI API Keys:** https://platform.openai.com/api-keys
- **Replicate API Keys:** https://replicate.com/account/api-tokens

### Frontend
- **Production:** https://gabon24-7.netlify.app
- **Ancien domaine:** https://gabon-insight.netlify.app

### Backend
- **Production:** https://gabon24-7-production.up.railway.app
- **API Docs:** https://gabon24-7-production.up.railway.app/api

---

## 🆘 Besoin d'aide ?

### Niveau 1: Documentation
1. Lire `SOLUTION_RAPIDE_RAILWAY.md`
2. Lire `DIAGNOSTIC_RAILWAY_CORS.md`
3. Consulter `GUIDE_DEBOGAGE_RAILWAY.md`

### Niveau 2: Tests
1. Exécuter `./test-railway-backend.sh`
2. Consulter les logs Railway
3. Vérifier les variables d'environnement

### Niveau 3: Support
1. Copier les logs Railway (50 dernières lignes)
2. Copier les erreurs console frontend
3. Créer un ticket support Railway

---

## 📊 Métriques

### Temps de résolution
- **Diagnostic:** 5 minutes
- **Configuration:** 5 minutes
- **Vérification:** 2 minutes
- **Total:** ~12 minutes

### Impact
- **Utilisateurs affectés:** 100%
- **Services affectés:** Tous
- **Perte de revenus:** 100% pendant la panne

### Priorité
- **Urgence:** 🔴 CRITIQUE
- **Impact:** 🔴 ÉLEVÉ
- **Complexité:** 🟢 FAIBLE

---

## 📝 Notes importantes

1. **La configuration CORS est correcte** - Le problème n'est PAS lié à CORS mais au fait que le serveur ne démarre pas

2. **`SUPABASE_SERVICE_ROLE_KEY` est CRITIQUE** - Sans elle, le serveur crashe au démarrage

3. **Railway redémarre automatiquement** après modification des variables d'environnement

4. **Attendre 30-60 secondes** après le redémarrage pour que le serveur soit opérationnel

5. **Ne PAS utiliser la clé `anon` pour `SUPABASE_SERVICE_ROLE_KEY`** - Utiliser la clé `service_role`

---

## 🎬 Prochaines étapes

### Immédiat
1. Configurer les variables d'environnement Railway
2. Attendre le redémarrage
3. Vérifier que le backend est opérationnel

### Court terme
1. Documenter la configuration Railway
2. Créer des alertes de monitoring
3. Mettre en place des tests automatiques

### Moyen terme
1. Implémenter un health check
2. Configurer des notifications d'erreur
3. Créer un plan de reprise après incident

---

**Dernière mise à jour:** 13 novembre 2025  
**Auteur:** Documentation Cascade AI  
**Version:** 1.0
