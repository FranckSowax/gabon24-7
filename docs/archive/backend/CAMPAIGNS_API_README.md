# 📢 API Campagnes Publicitaires - Documentation

## Vue d'Ensemble

API complète pour gérer les campagnes publicitaires sur Gabon Insight avec upload de médias, génération IA et analytics en temps réel.

**Base URL**: `http://localhost:3001/api`

---

## 🔐 Authentification

Toutes les routes nécessitent un header `x-user-id` (temporaire, à remplacer par JWT):

```http
x-user-id: uuid-de-l-utilisateur
```

Les routes admin nécessitent également:

```http
x-is-admin: true
```

---

## 📋 Routes Campagnes Utilisateurs

### 1. Créer une Campagne

**POST** `/campaigns`

Créer une nouvelle campagne publicitaire.

**Body:**
```json
{
  "campaign_type": "banner-home|banner-feed|video-home|article-trending",
  "name": "Nom de la campagne",
  "budget": 50000,
  "duration_days": 7,
  "redirect_url": "https://example.com",
  
  // Pour banner-home
  "desktop_image_url": "https://...",
  "mobile_image_url": "https://...",
  "banner_title": "Titre",
  "banner_description": "Description",
  
  // Pour banner-feed
  "feed_image_1_url": "https://...",
  "feed_image_2_url": "https://...",
  "feed_image_3_url": "https://...",
  
  // Pour video-home
  "video_url": "https://...",
  "video_title": "Titre",
  "video_description": "Description",
  
  // Pour article-trending
  "article_title": "Titre",
  "article_content": "Contenu complet",
  "article_category": "tech",
  // ... autres champs
  
  // Options
  "design_request": false,
  "design_request_notes": "Notes pour les designers"
}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* campagne créée */ },
  "message": "Campagne créée avec succès"
}
```

### 2. Mes Campagnes

**GET** `/campaigns/my-campaigns`

Récupérer toutes les campagnes de l'utilisateur.

**Response:**
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Ma campagne",
      "status": "pending|active|rejected|paused|completed",
      "campaign_type": "banner-home",
      "views": 1250,
      "clicks": 45,
      "ctr": 3.6,
      "created_at": "2025-01-09T..."
    }
  ]
}
```

### 3. Détails d'une Campagne

**GET** `/campaigns/:id`

Récupérer les détails complets d'une campagne.

**Response:**
```json
{
  "campaign": { /* données complètes */ }
}
```

### 4. Analytics d'une Campagne

**GET** `/campaigns/:id/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Récupérer les analytics détaillés d'une campagne.

**Response:**
```json
{
  "analytics": {
    "totalViews": 1250,
    "totalClicks": 45,
    "totalImpressions": 3500,
    "ctr": 3.6,
    "eventsByType": {
      "views": 1250,
      "clicks": 45,
      "impressions": 3500
    },
    "eventsByDay": {
      "2025-01-09": { "views": 450, "clicks": 12 }
    }
  }
}
```

### 5. Tracker un Événement

**POST** `/campaigns/:id/track`

Enregistrer un événement (vue, clic, impression).

**Body:**
```json
{
  "event": "view|click|impression|share"
}
```

**Response:**
```json
{
  "success": true,
  "views": 1251  // compteur mis à jour
}
```

### 6. Campagne Active pour Affichage

**GET** `/campaigns/active/display?position=banner-home`

Récupérer une campagne active à afficher sur le site.

**Query Params:**
- `position`: Type de campagne (banner-home, banner-feed, video-home, article-trending)

**Response:**
```json
{
  "campaign": { /* campagne active */ } // ou null si aucune
}
```

---

## 📤 Routes Upload

### 1. Upload Image

**POST** `/upload/image`

Upload une image vers Supabase Storage.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: Fichier image (JPG, PNG, WebP, max 10MB)

**Response:**
```json
{
  "success": true,
  "url": "https://supabase.../image.jpg",
  "filename": "original.jpg",
  "size": 1245678
}
```

### 2. Upload Vidéo

**POST** `/upload/video`

Upload une vidéo vers Supabase Storage.

**Form Data:**
- `file`: Fichier vidéo (MP4, MOV, max 50MB)

**Response:**
```json
{
  "success": true,
  "url": "https://supabase.../video.mp4",
  "filename": "video.mp4",
  "size": 25678901
}
```

