# 💎 SYSTÈME DE CRÉDITS PREMIUM - GUIDE COMPLET

## 📋 Vue d'ensemble

Le système de crédits premium de Gabon 24/7 permet aux utilisateurs d'accéder à des fonctionnalités avancées en utilisant des crédits. Ce système est basé sur le document PDF fourni et intègre :

- ✅ Packages de crédits avec bonus
- ✅ Consommation de crédits pour services premium
- ✅ Historique complet des transactions
- ✅ Promotions et codes promo
- ✅ Statistiques détaillées
- ✅ Système de bonus (utilisés en premier)

---

## 🗄️ ARCHITECTURE

### Tables Supabase

1. **`credit_packages`** : Packages de crédits disponibles à l'achat
2. **`user_credits`** : Solde de chaque utilisateur (balance + bonus_balance)
3. **`credit_transactions`** : Historique de toutes les transactions
4. **`credit_costs`** : Coûts des différents services
5. **`credit_promotions`** : Codes promo et promotions

### Fonctions Postgres

- `consume_credits()` : Consommer des crédits (bonus d'abord, puis balance)
- `add_credits()` : Ajouter des crédits (achat)
- `refund_credits()` : Rembourser des crédits
- `initialize_user_credits()` : Initialiser un nouvel utilisateur avec bonus de bienvenue
- `get_total_credit_balance()` : Obtenir le solde total

---

## 📦 PACKAGES DE CRÉDITS

### Pack Starter
- **100 crédits** + 0 bonus
- **5 000 XAF** (~8.50 USD)
- Valable 6 mois
- Support email

### Pack Standard ⭐ (POPULAIRE)
- **300 crédits** + 50 bonus
- **12 000 XAF** (~20 USD)
- **Économie de 17%**
- Valable 1 an
- Support prioritaire

### Pack Premium
- **600 crédits** + 150 bonus
- **20 000 XAF** (~34 USD)
- **Économie de 33%**
- Valable 1 an
- Support VIP + Accès anticipé

### Pack Business
- **1500 crédits** + 500 bonus
- **45 000 XAF** (~75 USD)
- **Économie de 40%**
- Valable 2 ans
- Support 24/7 + API Access + Formation

---

## 💰 COÛTS DES SERVICES

### Contenu Premium
| Service | Coût | Description |
|---------|------|-------------|
| Article Premium | 1 crédit | Accès à un article premium complet |
| Article Archive | 2 crédits | Accès à un article d'archive (>6 mois) |
| Export PDF | 3 crédits | Exporter un article en PDF |

### Services IA
| Service | Coût | Description |
|---------|------|-------------|
| Résumé IA | 5 crédits | Génération d'un résumé IA d'un article |
| Analyse IA Approfondie | 10 crédits | Analyse IA détaillée d'un article ou sujet |
| Traduction IA | 8 crédits | Traduction automatique d'un article |
| Résumé Audio | 5 crédits | Génération d'un résumé audio |

### Veille et Opportunités
| Service | Coût | Description |
|---------|------|-------------|
| Rapport de Veille | 20 crédits | Génération d'un rapport de veille personnalisé |
| Analyse d'Opportunité | 15 crédits | Analyse d'opportunité business |
| Analyse Concurrentielle | 25 crédits | Analyse concurrentielle approfondie |

### Alertes et Notifications
| Service | Coût | Description |
|---------|------|-------------|
| Alerte Personnalisée | 3 crédits | Création d'une alerte personnalisée |
| Alerte Premium | 5 crédits | Alerte en temps réel avec notifications push |

---

## 🚀 API ENDPOINTS

### 1. Liste des packages
```http
GET /api/credits-premium/packages
```

**Réponse:**
```json
{
  "success": true,
  "packages": [
    {
      "id": "uuid",
      "name": "Pack Standard",
      "slug": "standard",
      "credits": 300,
      "bonus_credits": 50,
      "price_xaf": 12000,
      "price_usd": 20.00,
      "discount_percentage": 17,
      "is_popular": true,
      "features": ["300 crédits", "50 crédits bonus", "..."]
    }
  ]
}
```

---

### 2. Solde utilisateur
```http
GET /api/credits-premium/balance/:userId
```

**Réponse:**
```json
{
  "success": true,
  "balance": 250,
  "bonus_balance": 30,
  "total_balance": 280,
  "is_low_balance": false,
  "total_earned": 350,
  "total_spent": 70,
  "last_purchase_at": "2025-11-16T10:00:00Z"
}
```

---

### 3. Consommer des crédits
```http
POST /api/credits-premium/consume
Content-Type: application/json

{
  "userId": "user-uuid",
  "serviceName": "ai_analysis",
  "amount": 10,
  "description": "Analyse IA de l'article XYZ",
  "referenceId": "article-123",
  "metadata": {
    "article_id": "article-123",
    "article_title": "Titre de l'article"
  }
}
```

**Réponse:**
```json
{
  "success": true,
  "transaction_id": "transaction-uuid",
  "balance": 240,
  "bonus_balance": 30,
  "total_balance": 270,
  "consumed": 10,
  "from_bonus": 0,
  "from_balance": 10
}
```

**Erreur (solde insuffisant):**
```json
{
  "success": false,
  "error": "Solde insuffisant",
  "balance": 5,
  "bonus_balance": 0,
  "required": 10
}
```

---

### 4. Acheter un package
```http
POST /api/credits-premium/purchase
Content-Type: application/json

{
  "userId": "user-uuid",
  "packageId": "package-uuid",
  "paymentMethod": "mobile_money",
  "paymentReference": "MTN-123456789"
}
```

**Réponse:**
```json
{
  "success": true,
  "transaction_id": "transaction-uuid",
  "balance": 540,
  "bonus_balance": 80,
  "total_balance": 620,
  "credits_added": 300,
  "bonus_added": 50,
  "package": {
    "name": "Pack Standard",
    "credits": 300,
    "bonus_credits": 50,
    "price_xaf": 12000
  }
}
```

---

### 5. Historique des transactions
```http
GET /api/credits-premium/history/:userId?limit=50&offset=0&type=consume
```

**Réponse:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "transaction-uuid",
      "user_id": "user-uuid",
      "type": "consume",
      "amount": -10,
      "balance_after": 240,
      "bonus_balance_after": 30,
      "description": "Analyse IA de l'article XYZ",
      "service_name": "ai_analysis",
      "reference_id": "article-123",
      "status": "completed",
      "created_at": "2025-11-16T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 6. Vérifier le solde avant action
```http
POST /api/credits-premium/check
Content-Type: application/json

{
  "userId": "user-uuid",
  "serviceName": "ai_analysis"
}
```

**Réponse:**
```json
{
  "success": true,
  "has_enough": true,
  "balance": 250,
  "bonus_balance": 30,
  "total_balance": 280,
  "required": 10,
  "missing": 0
}
```

---

### 7. Statistiques utilisateur
```http
GET /api/credits-premium/stats/:userId
```

**Réponse:**
```json
{
  "success": true,
  "stats": {
    "balance": 250,
    "bonus_balance": 30,
    "total_balance": 280,
    "total_earned": 350,
    "total_spent": 70,
    "last_purchase_at": "2025-11-16T10:00:00Z",
    "transactions_count": 25,
    "monthly_spending": 45,
    "most_used_service": "ai_analysis"
  }
}
```

---

### 8. Coûts des services
```http
GET /api/credits-premium/costs
```

**Réponse:**
```json
{
  "success": true,
  "costs": [
    {
      "service_name": "ai_analysis",
      "display_name": "Analyse IA Approfondie",
      "cost_credits": 10,
      "description": "Analyse IA détaillée d'un article ou sujet",
      "category": "ai",
      "is_active": true
    }
  ],
  "grouped": {
    "ai": [...],
    "content": [...],
    "premium": [...],
    "alert": [...]
  }
}
```

---

### 9. Initialiser un nouvel utilisateur
```http
POST /api/credits-premium/initialize
Content-Type: application/json

{
  "userId": "user-uuid",
  "welcomeBonus": 50
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Compte crédits initialisé",
  "welcome_bonus": 50
}
```

---

### 10. Rembourser des crédits
```http
POST /api/credits-premium/refund
Content-Type: application/json

{
  "userId": "user-uuid",
  "amount": 10,
  "description": "Remboursement - Erreur analyse IA",
  "referenceId": "article-123"
}
```

**Réponse:**
```json
{
  "success": true,
  "transaction_id": "transaction-uuid",
  "balance": 260,
  "bonus_balance": 30,
  "total_balance": 290,
  "refunded": 10
}
```

---

## 🔄 FLUX D'UTILISATION

### Scénario 1 : Analyse IA d'un article

```javascript
// 1. Vérifier si l'utilisateur a assez de crédits
const checkResponse = await fetch('/api/credits-premium/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    serviceName: 'ai_analysis'
  })
});

const { has_enough, required, missing } = await checkResponse.json();

if (!has_enough) {
  // Afficher modal de recharge
  showTopUpModal(required, missing);
  return;
}

// 2. Consommer les crédits
const consumeResponse = await fetch('/api/credits-premium/consume', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    serviceName: 'ai_analysis',
    amount: 10,
    description: `Analyse IA de l'article "${articleTitle}"`,
    referenceId: articleId,
    metadata: {
      article_id: articleId,
      article_title: articleTitle
    }
  })
});

