# 🛡️ Guide du Rate Limiting Granulaire - Gabon Insight Backend

## Vue d'ensemble

Le système de rate limiting protège l'API contre les abus et assure une distribution équitable des ressources. Chaque type d'endpoint dispose de limites adaptées à son usage.

## Architecture

```
backend/
├── middleware/
│   └── rate-limiter.js         # Configuration des limiteurs
└── server.js                   # Application des limiteurs
```

## Limiteurs configurés

### 1. 🌐 Limiteur Général (`generalLimiter`)
**Usage :** Toutes les routes API par défaut

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 15 minutes |
| **Maximum** | 1000 requêtes |
| **Clé** | Adresse IP |
| **Code HTTP** | 429 |

```javascript
app.use('/api/', generalLimiter);
```

---

### 2. 🤖 Limiteur IA (`aiLimiter`)
**Usage :** Endpoints utilisant l'IA (GPT, analyse, chat)

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 15 minutes |
| **Maximum** | 50 requêtes |
| **Clé** | User ID (si auth) ou IP |
| **Code HTTP** | 429 |

**Endpoints concernés :**
- `/api/generate`
- `/api/analyze`
- `/api/chat`
- `/api/project-chat`

```javascript
app.use('/api/chat', aiLimiter);
```

**Pourquoi 50 ?** Les requêtes IA sont coûteuses en ressources et crédits.

---

### 3. 🔐 Limiteur Authentification (`authLimiter`)
**Usage :** Login, signup, reset password

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 15 minutes |
| **Maximum** | 10 tentatives |
| **Clé** | Adresse IP |
| **Code HTTP** | 429 |
| **Skip success** | ✅ Oui |

```javascript
app.use('/api/auth', authLimiter);
```

**Sécurité :** Ne compte que les échecs pour éviter le brute force.

---

### 4. 💳 Limiteur Paiements (`paymentLimiter`)
**Usage :** Transactions, achats de crédits

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 1 heure |
| **Maximum** | 20 requêtes |
| **Clé** | User ID ou IP |
| **Code HTTP** | 429 |

**Endpoints concernés :**
- `/api/payments`
- `/api/credits-premium`

```javascript
app.use('/api/payments', paymentLimiter);
```

---

### 5. 📤 Limiteur Uploads (`uploadLimiter`)
**Usage :** Upload de fichiers, images, documents

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 1 heure |
| **Maximum** | 30 uploads |
| **Clé** | User ID ou IP |
| **Code HTTP** | 429 |

```javascript
app.use('/api/upload', uploadLimiter);
```

---

### 6. 📢 Limiteur Campagnes (`campaignCreationLimiter`)
**Usage :** Création de campagnes publicitaires

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 24 heures |
| **Maximum** | 10 campagnes |
| **Clé** | User ID ou IP |
| **Code HTTP** | 429 |

```javascript
app.use('/api/campaigns/create', campaignCreationLimiter);
```

**Pourquoi 10/jour ?** Évite le spam et les campagnes abusives.

---

### 7. 🔍 Limiteur Recherche (`searchLimiter`)
**Usage :** Recherche dans l'application

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 1 heure |
| **Maximum** | 200 requêtes |
| **Clé** | User ID ou IP |
| **Code HTTP** | 429 |

```javascript
app.use('/api/search', searchLimiter);
```

---

### 8. 📖 Limiteur Public (`publicReadLimiter`)
**Usage :** Endpoints publics en lecture seule

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 15 minutes |
| **Maximum** | 500 requêtes |
| **Clé** | Adresse IP |
| **Code HTTP** | 429 |

**Usage :**
```javascript
router.get('/public/articles', publicReadLimiter, (req, res) => {
  // ...
});
```

---

### 9. 🪝 Limiteur Webhooks (`webhookLimiter`)
**Usage :** Webhooks externes (Stripe, SendGrid, etc.)

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 1 minute |
| **Maximum** | 100 requêtes |
| **Clé** | Signature webhook ou IP |
| **Code HTTP** | 429 |

```javascript
app.use('/api/webhooks', webhookLimiter);
```

**Pourquoi 100/min ?** Gérer les pics de webhooks légitimes.

---

### 10. 📧 Limiteur Emails (`emailLimiter`)
**Usage :** Envoi d'emails, invitations

| Paramètre | Valeur |
|-----------|--------|
| **Fenêtre** | 1 heure |
| **Maximum** | 10 emails |
| **Clé** | User ID ou IP |
| **Code HTTP** | 429 |

**Usage dans les routes :**
```javascript
const { emailLimiter } = require('../middleware/rate-limiter');

router.post('/send-invitation', requireAuth, emailLimiter, async (req, res) => {
  // ...
});
```

---

## Utilisation dans les routes

