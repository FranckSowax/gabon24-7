# 📊 Guide du Monitoring APM - Gabon Insight Backend

## Vue d'ensemble

Le système de monitoring APM (Application Performance Monitoring) permet de surveiller les performances de l'application en temps réel sans dépendre de services externes comme New Relic ou Datadog.

## Architecture

```
backend/
├── utils/
│   └── performance-monitor.js      # Système de monitoring
├── routes/
│   └── monitoring.js               # API de consultation
└── server.js                       # Intégration middleware
```

## Fonctionnalités

### 📈 Métriques collectées

| Catégorie | Métriques |
|-----------|-----------|
| **Requêtes** | Total, succès, erreurs, taux de succès, req/min |
| **Performance** | Temps de réponse moyen, requêtes lentes |
| **Ressources** | Mémoire (heap, RSS), CPU, uptime |
| **Erreurs** | Total, par type, erreurs récentes |
| **Base de données** | Requêtes, requêtes lentes, erreurs |
| **Endpoints** | Top 10 les plus utilisés avec stats |

### 🔍 Détection automatique

- ✅ **Requêtes lentes** : > 1 seconde
- ✅ **Requêtes DB lentes** : > 500ms
- ✅ **Utilisation mémoire critique** : > 90%
- ✅ **Taux d'erreur élevé** : > 5%

## API Endpoints

### 1. GET `/api/monitoring/health`
**Vérification de santé de l'application**

**Accès :** Public (pas d'authentification requise)

**Réponse :**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": 1735408800000,
    "issues": [],
    "metrics": {
      "uptime": 3600,
      "requestsTotal": 15234,
      "errorRate": "2.34%",
      "avgResponseTime": "145ms",
      "memoryUsage": "65.23%"
    }
  }
}
```

**Status possibles :**
- `healthy` : Tout fonctionne normalement
- `degraded` : Problèmes détectés mais service opérationnel
- `error` : Erreur critique

---

### 2. GET `/api/monitoring/metrics`
**Toutes les métriques détaillées**

**Accès :** Admin uniquement

**Réponse :**
```json
{
  "success": true,
  "data": {
    "timestamp": 1735408800000,
    "uptime": 3600,
    "requests": {
      "total": 15234,
      "success": 14878,
      "errors": 356,
      "successRate": "97.66%",
      "requestsPerMinute": 254,
      "byStatusCode": {
        "200": 12345,
        "201": 2533,
        "400": 123,
        "401": 89,
        "404": 67,
        "500": 77
      },
      "topEndpoints": [
        {
          "endpoint": "GET /api/articles/:id",
          "count": 3456,
          "avgDuration": 145,
          "errorRate": "1.23%"
        }
      ]
    },
    "performance": {
      "averageResponseTime": 145,
      "slowRequestsCount": 23,
      "recentSlowRequests": [...]
    },
    "resources": {
      "memory": {
        "used": "256 MB",
        "total": "512 MB",
        "percentage": "50.00%"
      },
      "process": {
        "pid": 12345,
        "uptime": "60 minutes",
        "nodeVersion": "v18.17.0"
      }
    },
    "errors": {
      "total": 356,
      "byType": {
        "ValidationError": 123,
        "DatabaseError": 45,
        "AuthError": 89
      },
      "recent": [...]
    },
    "database": {
      "queries": 45678,
      "errors": 12,
      "slowQueries": [...]
    }
  }
}
```

---

### 3. GET `/api/monitoring/performance`
**Métriques de performance uniquement**

**Accès :** Admin uniquement

**Réponse :**
```json
{
  "success": true,
  "data": {
    "averageResponseTime": 145,
    "slowRequests": 23,
    "recentSlowRequests": [
      {
        "timestamp": 1735408800000,
        "duration": 1234,
        "endpoint": "POST /api/chat",
        "method": "POST",
        "url": "/api/chat",
        "userId": "user-123",
        "ip": "192.168.1.1"
      }
    ],
    "topEndpoints": [...]
  }
}
```

---

### 4. GET `/api/monitoring/errors`
**Erreurs récentes**

**Accès :** Admin uniquement

**Réponse :**
```json
{
  "success": true,
  "data": {
    "total": 356,
    "byType": {
      "ValidationError": 123,
      "DatabaseError": 45
    },
    "recent": [
      {
        "timestamp": 1735408800000,
        "type": "ValidationError",
        "message": "Invalid email format",
        "stack": "...",
        "context": {
          "userId": "user-123",
          "endpoint": "/api/auth/signup"
        }
      }
    ]
  }
}
```

---

### 5. GET `/api/monitoring/requests`
**Statistiques des requêtes**

**Accès :** Admin uniquement

---

### 6. GET `/api/monitoring/resources`
**Utilisation des ressources système**

**Accès :** Admin uniquement

---

### 7. GET `/api/monitoring/database`
**Statistiques base de données**

**Accès :** Admin uniquement

---

### 8. POST `/api/monitoring/reset`
**Réinitialiser toutes les métriques**

**Accès :** Admin uniquement

**Réponse :**
```json
{
  "success": true,
  "message": "Métriques réinitialisées avec succès"
}
```

---

## Utilisation dans le code

### Enregistrer une erreur

```javascript
const monitor = require('../utils/performance-monitor');

