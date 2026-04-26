# 📱 API ROUTES - GABON24/7 MOBILE APP

Guide complet des routes API pour l'application mobile React Native.

**Base URL Production :** `https://gabon24-7-production.up.railway.app`  
**Base URL Dev :** `http://localhost:3001`

---

## 📑 Table des matières

1. [Authentification](#-authentification)
2. [Articles](#-articles)
3. [Crédits Premium](#-crédits-premium)
4. [Résumés Audio](#-résumés-audio)
5. [Opportunités Business](#-opportunités-business)
6. [Abonnements](#-abonnements)
7. [Profil Utilisateur](#-profil-utilisateur)
8. [Notifications](#-notifications)
9. [YouTube (Journaux TV)](#-youtube-journaux-tv)
10. [Alertes](#-alertes)

---

## 🔐 Authentification

### Inscription
```http
POST /api/auth/signup
```

**Headers :**
```json
{
  "Content-Type": "application/json"
}
```

**Body :**
```json
{
  "email": "user@example.com",
  "password": "motdepasse123",
  "full_name": "Nom Complet"
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Nom Complet"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

---

### Connexion
```http
POST /api/auth/signin
```

**Body :**
```json
{
  "email": "user@example.com",
  "password": "motdepasse123"
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

---

### Déconnexion
```http
POST /api/auth/signout
```

**Headers :**
```json
{
  "Authorization": "Bearer {access_token}"
}
```

---

## 📰 Articles

### Liste des articles (Page d'accueil)
```http
GET /api/articles/home
```

**Query Parameters :**
- `limit` (optionnel) : Nombre d'articles (défaut: 50)
- `offset` (optionnel) : Pagination (défaut: 0)

**Réponse :**
```json
{
  "success": true,
  "articles": [
    {
      "id": "uuid",
      "title": "Titre de l'article",
      "summary": "Résumé de l'article",
      "summary_ai": "Résumé généré par IA",
      "content": "Contenu complet",
      "image_url": "https://...",
      "source": "Gabon Media Time",
      "category": "Politique",
      "url": "https://...",
      "created_at": "2025-01-20T10:00:00Z",
      "is_premium": false
    }
  ],
  "total": 150,
  "has_more": true
}
```

---

### Article par ID
```http
GET /api/articles/{id}
```

**Réponse :**
```json
{
  "success": true,
  "article": {
    "id": "uuid",
    "title": "Titre",
    "content": "Contenu complet",
    "summary_ai": "Résumé IA",
    "image_url": "https://...",
    "source": "Source",
    "category": "Catégorie",
    "is_premium": false,
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

---

### Articles par catégorie
```http
GET /api/articles/category/{category}
```

**Catégories disponibles :**
- `politique`
- `economie`
- `sport`
- `culture`
- `societe`
- `international`

**Query Parameters :**
- `limit` (optionnel) : Nombre d'articles
- `offset` (optionnel) : Pagination

---

### Recherche d'articles
```http
GET /api/articles/search
```

**Query Parameters :**
- `q` (requis) : Terme de recherche
- `limit` (optionnel) : Nombre de résultats
- `category` (optionnel) : Filtrer par catégorie

**Exemple :**
```
GET /api/articles/search?q=gouvernement&limit=20&category=politique
```

---

### Articles premium
```http
GET /api/articles/premium
```

**Headers :**
```json
{
  "Authorization": "Bearer {access_token}"
}
```

**Query Parameters :**
- `limit` (optionnel)
- `offset` (optionnel)

---

## 💰 Crédits Premium

### Obtenir le solde
```http
GET /api/credits-premium/balance/{userId}
```

**Réponse :**
```json
{
  "success": true,
  "balance": 100,
  "bonus_balance": 50,
  "total_balance": 150,
  "is_low_balance": false
}
```

---

### Liste des packages
```http
GET /api/credits-premium/packages
```

**Réponse :**
```json
{
  "success": true,
  "packages": [
    {
      "id": "uuid",
      "name": "Starter",
      "slug": "starter",
      "credits": 100,
      "bonus_credits": 10,
      "price_xaf": 5000,
      "price_usd": 9,
      "discount_percentage": 0,
      "is_popular": false,
      "description": "Pour débuter",
      "features": ["Analyse IA", "Résumés audio"]
    }
  ]
}
```

---

### Acheter un package (Mode Démo)
```http
POST /api/credits-premium/purchase
```

**Body :**
```json
{
  "userId": "uuid",
  "packageId": "uuid",
  "paymentMethod": "demo",
  "paymentReference": "DEMO-123456"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Package acheté avec succès",
  "transaction_id": "uuid",
  "balance": 100,
  "bonus_balance": 10,
  "total_balance": 110
}
```

---

### Historique des transactions
```http
GET /api/credits-premium/history/{userId}
```

**Query Parameters :**
- `limit` (optionnel) : Défaut 50
- `offset` (optionnel) : Défaut 0
- `type` (optionnel) : `purchase`, `consumption`, `refund`, `bonus`

**Réponse :**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "consumption",
      "amount": -3,
      "service_name": "opportunity_analysis",
      "description": "Analyse d'opportunité",
      "created_at": "2025-01-20T10:00:00Z",
      "metadata": {}
    }
  ],
  "total": 25,
  "has_more": false
}
```

---

### Statistiques de crédits
```http
GET /api/credits-premium/stats/{userId}
```

**Réponse :**
```json
{
  "success": true,
  "stats": {
    "total_consumed": 150,
    "total_purchased": 300,
    "total_bonus": 75,
    "consumption_by_service": {
      "opportunity_analysis": 45,
      "audio_summary": 60,
      "ai_analysis": 45
    }
  }
}
```

---

### Initialiser un utilisateur
```http
POST /api/credits-premium/initialize
```

**Body :**
```json
{
  "userId": "uuid",
  "welcomeBonus": 50
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Utilisateur initialisé avec succès",
  "balance": 0,
  "bonus_balance": 50,
  "total_balance": 50
}
```

---

## 🔊 Résumés Audio

### Générer un résumé audio
```http
POST /api/audio/generate-summary
```

**Body :**
```json
{
  "userId": "uuid",
  "action": "daily",
  "language": "fr",
  "pace": "normal"
}
```

**Actions disponibles :**
- `daily` : Résumé de tous les articles des dernières 24h
- `custom` : Résumé d'articles sélectionnés (nécessite `articleIds`)

**Languages disponibles :**
- `fr` : Français
- `en` : Anglais
- `zh` : Chinois

**Pace disponibles :**
- `slow` : Lent
- `normal` : Normal
- `fast` : Rapide

**Réponse :**
```json
{
  "success": true,
  "summaryId": "uuid",
  "creditsConsumed": 5,
  "newBalance": 145
}
```

---

### Obtenir le dernier résumé public
```http
GET /api/audio/latest-public
```

**Query Parameters :**
- `language` (optionnel) : `fr`, `en`, `zh`

**Réponse :**
```json
{
  "success": true,
  "summary": {
    "id": "uuid",
    "text_summary": "Texte du résumé...",
    "audio_url": "https://...",
    "audio_duration_seconds": 180,
    "language": "fr",
    "status": "completed",
    "created_at": "2025-01-20T14:00:00Z"
  }
}
```

---

### Obtenir un résumé spécifique
```http
GET /api/audio/summary/{summaryId}
```

**Réponse :**
```json
{
  "success": true,
  "summary": {
    "id": "uuid",
    "text_summary": "Texte...",
    "audio_url": "https://...",
    "audio_duration_seconds": 180,
    "status": "completed"
  }
}
```

---

### Mes résumés audio
```http
GET /api/audio/user/{userId}
```

**Query Parameters :**
- `limit` (optionnel) : Défaut 20
- `offset` (optionnel) : Défaut 0

**Réponse :**
```json
{
  "success": true,
  "summaries": [
    {
      "id": "uuid",
      "summary_type": "daily",
      "text_summary": "Texte...",
      "audio_url": "https://...",
      "language": "fr",
      "created_at": "2025-01-20T14:00:00Z"
    }
  ],
  "total": 10
}
```

---

## 💡 Opportunités Business

### Analyser une opportunité
```http
POST /api/opportunities/analyze
```

**Body :**
```json
{
  "userId": "uuid",
  "opportunityText": "Texte de l'opportunité ou article",
  "context": "Contexte additionnel (optionnel)"
}
```

**Ou avec article :**
```json
{
  "userId": "uuid",
  "article": {
    "title": "Titre",
    "summary": "Résumé",
    "content": "Contenu",
    "url": "https://..."
  }
}
```

**Réponse :**
```json
{
  "success": true,
  "analysisId": "uuid",
  "analyse_contextuelle": {
    "problematique_centrale": "Description du problème",
    "tendances_macro": ["Tendance 1", "Tendance 2"],
    "analyse_swot": {
      "forces": ["Force 1", "Force 2"],
      "faiblesses": ["Faiblesse 1"]
    }
  },
  "secteurs_opportunites": [
    {
      "nom": "Agriculture",
      "description": "Description du secteur",
      "score_potentiel": 85
    }
  ],
  "creditsConsumed": 3,
  "newBalance": 142
}
```

---

### Générer des propositions de projets
```http
POST /api/opportunities/generate-proposals
```

**Body :**
```json
{
  "userId": "uuid",
  "secteur": "Agriculture",
  "budget": "500,000 - 1,000,000 XAF",
  "problematique": "Description du problème",
  "userContext": {
    "situation": "Étudiant",
    "competences": ["Marketing", "Commerce"],
    "disponibilite": "Temps plein",
    "objectif_delai": "3 mois"
  }
}
```

**Réponse :**
```json
{
  "success": true,
  "propositions": [
    {
      "titre": "Titre du projet",
      "description": "Description détaillée",
      "budget_requis": "750,000 XAF",
      "etapes": ["Étape 1", "Étape 2"],
      "potentiel": 90
    }
  ]
}
```

---

### Mes analyses
```http
GET /api/opportunities/user/{userId}
```

**Query Parameters :**
- `limit` (optionnel)
- `offset` (optionnel)

**Réponse :**
```json
{
  "success": true,
  "analyses": [
    {
      "id": "uuid",
      "opportunity_title": "Titre",
      "opportunity_description": "Description",
      "created_at": "2025-01-20T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

## 👑 Abonnements

### Plans disponibles
```http
GET /api/subscriptions/plans
```

**Réponse :**
```json
{
  "success": true,
  "plans": [
    {
      "id": "uuid",
      "name": "Plan Gratuit",
      "slug": "free",
      "price_monthly": 0,
      "price_yearly": 0,
      "features": {
        "articles_per_day": 10,
        "ai_summaries": false,
        "audio_summaries": false,
        "opportunities": false
      }
    },
    {
      "id": "uuid",
      "name": "Premium",
      "slug": "premium",
      "price_monthly": 5000,
      "price_yearly": 50000,
      "features": {
        "articles_per_day": -1,
        "ai_summaries": true,
        "audio_summaries": true,
        "opportunities": true
      }
    }
  ]
}
```

---

### Mon abonnement
```http
GET /api/subscriptions/user/{userId}
```

**Réponse :**
```json
{
  "success": true,
  "subscription": {
    "id": "uuid",
    "plan_name": "Premium",
    "plan_slug": "premium",
    "status": "active",
    "started_at": "2025-01-01T00:00:00Z",
    "expires_at": "2025-02-01T00:00:00Z",
    "auto_renew": true
  }
}
```

---

## 👤 Profil Utilisateur

### Mon profil
```http
GET /api/profile/{userId}
```

**Headers :**
```json
{
  "Authorization": "Bearer {access_token}"
}
```

**Réponse :**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Nom Complet",
    "phone_number": "+241...",
    "avatar_url": "https://...",
    "subscription_plan": "premium",
    "credits_balance": 150,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Mettre à jour le profil
```http
PUT /api/profile/{userId}
```

**Headers :**
```json
{
  "Authorization": "Bearer {access_token}",
  "Content-Type": "application/json"
}
```

**Body :**
```json
{
  "full_name": "Nouveau Nom",
  "phone_number": "+241...",
  "avatar_url": "https://..."
}
```

---

## 🔔 Notifications

### Mes notifications
```http
GET /api/notifications/{userId}
```

**Query Parameters :**
- `limit` (optionnel) : Défaut 50
- `unread_only` (optionnel) : `true` ou `false`

**Réponse :**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "type": "credit_low",
      "title": "Crédits faibles",
      "message": "Il vous reste 5 crédits",
      "is_read": false,
      "created_at": "2025-01-20T10:00:00Z"
    }
  ],
  "unread_count": 3
}
```

---

### Marquer comme lu
```http
PUT /api/notifications/{notificationId}/read
```

**Réponse :**
```json
{
  "success": true,
  "message": "Notification marquée comme lue"
}
```

---

### Marquer toutes comme lues
```http
PUT /api/notifications/{userId}/read-all
```

---

## 📺 YouTube (Journaux TV)

### Derniers journaux TV
```http
GET /api/youtube
```

**Réponse :**
```json
{
  "success": true,
  "videos": [
    {
      "id": "youtube_video_id",
      "title": "Journal TV du 20 Janvier 2025",
      "thumbnail": "https://...",
      "url": "https://youtube.com/watch?v=...",
      "publishedAt": "2025-01-20T20:00:00Z",
      "duration": "1800"
    }
  ]
}
```

---

## 🚨 Alertes

### Créer une alerte
```http
POST /api/alerts/create
```

**Body :**
```json
{
  "userId": "uuid",
  "keywords": ["gouvernement", "économie"],
  "categories": ["politique", "economie"],
  "frequency": "daily"
}
```

**Frequencies disponibles :**
- `instant` : Immédiat
- `daily` : Quotidien
- `weekly` : Hebdomadaire

**Réponse :**
```json
{
  "success": true,
  "alert": {
    "id": "uuid",
    "keywords": ["gouvernement", "économie"],
    "categories": ["politique", "economie"],
    "frequency": "daily",
    "is_active": true
  }
}
```

---

### Mes alertes
```http
GET /api/alerts/user/{userId}
```

**Réponse :**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "uuid",
      "keywords": ["gouvernement"],
      "categories": ["politique"],
      "frequency": "daily",
      "is_active": true,
      "match_count": 15
    }
  ]
}
```

---

### Supprimer une alerte
```http
DELETE /api/alerts/{alertId}
```

---

## 📊 Codes de réponse HTTP

| Code | Signification |
|------|---------------|
| `200` | Succès |
| `201` | Créé avec succès |
| `400` | Requête invalide |
| `401` | Non authentifié |
| `402` | Crédits insuffisants |
| `403` | Accès refusé |
| `404` | Ressource non trouvée |
| `500` | Erreur serveur |
| `503` | Service temporairement indisponible |

---

## 🔒 Authentification

### Utilisation du Token JWT

Pour toutes les routes protégées, incluez le token dans le header :

```javascript
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

### Refresh Token

Quand l'access token expire, utilisez le refresh token pour en obtenir un nouveau :

```http
POST /api/auth/refresh
```

**Body :**
```json
{
  "refresh_token": "refresh_token_here"
}
```

---

## 💡 Bonnes pratiques

### 1. Gestion des erreurs

```javascript
try {
  const response = await fetch(`${API_URL}/api/articles/home`);
  const data = await response.json();
  
  if (!response.ok) {
    // Gérer les erreurs HTTP
    if (response.status === 402) {
      // Crédits insuffisants - Afficher modal de recharge
      showCreditAlert(data.balance, data.required);
    } else if (response.status === 401) {
      // Token expiré - Rafraîchir ou redemander connexion
      await refreshToken();
    }
    throw new Error(data.error || 'Erreur');
  }
  
  return data;
} catch (error) {
  console.error('Erreur API:', error);
  // Afficher message d'erreur à l'utilisateur
}
```

---

### 2. Pagination

Pour les listes avec pagination :

```javascript
const fetchArticles = async (page = 0, limit = 20) => {
  const offset = page * limit;
  const response = await fetch(
    `${API_URL}/api/articles/home?limit=${limit}&offset=${offset}`
  );
  return response.json();
};
```

---

### 3. Cache et optimisation

- **Cachier les données** qui ne changent pas souvent (packages, plans)
- **Utiliser AsyncStorage** pour stocker le token
- **Implémenter retry logic** pour les requêtes échouées
- **Précharger** les données critiques au lancement

---

### 4. Gestion des crédits

```javascript
// Vérifier avant action
const checkCredits = async (serviceName) => {
  const response = await fetch(
    `${API_URL}/api/credits-premium/balance/${userId}`
  );
  const data = await response.json();
  
  const COSTS = {
    'audio_summary': 5,
    'opportunity_analysis': 3,
    'ai_analysis': 10
  };
  
  const required = COSTS[serviceName];
  
  if (data.total_balance < required) {
    // Afficher alerte
    showCreditAlert(data.total_balance, required);
    return false;
  }
  
  return true;
};
```

---

## 🧪 Environnements

### Production
```javascript
const API_URL = 'https://gabon24-7-production.up.railway.app';
```

### Développement
```javascript
const API_URL = 'http://localhost:3001';
// ou
const API_URL = 'http://192.168.1.X:3001'; // IP locale pour tests mobile
```

---

## 📱 Exemple d'implémentation React Native

### Service API centralisé

```javascript
// services/api.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://gabon24-7-production.up.railway.app';

class ApiService {
  async getToken() {
    return await AsyncStorage.getItem('access_token');
  }

  async request(endpoint, options = {}) {
    const token = await this.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw {
        status: response.status,
        message: data.error || 'Erreur',
        data
      };
    }
    
    return data;
  }

  // Articles
  async getArticles(limit = 20, offset = 0) {
    return this.request(`/api/articles/home?limit=${limit}&offset=${offset}`);
  }

  // Crédits
  async getCreditBalance(userId) {
    return this.request(`/api/credits-premium/balance/${userId}`);
  }

  async purchasePackage(userId, packageId) {
    return this.request('/api/credits-premium/purchase', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        packageId,
        paymentMethod: 'mobile_money',
        paymentReference: 'REF-' + Date.now()
      })
    });
  }

  // Audio
  async generateAudioSummary(userId, language = 'fr') {
    return this.request('/api/audio/generate-summary', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        action: 'daily',
        language
      })
    });
  }

  // Opportunités
  async analyzeOpportunity(userId, text) {
    return this.request('/api/opportunities/analyze', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        opportunityText: text
      })
    });
  }
}

export default new ApiService();
```

---

## 🔄 Flux d'authentification recommandé

```
1. App Launch
   ↓
2. Check AsyncStorage for token
   ↓
3a. Token exists → Validate token
   ↓
3b. Token valid → Load user data
   |
   ↓
4. Token expired/invalid → Refresh or Login

Login Flow:
1. User enters credentials
2. POST /api/auth/signin
3. Store access_token & refresh_token
4. Navigate to home
```

---

## 📞 Support

Pour toute question sur l'API :
- Documentation backend : `CREDIT_SYSTEM_PREMIUM_GUIDE.md`
- Tests : `TEST_CREDIT_INTEGRATION.md`
- Email : support@gabon247.com

---

## 🚀 Changelog

### v1.0.0 (2025-01-20)
- Routes authentification
- Routes articles
- Routes crédits premium
- Routes résumés audio
- Routes opportunités
- Routes abonnements
- Routes profil
- Routes notifications
- Routes YouTube
- Routes alertes

---

**Dernière mise à jour :** 20 Janvier 2025  
**Version API :** 1.0.0  
**Backend :** Railway  
**Frontend :** Netlify
