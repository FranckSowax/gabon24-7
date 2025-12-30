# 🤖 Système Hybride de Gestion des Crédits IA

## Vue d'ensemble

Ce système combine **deux couches de validation** pour optimiser les coûts et améliorer l'expérience utilisateur :

1. **Crédits Internes** (Gabon24/7) - Limite l'accès utilisateur
2. **Quota OpenAI** (Budget externe) - Contrôle les dépenses réelles

---

## 🏗️ Architecture

```
┌─────────────────────┐
│  Requête Utilisateur │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Middleware: validateAIRequest()     │
├──────────────────────────────────────┤
│  1. Vérifie userId (connexion)       │
│  2. Vérifie crédits internes ✅      │
│  3. Vérifie quota OpenAI      ✅     │
│  4. Vérifie rate limiting     ✅     │
└──────────┬───────────────────────────┘
           │
     ┌─────┴──────┐
     │  Autorisé? │
     └─────┬──────┘
           │
    ┌──────┴───────┐
    │ OUI          │ NON
    ▼              ▼
┌────────────┐  ┌──────────────────┐
│ Exécuter IA│  │ Retourner erreur │
│ (OpenAI)   │  │ - insufficient_  │
└─────┬──────┘  │   credits        │
      │         │ - quota_exceeded │
      ▼         │ - rate_limit     │
┌────────────┐  └──────────────────┘
│  Succès ?  │
└─────┬──────┘
      │
┌─────┴──────┐
│ OUI        │ NON
▼            ▼
┌──────────────────┐  ┌─────────────────┐
│ 1. Déduire crédits│  │ Enregistrer     │
│ 2. Track OpenAI   │  │ erreur          │
│ 3. Retourner data │  │ quota manager   │
└───────────────────┘  └─────────────────┘
```

---

## 💰 Coûts par Service

### Coûts OpenAI (en USD)

| Service | Coût estimé | Modèle utilisé |
|---------|-------------|----------------|
| `analyze-opportunity` | $0.015 | GPT-4o |
| `generate-proposals` | $0.025 | GPT-4o |
| `skill-test` | $0.040 | GPT-4o |
| `action-plan` | $0.035 | GPT-4o |
| `custom-training` | $0.080 | GPT-4o |
| `business-plan` | $0.150 | GPT-4o |

### Coûts Crédits Internes

| Service | Crédits requis |
|---------|----------------|
| `analyze-opportunity` | 2 |
| `generate-proposals` | 5 |
| `skill-test` | 30 |
| `action-plan` | 25 |
| `custom-training` | 50 |
| `business-plan` | 100 |

---

## 🔧 Configuration

### Variables d'environnement (.env)

```bash
# Budget mensuel OpenAI en dollars
OPENAI_MONTHLY_BUDGET=100

# Limites de requêtes (rate limiting)
OPENAI_HOURLY_LIMIT=100
OPENAI_DAILY_LIMIT=1000
```

### Calcul du budget recommandé

```
Budget mensuel = Volume attendu × Coût moyen par requête × Marge de sécurité

Exemple:
- 1000 analyses/mois × $0.015 × 1.3 = $19.50/mois
- 500 plans d'action/mois × $0.035 × 1.3 = $22.75/mois
- 200 tests/mois × $0.040 × 1.3 = $10.40/mois

Total recommandé: ~$53/mois (on peut arrondir à $100 pour marge)
```

---

## 📊 Endpoints de Monitoring

### 1. Health Check (Public)

```http
GET /api/ai/health
```

**Réponse:**
```json
{
  "success": true,
  "status": "ok",
  "available": true,
  "message": "Service IA opérationnel",
  "details": {
    "percentageUsed": 45,
    "remainingBudget": 55.00,
    "estimatedRequestsLeft": 2500
  }
}
```

**Statuts possibles:**
- `ok` - Service opérationnel (< 80%)
- `warning` - Budget à 80-95%
- `critical` - Budget à 95-100%
- `exhausted` - Budget épuisé

### 2. Status Admin (Complet)

```http
GET /api/ai/admin/status
```

**Réponse:**
```json
{
  "success": true,
  "quota": {
    "status": "warning",
    "percentageUsed": 82.5,
    "totalSpent": 82.50,
    "remainingBudget": 17.50,
    "monthlyBudget": 100,
    "requestsToday": 234,
    "requestsThisHour": 12,
    "totalRequests": 5420,
    "estimatedRequestsLeft": 875,
    "recentErrorsCount": 2
  },
  "costs": {
    "openai": {...},
    "internal": {...}
  },
  "recommendations": [...]
}
```

### 3. Reset Quota (Admin)

```http
POST /api/ai/admin/reset-quota
Content-Type: application/json

{
  "confirmReset": true
}
```