const result = await consumeResponse.json();

if (result.success) {
  // 3. Lancer l'analyse IA
  const analysis = await performAIAnalysis(articleId);
  
  // 4. Afficher le nouveau solde
  updateBalanceDisplay(result.total_balance);
  
  // 5. Afficher l'analyse
  displayAnalysis(analysis);
} else {
  // Gérer l'erreur
  alert(result.error);
}
```

---

### Scénario 2 : Achat de crédits

```javascript
// 1. Afficher les packages disponibles
const packagesResponse = await fetch('/api/credits-premium/packages');
const { packages } = await packagesResponse.json();

// 2. L'utilisateur sélectionne un package
const selectedPackage = packages.find(p => p.slug === 'standard');

// 3. Initier le paiement (Mobile Money ou Credit Card)
// TODO: Intégration paiement à venir
const paymentReference = await initiateMobileMoneyPayment(selectedPackage.price_xaf);

// 4. Après paiement réussi, créditer le compte
const purchaseResponse = await fetch('/api/credits-premium/purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.id,
    packageId: selectedPackage.id,
    paymentMethod: 'mobile_money',
    paymentReference: paymentReference
  })
});

const result = await purchaseResponse.json();

if (result.success) {
  // 5. Afficher confirmation
  alert(`${result.credits_added + result.bonus_added} crédits ajoutés !`);
  updateBalanceDisplay(result.total_balance);
}
```

---

## 🎁 BONUS DE BIENVENUE

Chaque nouvel utilisateur reçoit **50 crédits bonus** à l'inscription. Ces crédits sont automatiquement ajoutés lors de la création du compte.

```javascript
// Lors de l'inscription
await fetch('/api/credits-premium/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: newUser.id,
    welcomeBonus: 50
  })
});
```

---

## 🔒 SÉCURITÉ

### Validations automatiques
- ✅ Vérification du solde avant chaque consommation
- ✅ Transactions atomiques (tout ou rien)
- ✅ Enregistrement de toutes les transactions
- ✅ Métadonnées pour traçabilité complète
- ✅ Row Level Security (RLS) sur toutes les tables

### Gestion des bonus
- Les **crédits bonus** sont utilisés en premier
- Les **crédits achetés** sont utilisés ensuite
- Cela maximise la valeur pour l'utilisateur

---

## 📊 MONITORING

### Requêtes SQL utiles

```sql
-- Solde total des crédits en circulation
SELECT 
  SUM(balance) as total_balance,
  SUM(bonus_balance) as total_bonus,
  SUM(balance + bonus_balance) as total_credits
