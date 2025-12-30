# 🚀 Guide du Système IA Avancé - Gabon24/7

## Vue d'ensemble

Vous avez maintenant un **système complet de gestion IA** avec 4 fonctionnalités majeures :

1. ✅ **Messages d'erreur améliorés** - Interface utilisateur claire
2. 📧 **Alertes automatiques** - Email + Slack quand budget > 80%
3. 💾 **Cache intelligent** - Réutilise les analyses similaires
4. 📊 **Dashboard Analytics** - Visualisation en temps réel

---

## 📋 Table des Matières

- [Configuration](#configuration)
- [1. Messages d'Erreur Améliorés](#1-messages-derreur-améliorés)
- [2. Système d'Alertes](#2-système-dalertes)
- [3. Système de Cache](#3-système-de-cache)
- [4. Dashboard Analytics](#4-dashboard-analytics)
- [Tests](#tests)
- [Maintenance](#maintenance)

---

## ⚙️ Configuration

### Variables d'environnement

Ajoutez ces variables dans `/backend/.env` :

```bash
# Quota OpenAI
OPENAI_MONTHLY_BUDGET=100
OPENAI_HOURLY_LIMIT=100
OPENAI_DAILY_LIMIT=1000

# Alertes Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-mot-de-passe-app
ALERT_EMAIL_TO=admin@gabon24-7.com

# Alertes Slack (optionnel)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Configuration Gmail

Pour utiliser Gmail avec nodemailer :

1. Allez sur https://myaccount.google.com/security
2. Activez la **validation en deux étapes**
3. Générez un **mot de passe d'application**
4. Utilisez ce mot de passe dans `SMTP_PASS`

### Configuration Slack

Pour recevoir des alertes sur Slack :

1. Allez sur https://api.slack.com/apps
2. Créez une nouvelle app
3. Activez **Incoming Webhooks**
4. Copiez le Webhook URL dans `SLACK_WEBHOOK_URL`

---

## 1️⃣ Messages d'Erreur Améliorés

### Quoi de neuf ?

Au lieu de voir "Erreur lors de l'analyse", l'utilisateur voit maintenant :

#### Connexion requise
```
🔐 Connexion requise

Veuillez vous connecter pour utiliser l'analyse IA.
```

#### Crédits insuffisants
```
💰 Crédits insuffisants

Requis: 2 crédits
Disponible: 0 crédits

Rechargez votre compte pour continuer.
```

#### Budget OpenAI épuisé
```
⚠️ Service temporairement indisponible

Le budget IA est temporairement épuisé. 
Réessayez dans quelques heures.
```

#### Rate limit atteint
```
⚠️ Service temporairement indisponible

Limite horaire atteinte. 
Réessayez dans quelques minutes.
```

### Fichiers modifiés

- `/frontend/src/app/business/analyzer/page.tsx`

### Test

```bash
# Test avec un utilisateur sans crédits
# Vous verrez le message détaillé avec le nombre de crédits manquants
```

---

## 2️⃣ Système d'Alertes

### Quand les alertes sont envoyées

| Seuil | Type | Canaux | Cooldown |
|-------|------|--------|----------|
| 80% | Warning | Email + Slack | 1 heure |
| 90% | Critical | Email + Slack | 1 heure |
| 100% | Exhausted | Email + Slack | 1 heure |
| 10+ erreurs | Error | Email + Slack | 1 heure |

### Exemple d'email reçu

```
🚨 Alerte Gabon24/7 IA

⚠️ Budget IA à 85%

Le budget OpenAI mensuel atteint 85%. 
Surveillez la consommation pour éviter une interruption de service.

Détails:
• Budget total: $100
• Dépensé: $85.00
• Restant: $15.00
• Requêtes aujourd'hui: 450
• Requêtes restantes (estimées): 750

Action requise: Consultez le dashboard admin pour plus d'informations.
```

### Test des alertes

```bash
# Test email (depuis le backend)
curl -X POST http://localhost:3001/api/test-alert-email

# Test Slack
curl -X POST http://localhost:3001/api/test-alert-slack

# Simuler un seuil élevé pour déclencher une alerte
# (nécessite de faire des requêtes IA jusqu'à atteindre 80%)
```

### Fichiers créés

- `/backend/services/alert-service.js` - Service d'alertes
- `/backend/services/openai-quota-manager.js` - Modifié pour intégrer les alertes

---

## 3️⃣ Système de Cache

### Comment ça marche

1. **Avant chaque analyse**, le système vérifie si une analyse similaire existe
2. Si trouvée (≥ 85% similarité), **retourne le cache** sans appeler OpenAI
3. Si pas trouvée, fait l'analyse et **sauvegarde dans le cache**

### Avantages

✅ **Économies** : Pas de coût OpenAI pour les analyses similaires  
✅ **Rapidité** : Réponse instantanée depuis le cache  
✅ **Crédits** : Pas de déduction de crédits utilisateur  

### Exemple

```javascript
// Article 1
Titre: "Le gouvernement lance un appel d'offres pour la construction d'un port"

// Article 2 (similaire à 90%)
Titre: "Appel d'offres gouvernemental pour construction portuaire"

// Article 2 utilisera le cache de l'Article 1
// ✅ $0.015 économisé
// ✅ 2 crédits économisés
// ✅ Réponse en <100ms au lieu de 3-5s
```

### Statistiques du cache

```bash
# Voir les stats
curl http://localhost:3001/api/ai/admin/cache-stats

# Résultat
{
  "memory": {
    "size": 15,          # 15 analyses en cache mémoire
    "maxSize": 100
  },
  "database": {
    "totalEntries": 245,  # 245 analyses en cache DB
    "totalHits": 89,      # 89 réutilisations
    "topAnalyses": [...]
  }
}

# Économies calculées
# 89 hits × $0.015 = $1.34 économisé
# 89 hits × 2 crédits = 178 crédits économisés
```

### Nettoyer le cache ancien

```bash
# Supprimer les analyses de plus de 7 jours
curl -X POST http://localhost:3001/api/ai/admin/clean-cache \
  -H "Content-Type: application/json" \
  -d '{"daysOld": 7}'
```

### Fichiers créés

- `/backend/services/analysis-cache.js` - Système de cache
- `/backend/routes/opportunities.js` - Modifié pour utiliser le cache
- Table Supabase: `analysis_cache`

---

## 4️⃣ Dashboard Analytics

### Accès

Ouvrez : **http://localhost:3000/business/admin/ai-analytics**

### Fonctionnalités

#### Vue d'ensemble

- **Status général** : ok | warning | critical | exhausted
- **Barre de progression** : Budget utilisé / restant
- **Pourcentage** : % du budget mensuel consommé

#### Métriques en temps réel

- 💵 **Budget Restant** : $XX.XX + requêtes estimées restantes
- 📊 **Requêtes Aujourd'hui** : Total + cette heure
- 📈 **Total Requêtes** : Depuis le dernier reset
- ⚠️ **Erreurs Récentes** : Dans les 5 dernières minutes

#### Coûts par Service

Deux tableaux :
1. **Coûts OpenAI (USD)** : Prix réel par service
2. **Crédits Internes** : Coût utilisateur par service

#### Statistiques du Cache

- 📦 Analyses en cache
- ✨ Réutilisations (hits)
- 💾 Cache mémoire usage
- 💰 **Économies réalisées** :
  - Budget OpenAI économisé
  - Crédits internes économisés

#### Actions disponibles

- 🔄 **Actualiser** : Recharge les données
- 🔴 **Reset Quota** : Réinitialise le quota mensuel

### Auto-refresh

Le dashboard se rafraîchit automatiquement **toutes les 30 secondes**.

### Screenshots attendus

```
┌────────────────────────────────────┐
│  🤖 Analytics IA                   │
│  Status: OK (45% utilisé)          │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░            │
│  $45.00 / $100                     │
├────────────────────────────────────┤
│  📊 Métriques                      │
│  [Budget] [Requêtes] [Total] [Err] │
├────────────────────────────────────┤
│  💵 Coûts OpenAI                   │
│  analyze-opportunity: $0.015       │
│  action-plan: $0.035               │
│  ...                               │
├────────────────────────────────────┤
│  💾 Cache Stats                    │
│  245 analyses | 89 hits            │
│  💰 $1.34 économisé                │
└────────────────────────────────────┘
```

### Fichiers créés

- `/frontend/src/app/business/admin/ai-analytics/page.tsx`
- `/backend/routes/ai-monitoring.js` - Endpoints de monitoring

---

## 🧪 Tests

### 1. Test Messages d'Erreur

```bash
# Sur http://localhost:3000/business/analyzer

# Test 1: Sans connexion
# - Déconnectez-vous
# - Essayez d'analyser un article
# - Attendu: "🔐 Connexion requise"

# Test 2: Sans crédits
# - Connectez-vous
# - Videz vos crédits en base
# - Essayez d'analyser
# - Attendu: "💰 Crédits insuffisants\nRequis: 2\nDisponible: 0"

# Test 3: Rate limit (simulé)
# - Faites 100+ requêtes en 1 heure
# - Attendu: "Limite horaire atteinte"
```

### 2. Test Alertes

```bash
# Simuler un seuil à 80%
# (nécessite de dépenser 80% du budget)

# Vérifier les logs backend
tail -f /Volumes/Samsung_T5/gabon24-7-main/backend/logs/combined.log

# Vérifier votre email
# Vérifier Slack (si configuré)
```

### 3. Test Cache

```bash
# Analyser le même article 2 fois

# Première fois
curl -X POST http://localhost:3001/api/opportunities/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "votre-user-id",
    "article": {
      "title": "Test article",
      "summary": "Test summary",
      "content": "Test content"
    }
  }'

# Attendu: Appel OpenAI normal
# Log: "✅ Analyse opportunité terminée"
# Log: "💾 Analyse sauvegardée dans le cache DB"

# Deuxième fois (même article)
curl -X POST http://localhost:3001/api/opportunities/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "votre-user-id",
    "article": {
      "title": "Test article",
      "summary": "Test summary",
      "content": "Test content"
    }
  }'

# Attendu: Réponse du cache
# Log: "🎯 Cache HIT (database, exact)"
# Log: "✨ Analyse récupérée du cache - Coût économisé!"
# Réponse: { ..., "fromCache": true, "cacheSource": "database" }
```

### 4. Test Dashboard

```bash
# Ouvrir http://localhost:3000/business/admin/ai-analytics

# Vérifications:
# ✓ Status affiché correctement
# ✓ Barre de progression
# ✓ Métriques à jour
# ✓ Coûts affichés
# ✓ Stats du cache
# ✓ Bouton "Actualiser" fonctionne
# ✓ Auto-refresh toutes les 30s
```

---

## 🔧 Maintenance

### Tâches Quotidiennes

#### Consulter le Dashboard

```bash
# Ouvrir http://localhost:3000/business/admin/ai-analytics
# Vérifier:
# - Status: doit être "ok" ou "warning"
# - Budget restant > 20%
# - Erreurs récentes < 5
# - Cache fonctionne (hits > 0)
```

### Tâches Hebdomadaires

#### Nettoyer le Cache

```bash
curl -X POST http://localhost:3001/api/ai/admin/clean-cache \
  -H "Content-Type: application/json" \
  -d '{"daysOld": 7}'
```

#### Vérifier les Alertes

```bash
# Vérifier que les emails arrivent bien
# Vérifier que Slack fonctionne
# Ajuster les seuils si nécessaire
```

### Tâches Mensuelles

#### Reset Quota

```bash
# En début de mois
curl -X POST http://localhost:3001/api/ai/admin/reset-quota \
  -H "Content-Type: application/json" \
  -d '{"confirmReset": true}'

# Ou via le dashboard:
# http://localhost:3000/business/admin/ai-analytics
# Bouton "Reset Quota"
```

#### Analyse des Coûts

```bash
# Consulter le dashboard
# Noter:
# - Services les plus coûteux
# - Économies réalisées par le cache
# - Ajuster OPENAI_MONTHLY_BUDGET si nécessaire
```

---

## 📊 Métriques de Succès

### Objectifs

| Métrique | Objectif | Actuel |
|----------|----------|--------|
| Budget utilisé | < 95% | ? |
| Taux de cache | > 20% | ? |
| Erreurs/jour | < 10 | ? |
| Temps de réponse | < 5s | ? |

### Calcul du ROI du Cache

```
Requêtes en cache: 89
Coût par requête: $0.015
Économies: 89 × $0.015 = $1.34

Sur 1 mois avec 1000 analyses:
- 20% de cache = 200 analyses
- Économies = 200 × $0.015 = $3.00/mois
- Temps gagné = 200 × 4s = 800s = 13 min
```

---

## 🚨 Troubleshooting

### Alertes ne s'envoient pas

```bash
# Vérifier la configuration
echo $SMTP_USER
echo $ALERT_EMAIL_TO

# Tester l'envoi manuel
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transporter.sendMail({
  from: process.env.SMTP_USER,
  to: process.env.ALERT_EMAIL_TO,
  subject: 'Test',
  text: 'Test email'
}, console.log);
"
```

### Cache ne fonctionne pas

```bash
# Vérifier la table Supabase
# Via Supabase dashboard ou:

curl -X POST http://localhost:3001/api/ai/admin/cache-stats

# Si totalEntries = 0, vérifier:
# 1. Table analysis_cache existe
# 2. RLS activé
# 3. Service role key dans .env
```

### Dashboard ne charge pas

```bash
# Vérifier que le backend tourne
curl http://localhost:3001/api/ai/health

# Vérifier les logs
tail -f /Volumes/Samsung_T5/gabon24-7-main/backend/logs/combined.log

# Vérifier CORS
# Le frontend (port 3000) doit pouvoir appeler le backend (port 3001)
```

---

## 📚 Documentation Complète

Pour plus de détails techniques :

- `/backend/docs/AI_QUOTA_SYSTEM.md` - Architecture du système
- `/backend/services/openai-quota-manager.js` - Code du quota manager
- `/backend/services/alert-service.js` - Code des alertes
- `/backend/services/analysis-cache.js` - Code du cache

---

## 🎉 Conclusion

Vous avez maintenant un système IA **production-ready** avec :

✅ **Contrôle des coûts** - Budget et alertes  
✅ **Optimisation** - Cache intelligent  
✅ **Monitoring** - Dashboard en temps réel  
✅ **UX améliorée** - Messages clairs  

**Budget recommandé** : $100/mois pour ~6000 analyses (avec 20% de cache)

**Prochaines étapes** :
1. Configurer les alertes (Email/Slack)
2. Surveiller le dashboard quotidiennement
3. Analyser les métriques mensuellement
4. Ajuster le budget selon l'usage

Bon monitoring ! 🚀