⚠️ À utiliser en début de mois pour réinitialiser les compteurs.

### 4. Calculateur de Coûts

```http
GET /api/ai/admin/costs-calculator?service=analyze-opportunity&count=100
```

**Réponse:**
```json
{
  "success": true,
  "service": "analyze-opportunity",
  "count": 100,
  "costs": {
    "perRequest": {
      "openai": 0.015,
      "internal": 2
    },
    "total": {
      "openai": 1.50,
      "internal": 200
    }
  }
}
```

---

## 🚨 Gestion des Erreurs

### Codes d'erreur retournés

| Code | Raison | Message utilisateur | Action utilisateur |
|------|--------|---------------------|-------------------|
| 401 | `no_user_id` | Connexion requise | Se connecter |
| 402 | `insufficient_credits` | Crédits insuffisants | Recharger crédits |
| 503 | `quota_exceeded` | Service temporairement indisponible | Réessayer plus tard |
| 503 | `rate_limit_hour` | Limite horaire atteinte | Attendre 1 heure |
| 503 | `rate_limit_day` | Limite journalière atteinte | Réessayer demain |

### Exemple de gestion côté frontend

```typescript
try {
  const response = await fetch('/api/opportunities/analyze', {...});
  const data = await response.json();
  
  if (!response.ok) {
    if (data.requiresLogin) {
      // Rediriger vers /auth/signin
    } else if (data.requiresTopUp) {
      // Afficher modal de recharge
    } else if (data.isServiceIssue) {
      // Message: "Service temporairement saturé"
    }
  }
} catch (error) {
  // Erreur réseau
}
```

---

## 📈 Métriques et Monitoring

### Métriques collectées

1. **Quota OpenAI**
   - Budget dépensé
   - Pourcentage utilisé
   - Requêtes par jour/heure
   - Coût par service

2. **Crédits Internes**
   - Solde utilisateurs
   - Transactions
   - Services les plus utilisés

3. **Erreurs**
   - Erreurs quota OpenAI
   - Erreurs crédits insuffisants
   - Rate limiting déclenché

### Alertes recommandées

```javascript
// À implémenter dans un cron ou monitoring externe
const quotaStatus = await fetch('/api/ai/health').then(r => r.json());

if (quotaStatus.details.percentageUsed >= 90) {
  sendAdminAlert('🚨 Budget OpenAI critique: ' + quotaStatus.details.percentageUsed + '%');
}

if (quotaStatus.recentErrorsCount > 10) {
  sendAdminAlert('⚠️  Erreurs OpenAI détectées: ' + quotaStatus.recentErrorsCount);
}
```

---

## 🧪 Tests

### Test du système

```bash
# 1. Vérifier health
curl http://localhost:3001/api/ai/health

# 2. Test analyse (avec userId valide)
curl -X POST http://localhost:3001/api/opportunities/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "votre-user-id",
    "article": {
      "title": "Test",
      "summary": "Test summary"
    }
  }'

# 3. Vérifier status admin
curl http://localhost:3001/api/ai/admin/status
```

### Scénarios de test

1. ✅ Utilisateur avec crédits suffisants → Succès
2. ❌ Utilisateur sans crédits → 402 (insufficient_credits)
3. ❌ Budget OpenAI épuisé → 503 (quota_exceeded)
4. ❌ Rate limit dépassé → 503 (rate_limit)
5. ✅ Erreur OpenAI enregistrée → Circuit breaker activé

---

## 🔄 Maintenance

### Tâches mensuelles

1. **Début de mois:**
   ```bash
   curl -X POST http://localhost:3001/api/ai/admin/reset-quota \
     -H "Content-Type: application/json" \
     -d '{"confirmReset": true}'
   ```

2. **Analyse des coûts:**
   - Consulter `/api/ai/admin/status`
   - Ajuster `OPENAI_MONTHLY_BUDGET` si nécessaire

3. **Vérifier les métriques:**
   - Services les plus coûteux
   - Utilisateurs à forte consommation
   - Erreurs fréquentes

### Optimisations possibles

1. **Caching:** Mettre en cache les analyses similaires
2. **Modèles mixtes:** Utiliser GPT-3.5 pour certaines tâches
3. **Batch processing:** Grouper les requêtes similaires
4. **Queue system:** File d'attente pour lisser la charge

---

## 📚 Ressources

- [OpenAI Pricing](https://openai.com/pricing)
- [OpenAI Usage Dashboard](https://platform.openai.com/account/usage)
- [Documentation interne: Credits System](/docs/CREDITS_SYSTEM.md)

---

**Dernière mise à jour:** 4 octobre 2025  
**Version:** 1.0.0  
**Auteur:** Système Backend Gabon24/7