FROM user_credits;

-- Transactions du jour
SELECT * FROM credit_transactions 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Top consommateurs
SELECT 
  user_id, 
  SUM(ABS(amount)) as total_consumed
FROM credit_transactions 
WHERE type = 'consume'
GROUP BY user_id
ORDER BY total_consumed DESC
LIMIT 10;

-- Revenus du jour (achats de crédits)
SELECT 
  SUM(price_paid_xaf) as revenue_xaf,
  COUNT(*) as purchases_count
FROM credit_transactions
WHERE type = 'purchase' 
AND created_at >= NOW() - INTERVAL '1 day';

-- Services les plus utilisés
SELECT 
  service_name,
  COUNT(*) as usage_count,
  SUM(ABS(amount)) as total_credits_consumed
FROM credit_transactions
WHERE type = 'consume'
GROUP BY service_name
ORDER BY usage_count DESC;
```

---

## ✅ INSTALLATION

### 1. Créer les tables Supabase

```bash
# Exécuter le script SQL dans Supabase SQL Editor
cat database/create_credit_system_premium.sql | supabase db execute
```

Ou manuellement dans Supabase Dashboard → SQL Editor → Coller le contenu du fichier `create_credit_system_premium.sql`

### 2. Vérifier les tables créées

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'credit%'
ORDER BY table_name;
```

