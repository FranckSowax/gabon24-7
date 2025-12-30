# 🧪 Guide des Tests - Gabon Insight Backend

## Configuration Jest

Le projet utilise **Jest** pour les tests unitaires et d'intégration.

### Structure des tests

```
backend/
├── tests/
│   ├── setup.js                    # Configuration globale
│   ├── services/                   # Tests des services
│   │   ├── emailService.test.js
│   │   └── credit-manager-premium.test.js
│   └── middleware/                 # Tests des middlewares
│       └── auth.test.js
├── jest.config.js                  # Configuration Jest
└── .env.test                       # Variables d'environnement pour tests
```

## Commandes

```bash
# Exécuter tous les tests
npm test

# Exécuter les tests en mode watch
npm run test:watch

# Exécuter les tests avec couverture
npm test -- --coverage

# Exécuter un fichier de test spécifique
npm test -- emailService.test.js
```

## Configuration Jest (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  }
};
```

## Écrire des tests

### Exemple : Test d'un service

```javascript
const emailService = require('../../services/emailService');
const sgMail = require('@sendgrid/mail');

jest.mock('@sendgrid/mail');

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('devrait envoyer un email avec succès', async () => {
    sgMail.send.mockResolvedValue([{ statusCode: 202 }]);

    const result = await emailService.sendCampaignApprovalNotification({
      userEmail: 'user@example.com',
      userName: 'John Doe',
      campaignTitle: 'Test Campaign',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      campaignUrl: 'https://example.com/campaign/123'
    });

    expect(result.success).toBe(true);
    expect(sgMail.send).toHaveBeenCalledTimes(1);
  });
});
```

### Exemple : Test d'un middleware

```javascript
const { requireAuth } = require('../../middleware/auth');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {}, user: null };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('devrait rejeter sans token', async () => {
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

## Bonnes pratiques

### 1. Isolation des tests
- Utiliser `beforeEach` pour réinitialiser l'état
- Mocker les dépendances externes (Supabase, SendGrid, etc.)
- Ne pas dépendre de l'ordre d'exécution

### 2. Nomenclature
- Fichiers : `*.test.js` ou `*.spec.js`
- Describe : Nom du module/fonction
- It : Comportement attendu en français

### 3. Couverture
- Viser minimum 50% de couverture
- Tester les cas normaux ET les cas d'erreur
- Tester les edge cases

### 4. Mocking
```javascript
// Mock d'un module entier
jest.mock('@sendgrid/mail');

// Mock d'une fonction spécifique
const mockFunction = jest.fn().mockResolvedValue({ success: true });

// Mock de Supabase
jest.mock('../supabase-config', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn()
  }
}));
```

## Tests existants

### ✅ Services testés
- `emailService.js` - Envoi d'emails via SendGrid
- `credit-manager-premium.js` - Gestion des crédits utilisateur

### ✅ Middleware testés
- `auth.js` - Authentification JWT

### 📝 À tester (TODO)
- Routes API (`routes/*.js`)
- Services IA (`services/gpt5-nano-analyzer.js`)
- Services de paiement (`services/payment.service.js`)

## CI/CD

Les tests sont exécutés automatiquement :
- Sur chaque push
- Sur chaque pull request
- Avant chaque déploiement

## Dépannage

### Erreur : "Cannot find module"
```bash
npm install
```

### Timeout sur les tests
Augmenter le timeout dans `jest.config.js` :
```javascript
testTimeout: 10000 // 10 secondes
```

### Tests qui échouent en CI mais pas en local
Vérifier les variables d'environnement dans `.env.test`

---

**Dernière mise à jour :** 28 Décembre 2025
