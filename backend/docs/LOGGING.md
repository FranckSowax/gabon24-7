# 📊 Guide des Logs Structurés - Gabon Insight Backend

## Configuration Winston

Le projet utilise **Winston** pour les logs structurés avec rotation automatique des fichiers.

## Architecture

```
backend/
├── utils/
│   └── logger.js                   # Configuration Winston
├── middleware/
│   └── http-logger.js              # Middleware HTTP logging (Morgan)
└── logs/
    ├── combined.log                # Tous les logs
    └── error.log                   # Erreurs uniquement
```

## Utilisation

### Import du logger

```javascript
const logger = require('./utils/logger');
```

### Niveaux de log

```javascript
logger.error('Message d\'erreur');   // Erreurs critiques
logger.warn('Message d\'avertissement'); // Avertissements
logger.info('Message d\'information');   // Informations générales
logger.http('Requête HTTP');             // Logs HTTP
logger.debug('Message de debug');        // Debug détaillé
```

### Helpers pratiques

```javascript
// Log de succès avec emoji
logger.logSuccess('Campagne approuvée', { campaignId: '123' });
// ✅ Campagne approuvée { campaignId: '123' }

// Log d'avertissement avec emoji
logger.logWarning('Crédits faibles', { userId: 'user-123', balance: 5 });
// ⚠️ Crédits faibles { userId: 'user-123', balance: 5 }

// Log d'erreur avec stack trace
logger.logError(error, { context: 'payment', userId: 'user-123' });
// ❌ Error message + stack trace

// Log de debug
logger.logDebug('Vérification des crédits', { required: 10, balance: 100 });
// 🔍 Vérification des crédits { required: 10, balance: 100 }

// Log de requête HTTP
logger.logRequest(req, 'POST /api/campaigns');
// Logs: method, url, ip, userAgent, userId
```

## Middleware HTTP Logging

### Configuration dans server.js

```javascript
const httpLogger = require('./middleware/http-logger');

// Ajouter le middleware
app.use(httpLogger);
```

### Format des logs HTTP

```
✅ POST /api/campaigns 201 45ms - user-123
⚠️ GET /api/credits 402 12ms - user-456
❌ POST /api/payments 500 234ms - anonymous
```

## Configuration

### Variables d'environnement

```bash
# Niveau de log (error, warn, info, http, debug)
LOG_LEVEL=info

# En production
NODE_ENV=production
LOG_LEVEL=warn
```

### Rotation des fichiers

Les logs sont automatiquement archivés :
- **Taille max par fichier :** 5 MB
- **Nombre de fichiers :** 5 (rotation)
- **Fichiers anciens :** Supprimés automatiquement

## Exemples d'utilisation

### Dans un service

```javascript
const logger = require('../utils/logger');

async function sendEmail(userEmail, subject) {
  try {
    logger.info('Envoi d\'email', { to: userEmail, subject });
    
    await sgMail.send({ to: userEmail, subject, html });
    
    logger.logSuccess('Email envoyé', { to: userEmail });
    return { success: true };
  } catch (error) {
    logger.logError(error, { 
      context: 'sendEmail', 
      userEmail, 
      subject 
    });
    return { success: false, error: error.message };
  }
}
```

### Dans une route

```javascript
const logger = require('../utils/logger');

router.post('/campaigns', requireAuth, async (req, res) => {
  logger.logRequest(req, 'Création de campagne');
  
  try {
    const campaign = await createCampaign(req.body);
    
    logger.logSuccess('Campagne créée', { 
      campaignId: campaign.id,
      userId: req.user.id 
    });
    
    res.json({ success: true, campaign });
  } catch (error) {
    logger.logError(error, { 
      context: 'createCampaign',
      userId: req.user.id,
      body: req.body
    });
    
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
```

### Dans un middleware

```javascript
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.logError(err, {
    method: req.method,
    url: req.url,
    userId: req.user?.id,
    body: req.body
  });
  
  res.status(500).json({ error: 'Erreur serveur' });
}
```

## Format des logs

### Console (développement)

```
2025-12-28 17:00:00 [info]: ✅ Campagne créée
2025-12-28 17:00:01 [warn]: ⚠️ Crédits faibles
2025-12-28 17:00:02 [error]: ❌ Erreur SendGrid
  at sendEmail (emailService.js:45)
  at async POST /api/campaigns
```

### Fichiers (production)

```json
{
  "level": "info",
  "message": "✅ Campagne créée",
  "timestamp": "2025-12-28 17:00:00",
  "campaignId": "123",
  "userId": "user-456"
}
```

## Bonnes pratiques

### 1. Contexte riche
```javascript
// ❌ Mauvais
logger.info('Erreur');

// ✅ Bon
logger.logError(error, {
  context: 'payment',
  userId: 'user-123',
  amount: 100,
  paymentMethod: 'mypvit'
});
```

### 2. Niveaux appropriés
- **error** : Erreurs nécessitant une action immédiate
- **warn** : Situations anormales mais gérables
- **info** : Événements importants (création, modification)
- **http** : Requêtes HTTP (automatique via middleware)
- **debug** : Informations de débogage détaillées

### 3. Données sensibles
```javascript
// ❌ Ne jamais logger
logger.info('Login', { password: 'secret123' });

// ✅ Logger uniquement les infos non sensibles
logger.info('Login', { email: 'user@example.com' });
```

### 4. Performance
```javascript
// ❌ Éviter les logs dans les boucles
for (let i = 0; i < 10000; i++) {
  logger.debug('Iteration', { i });
}

// ✅ Logger le résumé
logger.debug('Traitement terminé', { iterations: 10000 });
```

## Migration depuis console.log

### Avant
```javascript
console.log('✅ Campagne approuvée:', campaignId);
console.error('❌ Erreur:', error);
console.warn('⚠️ Crédits faibles');
```

### Après
```javascript
logger.logSuccess('Campagne approuvée', { campaignId });
logger.logError(error, { context: 'approveCampaign' });
logger.logWarning('Crédits faibles', { userId, balance });
```

## Monitoring

### Visualiser les logs en temps réel

```bash
# Tous les logs
tail -f logs/combined.log

# Erreurs uniquement
tail -f logs/error.log

# Avec filtrage
tail -f logs/combined.log | grep ERROR
```

### Analyse des logs

```bash
# Compter les erreurs
grep -c "error" logs/combined.log

# Trouver les erreurs d'un utilisateur
grep "user-123" logs/error.log

# Logs des dernières 24h
find logs/ -name "*.log" -mtime -1
```

## Intégration future

Le système de logs est prêt pour :
- **Sentry** : Monitoring d'erreurs en temps réel
- **Datadog** : APM et analytics
- **CloudWatch** : Logs AWS
- **Elasticsearch** : Recherche et analyse avancée

---

**Dernière mise à jour :** 28 Décembre 2025