### Import du limiteur
```javascript
const { aiLimiter, paymentLimiter } = require('../middleware/rate-limiter');
```

### Application à une route spécifique
```javascript
router.post('/expensive-operation', requireAuth, aiLimiter, async (req, res) => {
  // Cette route est limitée à 50 req/15min par utilisateur
});
```

### Application à un groupe de routes
```javascript
const router = express.Router();

// Appliquer à toutes les routes du router
router.use(aiLimiter);

router.post('/analyze', async (req, res) => { /* ... */ });
router.post('/generate', async (req, res) => { /* ... */ });
```

---

## Réponse en cas de dépassement

### Format de la réponse
```json
{
  "success": false,
  "error": "Limite de requêtes IA atteinte. Veuillez patienter.",
  "retryAfter": "15 minutes"
}
```

### Headers HTTP
```
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 50
RateLimit-Remaining: 0
RateLimit-Reset: 1735408800
Retry-After: 900
```

---

## Logging

Tous les dépassements de limite sont automatiquement loggés :

```javascript
logger.logWarning('Rate limit dépassé - IA', {
  ip: '192.168.1.1',
  userId: 'user-123',
  endpoint: '/api/chat'
});
```

**Fichier de log :** `logs/combined.log`

---

## Configuration avancée

### Personnaliser un limiteur

```javascript
const customLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 100,
  keyGenerator: (req) => {
    // Limiter par user + endpoint
    return `${req.user?.id || req.ip}:${req.path}`;
  },
  handler: (req, res) => {
    logger.logWarning('Rate limit custom dépassé', {
      userId: req.user?.id,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Limite personnalisée atteinte'
    });
  }
});
```

### Exclure certaines requêtes

```javascript
const limiter = rateLimit({
  // ...
  skip: (req) => {
    // Ne pas limiter les admins
    return req.user?.isAdmin === true;
  }
});
```

### Limiter uniquement les échecs

```javascript
const authLimiter = rateLimit({
  // ...
  skipSuccessfulRequests: true // Ne compte que les 4xx/5xx
});
```

---

## Monitoring

### Vérifier les limites atteintes

```bash
# Voir les logs de rate limiting
grep "Rate limit dépassé" logs/combined.log

# Compter par type
grep "Rate limit dépassé - IA" logs/combined.log | wc -l
grep "Rate limit dépassé - Auth" logs/combined.log | wc -l
```

### Analyser les IPs bloquées

```bash
# Top 10 des IPs bloquées
grep "Rate limit dépassé" logs/combined.log | \
  grep -oP 'ip: \K[0-9.]+' | \
  sort | uniq -c | sort -rn | head -10
```

---

## Bonnes pratiques

### 1. ✅ Adapter les limites à l'usage
```javascript
// ❌ Mauvais : Même limite partout
app.use(generalLimiter);

// ✅ Bon : Limites adaptées
app.use('/api/chat', aiLimiter);        // Coûteux
app.use('/api/articles', publicReadLimiter); // Léger
```

### 2. ✅ Limiter par utilisateur pour les actions sensibles
```javascript
keyGenerator: (req) => req.user?.id || req.ip
```

### 3. ✅ Logger les dépassements
```javascript
handler: (req, res) => {
  logger.logWarning('Rate limit dépassé', { userId, endpoint });
  res.status(429).json({ error: 'Trop de requêtes' });
}
```

### 4. ✅ Informer l'utilisateur
```javascript
message: {
  success: false,
  error: 'Limite atteinte. Veuillez patienter.',
  retryAfter: '15 minutes'
}
```

---

## Tableau récapitulatif

| Limiteur | Fenêtre | Max | Clé | Usage |
|----------|---------|-----|-----|-------|
| General | 15 min | 1000 | IP | Toutes les API |
| IA | 15 min | 50 | User/IP | GPT, analyse, chat |
| Auth | 15 min | 10 | IP | Login, signup |
| Payment | 1h | 20 | User/IP | Transactions |
| Upload | 1h | 30 | User/IP | Fichiers |
| Campaign | 24h | 10 | User/IP | Création campagnes |
| Search | 1h | 200 | User/IP | Recherche |
| Public | 15 min | 500 | IP | Lecture publique |
| Webhook | 1 min | 100 | Signature/IP | Webhooks |
| Email | 1h | 10 | User/IP | Envoi emails |

---

## Migration depuis l'ancien système

### Avant
```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use('/api/', apiLimiter);
```

### Après
```javascript
const { generalLimiter, aiLimiter, authLimiter } = require('./middleware/rate-limiter');

app.use('/api/', generalLimiter);
app.use('/api/chat', aiLimiter);
app.use('/api/auth', authLimiter);
```

---

**Dernière mise à jour :** 28 Décembre 2025