### 3. Upload + Redimensionnement

**POST** `/upload/resize`

Upload et redimensionne automatiquement une image.

**Form Data:**
- `file`: Fichier image
- `width`: Largeur cible (pixels)
- `height`: Hauteur cible (pixels)

**Response:**
```json
{
  "success": true,
  "url": "https://...",
  "originalSize": 5678901,
  "resizedSize": 1234567,
  "dimensions": { "width": 1200, "height": 300 }
}
```

### 4. Upload Multiple

**POST** `/upload/multiple`

Upload jusqu'à 5 fichiers simultanément.

**Form Data:**
- `files`: Tableau de fichiers

**Response:**
```json
{
  "success": true,
  "files": [
    { "url": "https://...", "filename": "img1.jpg", "size": 123456 },
    { "url": "https://...", "filename": "img2.jpg", "size": 234567 }
  ],
  "count": 2
}
```

### 5. Supprimer un Fichier

**DELETE** `/upload`

Supprimer un fichier de Supabase Storage.

**Body:**
```json
{
  "url": "https://supabase.../file.jpg",
  "bucket": "campaigns-images"  // optionnel
}
```

---

## 🤖 Routes Génération IA

### 1. Générer un Article

**POST** `/ai/generate-article`

Générer un article sponsorisé avec GPT-4.

**Body:**
```json
{
  "title": "Titre de l'article",
  "subtitle": "Sous-titre",
  "category": "tech",
  "companyName": "TechGabon",
  "productService": "Plateforme SaaS",
  "targetAudience": "PME gabonaises",
  "keyMessage": "Innovation locale",
  "callToAction": "Essai gratuit"
}
```

**Response:**
```json
{
  "success": true,
  "content": "# Titre\n\nContenu de l'article généré...",
  "wordCount": 657,
  "metadata": {
    "model": "gpt-4-turbo-preview",
    "usage": { "prompt_tokens": 250, "completion_tokens": 800 }
  }
}
```

### 2. Générer une Description

**POST** `/ai/generate-description`

Générer une description courte pour bannière.

**Body:**
```json
{
  "companyName": "TechGabon",
  "productService": "App mobile",
  "targetAudience": "Jeunes entrepreneurs"
}
```

**Response:**
```json
{
  "success": true,
  "description": "Révolutionnez votre business avec l'app n°1 au Gabon"
}
```

### 3. Générer des Titres

**POST** `/ai/generate-titles`

Générer 5 suggestions de titres.

**Body:**
```json
{
  "companyName": "TechGabon",
  "productService": "Plateforme e-commerce",
  "category": "business"
}
```

**Response:**
```json
{
  "success": true,
  "titles": [
    "E-commerce au Gabon : La révolution est en marche",
    "Comment TechGabon transforme le commerce digital",
    // ... 3 autres titres
  ],
  "count": 5
}
```

### 4. Améliorer un Texte

**POST** `/ai/improve-text`

Corriger et améliorer un texte existant.

**Body:**
```json
{
  "text": "Texte à améliorer...",
  "context": "article sponsorisé"  // optionnel
}
```

**Response:**
```json
{
  "success": true,
  "original": "Texte original",
  "improved": "Texte amélioré"
}
```

### 5. Statut du Service IA

**GET** `/ai/status`

Vérifier si l'API OpenAI est configurée.

**Response:**
```json
{
  "available": true,
  "status": "ready",
  "message": "Service IA opérationnel"
}
```

---

## 🔧 Routes Admin

### 1. Liste des Campagnes

**GET** `/admin/campaigns?status=pending&campaign_type=banner-home&limit=50&offset=0`

Récupérer toutes les campagnes (avec filtres).

**Headers:**
```http
x-is-admin: true
```

**Response:**
```json
{
  "campaigns": [ /* array */ ],
  "total": 125,
  "stats": {
    "pending": 15,
    "active": 45,
    "rejected": 5,
    "totalRevenue": 2500000
  }
}
```

### 2. Statistiques Globales

**GET** `/admin/campaigns/stats`

Récupérer les statistiques globales.