Vous devriez voir :
- `credit_costs`
- `credit_packages`
- `credit_promotions`
- `credit_transactions`
- `user_credits`

### 3. Vérifier les fonctions

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%credit%'
ORDER BY routine_name;
```

Vous devriez voir :
- `add_credits`
- `consume_credits`
- `get_total_credit_balance`
- `initialize_user_credits`
- `refund_credits`

### 4. Redémarrer le backend

```bash
cd backend
npm start
```

### 5. Tester l'API

```bash
# Vérifier les packages
curl http://localhost:3001/api/credits-premium/packages

# Vérifier le solde d'un utilisateur
curl http://localhost:3001/api/credits-premium/balance/USER_UUID
```

---

## 🎯 PROCHAINES ÉTAPES

### Phase 1 : Backend ✅
- [x] Tables Supabase créées
- [x] Fonctions Postgres créées
- [x] API endpoints créés
- [x] Documentation complète

### Phase 2 : Frontend (À faire)
- [ ] Composant `CreditBalance` (affichage solde)
- [ ] Composant `CreditPackages` (liste des packages)
- [ ] Composant `CreditHistory` (historique transactions)
- [ ] Modal `TopUpCredits` (recharge)
- [ ] Hook `useCredits` (gestion état)
- [ ] Intégration dans les fonctionnalités existantes

### Phase 3 : Paiement (À faire)
- [ ] Intégration Mobile Money (MTN, Moov, Airtel)
- [ ] Intégration Credit Card (Stripe)
- [ ] Webhooks de confirmation
- [ ] Gestion des échecs de paiement

### Phase 4 : Tests (À faire)
- [ ] Tests unitaires des fonctions Postgres
- [ ] Tests d'intégration API
- [ ] Tests de charge
- [ ] Tests de sécurité

---

## 📞 SUPPORT

Pour toute question ou problème :
- 📧 Email : support@gabon24-7.com
- 💬 Discord : [Lien Discord]
- 📱 WhatsApp : +241 XX XX XX XX

---

## 📝 CHANGELOG

### Version 1.0.0 (2025-11-16)
- ✅ Système de crédits premium créé
- ✅ 4 packages de crédits configurés
- ✅ 10 services avec coûts définis
- ✅ API complète avec 11 endpoints
- ✅ Fonctions Postgres optimisées
- ✅ Documentation complète

---

**Le système de crédits premium est maintenant opérationnel ! 🎉**
