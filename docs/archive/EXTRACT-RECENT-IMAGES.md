# Extraction d'Images des Articles Récents (24h)

## 📋 Objectif

Script automatisé pour extraire et ajouter des images aux articles publiés dans les dernières 24 heures, avec un focus spécial sur les flux RSS Facebook Gabon 24 et autres médias gabonais.

## 🎯 Fonctionnalités

- **Extraction multi-sources** : Open Graph, Twitter Cards, Facebook CDN, images d'articles
- **Priorisation intelligente** : Tri par qualité et pertinence des images
- **Proxy automatique** : Utilisation du proxy pour les images protégées
- **Déduplication** : Évite les images en double
- **Statistiques détaillées** : Rapport complet par source et type d'image

## 🔧 Utilisation

### Appel Manuel
```bash
curl "https://gabon24-7.netlify.app/.netlify/functions/extract-recent-images"
```

### Via Postman/Insomnia
- **Method**: GET
- **URL**: `https://gabon24-7.netlify.app/.netlify/functions/extract-recent-images`

## 📊 Types d'Images Extraites

### 1. **Images Facebook** (Priorité: 2)
- URLs Facebook CDN (`fbcdn.net`, `scontent`)
- Images des posts Facebook de Gabon 24, ministères, etc.

### 2. **Métadonnées Sociales** (Priorité: 3)
- Open Graph images (`og:image`)
- Twitter Card images (`twitter:image`)

### 3. **Médias Gabonais** (Priorité: 2)
- Images des sites gabonais (gabon24, gabonactu, etc.)
- Images WordPress/CMS locaux

### 4. **Images d'Articles** (Priorité: 1)
- Images dans le contenu HTML
- Images JSON-LD structurées

## 📈 Réponse Type

```json
{
  "success": true,
  "processed": 12,
  "updated": 8,
  "errors": 0,
  "duration": 5,
  "stats": {
    "bySource": {
      "Communication Gouvernementale": 2,
      "Gabon 24": 3,
      "Gabon Actu": 2,
      "L'Union": 1
    },
    "imageTypes": {
      "facebook": 3,
      "social": 2,
      "gabon_media": 2,
      "article": 1
    }
  },
  "results": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Conseil des ministres : nouvelles mesures...",
      "imageUrl": "/.netlify/functions/image-proxy?url=...",
      "imageType": "facebook",
      "imageSource": "scontent.xx.fbcdn.net",
      "status": "updated",
      "totalImagesFound": 3
    }
  ],
  "message": "8 images extraites sur 12 articles récents (5s)"
}
```

## 🎯 Critères de Traitement

### Articles Ciblés
- **Période** : Dernières 24 heures
- **Condition** : `image_url IS NULL OR image_url = ''`
- **Limite** : 20 articles max par exécution

### Validation des Images
- Extensions supportées : jpg, jpeg, png, gif, webp
- Exclusion des placeholders, avatars, logos
- Déduplication par URL

## 🔄 Système d'Extraction

### Patterns de Recherche
1. **Facebook CDN** : `https://scontent*.fbcdn.net/*`
2. **Open Graph** : `<meta property="og:image" content="..."`
3. **Images Standard** : `<img src="..." />`
4. **JSON-LD** : `"image": "..."`
5. **WordPress** : `wp-content/uploads/*`

### Priorisation
```javascript
{
  'social': 3,      // Open Graph, Twitter Card
  'facebook': 2,    // Images Facebook CDN
  'gabon_media': 2, // Médias gabonais
  'wordpress': 1,   // Images CMS
  'article': 1      // Images d'article standard
}
```

## 🛡️ Proxy Automatique

Images nécessitant le proxy :
- `fbcdn.net` - Facebook CDN
- `facebook.com` - Facebook direct
- `infosgabon.com` - Info Gabon
- `directinfosgabon.com` - Direct Infos Gabon
- `gabonmediatime.com` - Gabon Media Time

## ⚡ Performances

- **Timeout** : 8 minutes maximum
- **Batch** : 20 articles max par exécution
- **Pauses** : 200ms toutes les 3 extractions
- **Cache** : Headers optimisés pour éviter les re-téléchargements

## 🚨 Gestion d'Erreurs

- Extraction individuelle isolée
- Fallback gracieux si aucune image trouvée
- Logs détaillés pour debugging
- Statistiques d'erreurs dans la réponse

## 📝 Logs Automatiques

Chaque exécution génère un log dans `sync_logs` :
- Type : `recent_images_extraction`
- Statistiques par source et type
- Détails des erreurs
- Durée d'exécution

## 🔗 Intégration

### Workflow Recommandé
1. **Sync RSS** → Articles ajoutés sans images
2. **Extract Images** → Images ajoutées aux articles récents
3. **Process Sources** → Sources corrigées
4. **Result** → Articles complets avec images et sources

### Automatisation
Idéal pour un cron job après chaque synchronisation RSS pour enrichir immédiatement les nouveaux articles.