**Response:**
```json
{
  "stats": {
    "total": 125,
    "byStatus": {
      "pending": 15,
      "active": 45,
      "rejected": 5,
      "completed": 60
    },
    "byType": {
      "banner-home": 30,
      "banner-feed": 40,
      "video-home": 25,
      "article-trending": 30
    },
    "revenue": {
      "total": 5500000,
      "pending": 750000
    },
    "engagement": {
      "totalViews": 125000,
      "totalClicks": 3500,
      "averageCTR": 2.8
    }
  }
}
```

### 3. Approuver une Campagne

**POST** `/admin/campaigns/:id/approve`

Approuver et activer une campagne.

**Body:**
```json
{
  "startDate": "2025-01-10T00:00:00Z",  // optionnel
  "endDate": "2025-01-17T00:00:00Z"     // optionnel
}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* campagne mise à jour */ },
  "message": "Campagne approuvée"
}
```

### 4. Rejeter une Campagne

**POST** `/admin/campaigns/:id/reject`

Rejeter une campagne avec raison.

**Body:**
```json
{
  "reason": "Contenu non conforme aux règles"
}
```

**Response:**
```json
{
  "success": true,
  "campaign": { /* campagne rejetée */ },
  "message": "Campagne rejetée"
}
```

### 5. Mettre en Pause

**PATCH** `/admin/campaigns/:id/pause`

Mettre une campagne en pause.

### 6. Reprendre

**PATCH** `/admin/campaigns/:id/resume`

Reprendre une campagne en pause.

### 7. Marquer comme Terminée

**PATCH** `/admin/campaigns/:id/complete`

Marquer une campagne comme terminée.

### 8. Ajouter des Notes

**PUT** `/admin/campaigns/:id/notes`

Ajouter des notes administratives.

**Body:**
```json
{
  "notes": "Notes internes sur cette campagne..."
}
```

### 9. Supprimer

**DELETE** `/admin/campaigns/:id`

Supprimer (soft delete) une campagne.

---

## 📊 Codes d'Erreur

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Créé avec succès |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |
| 503 | Service non disponible |

---

## 🚀 Installation & Démarrage

### 1. Installer les dépendances

```bash
cd backend
npm install
```

### 2. Configurer les variables d'environnement

Créer un fichier `.env`:

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...

# OpenAI (optionnel, pour génération IA)
OPENAI_API_KEY=sk-xxx...

# Server
PORT=3001
NODE_ENV=development
```

### 3. Créer les buckets Supabase

Exécuter une fois pour créer les buckets de stockage:

```javascript
const uploadService = require('./services/upload-service');
await uploadService.createBuckets();
```

### 4. Démarrer le serveur

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3001` 🚀

---

## 📝 Exemples d'Utilisation

### Créer une Bannière Page d'Accueil

```javascript
// 1. Upload des images
const desktopFormData = new FormData();
desktopFormData.append('file', desktopImageFile);
const desktopRes = await fetch('http://localhost:3001/api/upload/image', {
  method: 'POST',
  body: desktopFormData
});
const { url: desktopUrl } = await desktopRes.json();

// 2. Créer la campagne
const campaign = await fetch('http://localhost:3001/api/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': userId
  },
  body: JSON.stringify({
    campaign_type: 'banner-home',
    name: 'Ma campagne',
    desktop_image_url: desktopUrl,
    mobile_image_url: mobileUrl,
    banner_title: 'Titre accrocheur',
    banner_description: 'Description',
    redirect_url: 'https://example.com',
    budget: 50000,
    duration_days: 7
  })
});
```

### Générer un Article avec IA

```javascript
const article = await fetch('http://localhost:3001/api/ai/generate-article', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    companyName: 'TechGabon',
    productService: 'Plateforme SaaS',
    targetAudience: 'Entrepreneurs',
    keyMessage: 'Innovation locale',
    category: 'tech'
  })
});
const { content } = await article.json();
```

---

## 🔒 Sécurité

- [ ] Implémenter JWT pour authentification
- [ ] Rate limiting sur upload
- [ ] Validation des fichiers uploadés (MIME type, taille)
- [ ] Sanitization des inputs utilisateur
- [ ] CORS configuré pour domaine production
- [ ] HTTPS en production

---

## 📮 Support

Pour toute question ou problème :
- Email: support@gaboninsight.ga
- Documentation complète: `/SYSTEME_PUBLICITE_README.md`

**Version**: 1.0.0  
**Date**: 2025-01-09