try {
  // Code qui peut échouer
  await someOperation();
} catch (error) {
  monitor.recordError(error, {
    userId: req.user?.id,
    endpoint: req.url,
    operation: 'someOperation'
  });
  throw error;
}
```

### Enregistrer une requête DB

```javascript
const monitor = require('../utils/performance-monitor');

const startTime = Date.now();
try {
  const result = await supabase
    .from('users')
    .select('*')
    .eq('id', userId);
  
  const duration = Date.now() - startTime;
  monitor.recordDatabaseQuery(duration, 'SELECT * FROM users WHERE id = ?');
  
  return result;
} catch (error) {
  const duration = Date.now() - startTime;
  monitor.recordDatabaseQuery(duration, 'SELECT * FROM users WHERE id = ?', error);
  throw error;
}
```

### Tracking automatique des requêtes

Le middleware est déjà configuré dans `server.js` :

```javascript
const monitor = require('./utils/performance-monitor');
app.use(monitor.trackRequest());
```

Toutes les requêtes HTTP sont automatiquement trackées.

---

## Dashboard de monitoring

### Créer un dashboard simple

```bash
# Obtenir les métriques en temps réel
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/monitoring/metrics

# Vérifier la santé
curl http://localhost:3001/api/monitoring/health
```

### Intégration avec des outils externes

Le système peut être intégré avec :

**Grafana :**
```javascript
// Exporter les métriques au format Prometheus
app.get('/metrics', (req, res) => {
  const metrics = monitor.getMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(`
    # HELP requests_total Total number of requests
    # TYPE requests_total counter
    requests_total ${metrics.requests.total}
    
    # HELP response_time_avg Average response time in ms
    # TYPE response_time_avg gauge
    response_time_avg ${metrics.performance.averageResponseTime}
  `);
});
```

**Sentry (pour les erreurs) :**
```javascript
const Sentry = require('@sentry/node');

monitor.recordError = (error, context) => {
  Sentry.captureException(error, { extra: context });
  // ... reste du code
};
```

---

## Alertes automatiques

### Configuration des alertes

```javascript
const monitor = require('./utils/performance-monitor');

// Vérifier la santé toutes les 5 minutes
setInterval(() => {
  const health = monitor.getHealthStatus();
  
  if (health.status !== 'healthy') {
    // Envoyer une alerte
    sendAdminAlert({
      severity: 'warning',
      message: 'Application en état dégradé',
      issues: health.issues
    });
  }
}, 5 * 60 * 1000);
```

### Alertes par email

```javascript
const { sendAdminAlert } = require('./services/emailService');

