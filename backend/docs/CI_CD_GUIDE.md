# 🚀 Guide CI/CD - Gabon 24/7

## Vue d'ensemble

Ce document décrit le système d'intégration continue et de déploiement continu (CI/CD) mis en place pour le projet Gabon 24/7.

## 📋 Table des matières

- [Architecture CI/CD](#architecture-cicd)
- [Workflows GitHub Actions](#workflows-github-actions)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [Monitoring](#monitoring)
- [Bonnes pratiques](#bonnes-pratiques)

---

## Architecture CI/CD

### Stack technologique

| Composant | Outil | Rôle |
|-----------|-------|------|
| **CI/CD Platform** | GitHub Actions | Orchestration des workflows |
| **Backend Hosting** | Railway | Hébergement API Node.js |
| **Frontend Hosting** | Netlify | Hébergement Next.js |
| **Tests** | Jest | Tests unitaires backend |
| **Linting** | ESLint | Qualité du code |
| **Security** | Trivy, npm audit | Scan de vulnérabilités |

### Flux de travail

```
┌─────────────┐
│   Commit    │
│   to main   │
└──────┬──────┘
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│   Tests &   │                    │    Code     │
│   Quality   │                    │   Quality   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │         ┌────────────────────────┘
       │         │
       ▼         ▼
┌─────────────────┐
│   Deployment    │
│  Backend + FE   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Health Checks  │
│   & Monitoring  │
└─────────────────┘
```

---

## Workflows GitHub Actions

### 1. 🧪 Tests & Quality (`ci-tests.yml`)

**Déclenchement:**
- Push sur `main` ou `develop`
- Pull Request vers `main` ou `develop`
- Manuel via `workflow_dispatch`

**Jobs:**

#### Backend Tests
- Tests sur Node.js 18.x et 20.x
- Exécution de Jest
- Upload de la couverture de code vers Codecov

```yaml
npm test
```

#### Frontend Tests & Build
- Lint avec ESLint
- Build Next.js
- Vérification de la compilation

```yaml
npm run lint
npm run build
```

#### Backend Linting
- ESLint sur le code backend
- Continue même en cas d'erreur (warnings)

#### Security Audit
- `npm audit` sur backend et frontend
- Niveau: moderate et supérieur
- Continue même en cas de vulnérabilités (alertes)

#### Dependency Review
- Analyse des dépendances sur PR
- Détecte les vulnérabilités connues

**Durée moyenne:** 8-12 minutes

---

### 2. 🚀 Deploy to Production (`ci-deploy.yml`)

**Déclenchement:**
- Push sur `main`
- Manuel via `workflow_dispatch`

**Jobs:**

#### Deploy Backend (Railway)
1. Checkout du code
2. Déploiement automatique Railway
3. Attente 30s pour stabilisation
4. Health check sur `/api/monitoring/health`

```bash
curl https://gabon24-7-production.up.railway.app/api/monitoring/health
```

#### Deploy Frontend (Netlify)
1. Checkout du code
2. Installation des dépendances
3. Build Next.js avec variables d'environnement
4. Déploiement automatique Netlify
5. Health check sur la page d'accueil

```bash
npm run build
curl https://gabon24-7.netlify.app
```

#### Post-Deployment Checks
- Vérification des endpoints critiques
- Résumé du déploiement avec URLs

**Durée moyenne:** 12-18 minutes

---

### 3. 🔍 Code Quality & Security (`ci-code-quality.yml`)

**Déclenchement:**
- Push sur `main` ou `develop`
- Pull Request
- Hebdomadaire (lundi 9h)
- Manuel

**Jobs:**

#### Code Quality Analysis
- Statistiques du code (nombre de fichiers, lignes)
- Analyse de la structure

#### Security Scanning
- Scan Trivy pour vulnérabilités
- Upload vers GitHub Security
- Niveaux: CRITICAL, HIGH

#### Dependency Updates Check
- `npm outdated` sur backend et frontend
- Liste des packages à mettre à jour

#### Performance Budget
- Analyse de la taille du bundle Next.js
- Top 10 des fichiers les plus lourds

#### Documentation Check
- Vérification présence README.md
- Vérification docs backend
- Vérification docs APM et Rate Limiting

**Durée moyenne:** 10-15 minutes

---

### 4. 🔎 Pull Request Checks (`ci-pr-checks.yml`)

**Déclenchement:**
- Ouverture de PR
- Synchronisation de PR
- Réouverture de PR

**Jobs:**

#### PR Title Validation
- Vérifie le format du titre
- Types acceptés: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Exemples valides:**
```
feat: Ajout du monitoring APM
fix: Correction du rate limiting
docs: Mise à jour du README
```

#### Changed Files Analysis
- Liste des fichiers modifiés
- Catégorisation (backend/frontend/workflows)

#### PR Size Check
- Nombre de fichiers modifiés
- Lignes ajoutées/supprimées
- Alertes si PR trop grande (>50 fichiers)

#### Run Tests
- Tests backend
- Build frontend

#### PR Summary Comment
- Commentaire automatique sur la PR
- Tableau récapitulatif des checks
- Alertes si problèmes détectés

**Durée moyenne:** 10-15 minutes

---

### 5. 🔄 Synchronisation Automatique (`sync-content.yml`)

**Déclenchement:**
- Cron: 3 fois par jour (6h, 13h, 21h WAT)
- Manuel

**Jobs:**
- Extraction Journal TV depuis RSS
- Génération résumés audio (FR, EN, ZH)
- Résumé de synchronisation

**Durée moyenne:** 5-10 minutes

---

## Configuration

### Secrets GitHub

Les secrets suivants doivent être configurés dans GitHub Settings > Secrets:

| Secret | Description | Utilisé par |
|--------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase | Frontend build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase | Frontend build |
| `CODECOV_TOKEN` | Token Codecov (optionnel) | Coverage upload |

### Variables d'environnement

#### Backend (Railway)
Configurées dans Railway Dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `REPLICATE_API_TOKEN`
- `SENDGRID_API_KEY`
- Etc.

#### Frontend (Netlify)
Configurées dans Netlify Dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Déploiement

### Déploiement automatique

**Main branch:**
1. Push vers `main`
2. Tests automatiques
3. Quality checks
4. Déploiement automatique (Railway + Netlify)
5. Health checks

**Pull Requests:**
1. Ouverture de PR
2. Tests automatiques
3. Checks de qualité
4. Preview deployment (Netlify uniquement)

### Déploiement manuel

#### Via GitHub Actions
```bash
# Aller sur GitHub > Actions
# Sélectionner "Deploy to Production"
# Cliquer "Run workflow"
```

#### Via Railway CLI
```bash
railway up
```

#### Via Netlify CLI
```bash
netlify deploy --prod
```

### Rollback

#### Backend (Railway)
```bash
# Via Railway Dashboard
# Deployments > Select previous deployment > Redeploy
```

#### Frontend (Netlify)
```bash
# Via Netlify Dashboard
# Deploys > Select previous deploy > Publish deploy
```

---

## Monitoring

### Logs de déploiement

**GitHub Actions:**
- Actions > Workflows > Sélectionner un run
- Voir les logs détaillés de chaque job

**Railway:**
- Dashboard > Deployments > Logs

**Netlify:**
- Dashboard > Deploys > Deploy log

### Health Checks

#### Backend
```bash
curl https://gabon24-7-production.up.railway.app/api/monitoring/health
```

**Réponse attendue:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": 1234567890,
    "metrics": {
      "uptime": 3600,
      "requestsTotal": 1000,
      "errorRate": "0.5%",
      "avgResponseTime": "120ms",
      "memoryUsage": "45%"
    }
  }
}
```

#### Frontend
```bash
curl https://gabon24-7.netlify.app
```

### Monitoring APM

Dashboard admin: https://gabon24-7.netlify.app/admin/monitoring

**Métriques disponibles:**
- Uptime
- Temps de réponse moyen
- Nombre de requêtes
- Taux d'erreur
- Utilisation mémoire
- Top endpoints
- Erreurs récentes
- Requêtes lentes

---

## Bonnes pratiques

### Commits

**Format recommandé:**
```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage, style
- `refactor`: Refactoring
- `perf`: Amélioration performance
- `test`: Ajout/modification tests
- `build`: Build system
- `ci`: CI/CD
- `chore`: Tâches diverses

**Exemples:**
```
feat(monitoring): Ajout du dashboard APM
fix(rate-limit): Correction des limites IA
docs(readme): Mise à jour installation
```

### Pull Requests

**Checklist:**
- [ ] Titre suit la convention
- [ ] Tests passent
- [ ] Lint passe
- [ ] Documentation mise à jour
- [ ] Taille raisonnable (<50 fichiers)
- [ ] Revue de code demandée

**Template PR:**
```markdown
## Description
Brève description des changements

## Type de changement
- [ ] Bug fix
- [ ] Nouvelle fonctionnalité
- [ ] Breaking change
- [ ] Documentation

## Tests
- [ ] Tests unitaires ajoutés/mis à jour
- [ ] Tests manuels effectués

## Checklist
- [ ] Code suit les conventions
- [ ] Documentation mise à jour
- [ ] Pas de warnings
```

### Tests

**Coverage minimum:**
- Backend: 60%
- Frontend: 40%

**Commandes:**
```bash
# Backend
cd backend
npm test
npm test -- --coverage

# Frontend
cd frontend
npm run lint
npm run build
```

### Sécurité

**Vérifications régulières:**
```bash
# Audit dépendances
npm audit

# Mise à jour sécurité
npm audit fix

# Scan Trivy (local)
trivy fs .
```

**Rotation des secrets:**
- Tous les 90 jours minimum
- Immédiatement si compromis

### Performance

**Optimisations:**
- Bundle size < 500KB (gzipped)
- Time to Interactive < 3s
- First Contentful Paint < 1.5s

**Monitoring:**
- Lighthouse CI (à venir)
- Web Vitals tracking
- APM dashboard

---

## Dépannage

### Tests échouent

```bash
# Vérifier les logs
# GitHub Actions > Failed job > Logs

# Reproduire localement
npm test

# Vérifier les dépendances
npm ci
```

### Déploiement échoue

**Backend (Railway):**
```bash
# Vérifier les logs Railway
# Vérifier les variables d'environnement
# Vérifier la santé de la DB
```

**Frontend (Netlify):**
```bash
# Vérifier les logs de build
# Vérifier les variables d'environnement
# Tester le build localement
npm run build
```

### Health check échoue

```bash
# Vérifier l'URL
curl -v https://gabon24-7-production.up.railway.app/api/monitoring/health

# Vérifier les logs
# Vérifier le monitoring APM
```

---

## Ressources

### Documentation
- [GitHub Actions](https://docs.github.com/en/actions)
- [Railway Docs](https://docs.railway.app/)
- [Netlify Docs](https://docs.netlify.com/)
- [Jest](https://jestjs.io/)

### Dashboards
- **GitHub Actions:** https://github.com/FranckSowax/gabon24-7/actions
- **Railway:** https://railway.app/
- **Netlify:** https://app.netlify.com/
- **Monitoring APM:** https://gabon24-7.netlify.app/admin/monitoring

### Support
- GitHub Issues: https://github.com/FranckSowax/gabon24-7/issues
- Railway Support: https://railway.app/help
- Netlify Support: https://www.netlify.com/support/

---

## Changelog

### Version 1.0.0 (2025-12-28)
- ✅ Configuration initiale CI/CD
- ✅ Workflow tests automatiques
- ✅ Workflow déploiement automatique
- ✅ Workflow qualité du code
- ✅ Workflow PR checks
- ✅ Integration monitoring APM
- ✅ Documentation complète

---

**Dernière mise à jour:** 28 décembre 2025  
**Mainteneur:** Gabon Insight Team