if (health.status === 'degraded') {
  await sendAdminAlert({
    subject: '⚠️ Application en état dégradé',
    issues: health.issues,
    metrics: health.metrics
  });
}
```

---

## Bonnes pratiques

### 1. ✅ Surveiller régulièrement
```bash
# Script de surveillance
while true; do
  curl -s http://localhost:3001/api/monitoring/health | jq '.data.status'
  sleep 60
done
```

### 2. ✅ Analyser les requêtes lentes
```javascript
const metrics = monitor.getMetrics();
const slowRequests = metrics.performance.recentSlowRequests;

slowRequests.forEach(req => {
  logger.logWarning('Requête lente à optimiser', {
    endpoint: req.endpoint,
    duration: req.duration
  });
});
```

### 3. ✅ Nettoyer les métriques anciennes
Le système nettoie automatiquement les métriques de plus de 60 minutes.

### 4. ✅ Exporter pour analyse
```javascript
const fs = require('fs');
const metrics = monitor.getMetrics();

fs.writeFileSync(
  `metrics-${Date.now()}.json`,
  JSON.stringify(metrics, null, 2)
);
```

---

## Comparaison avec New Relic/Datadog

| Feature | Notre système | New Relic | Datadog |
|---------|--------------|-----------|---------|
| **Coût** | Gratuit | $99+/mois | $15+/mois |
| **Setup** | Immédiat | Configuration | Configuration |
| **Métriques de base** | ✅ | ✅ | ✅ |
| **Alertes** | Manuel | ✅ Auto | ✅ Auto |
| **Dashboard** | API JSON | ✅ UI | ✅ UI |
| **Traces distribuées** | ❌ | ✅ | ✅ |
| **APM avancé** | ❌ | ✅ | ✅ |
| **Logs centralisés** | Winston | ✅ | ✅ |

**Notre système est idéal pour :**
- ✅ Démarrage rapide sans coûts
- ✅ Monitoring de base suffisant
- ✅ Pas de dépendances externes
- ✅ Contrôle total des données

**Migrer vers New Relic/Datadog si :**
- Besoin de traces distribuées
- Dashboard UI sophistiqué requis
- Alertes automatiques complexes
- Monitoring multi-services

---

## Troubleshooting

### Métriques ne s'affichent pas
```javascript
// Vérifier que le middleware est activé
const monitor = require('./utils/performance-monitor');
console.log('Requests total:', monitor.getMetrics().requests.total);
```

### Mémoire élevée
```javascript
// Réduire la rétention des métriques
monitor.config.metricsRetentionMinutes = 30; // 30 min au lieu de 60
```

### Trop de requêtes lentes
```javascript
// Augmenter le seuil
monitor.config.slowRequestThreshold = 2000; // 2 secondes
```

---

## Exemples d'utilisation

### Monitoring d'un service critique

```javascript
const monitor = require('../utils/performance-monitor');

async function processPayment(userId, amount) {
  const startTime = Date.now();
  
  try {
    // Traitement du paiement
    const result = await paymentGateway.charge(amount);
    
    // Enregistrer la durée
    const duration = Date.now() - startTime;
    if (duration > 3000) {
      logger.logWarning('Paiement lent', { userId, duration });
    }
    
    return result;
  } catch (error) {
    monitor.recordError(error, {
      context: 'payment',
      userId,
      amount
    });
    throw error;
  }
}
```

### Dashboard personnalisé

```javascript
router.get('/dashboard', requireAdmin, async (req, res) => {
  const metrics = monitor.getMetrics();
  const health = monitor.getHealthStatus();
  
  res.render('dashboard', {
    health,
    requests: metrics.requests,
    performance: metrics.performance,
    errors: metrics.errors
  });
});
```

---

**Dernière mise à jour :** 28 Décembre 2025
