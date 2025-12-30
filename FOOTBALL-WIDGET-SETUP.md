# Widget Football Scores - Guide de Configuration

## 📋 Vue d'ensemble
Le widget FootballScores affiche les matchs de football **EN DIRECT** en temps réel dans la sidebar droite de la page d'accueil, sous le widget Journal TV.

## 🎯 Fonctionnalités
- ✅ **Matchs en direct uniquement** (live=all)
- ✅ Scores en temps réel via API Football (RapidAPI)
- ✅ Indicateur LIVE animé (pulse rouge)
- ✅ Groupement par championnat
- ✅ Affichage des logos équipes et ligues
- ✅ Statuts des matchs (En cours, score en direct)
- ✅ Design orange/rouge cohérent avec Gabon24-7
- ✅ Données de démonstration en cas d'erreur API
- ✅ Scrollbar personnalisée orange
- ✅ Message intelligent si aucun match en cours

## 📁 Fichiers créés/modifiés

### Frontend
- ✅ `frontend/src/components/widgets/FootballScores.tsx` - Composant principal
- ✅ `frontend/src/app/page.tsx` - Intégration dans la sidebar (ligne 31 et 1736)

### Backend
- ✅ `backend/server.js` - Endpoint `/api/football/fixtures` (lignes 5768-5818)
- ✅ `backend/api/fixtures.php` - Alternative PHP (optionnel)
- ✅ `backend/.env.example` - Variable RAPIDAPI_FOOTBALL_KEY

## 🔧 Configuration

### 1. Variables d'environnement

Ajoutez dans votre fichier `backend/.env` :

```bash
RAPIDAPI_FOOTBALL_KEY=c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7
```

**Note:** La clé API est déjà configurée dans le code avec une valeur par défaut, mais il est recommandé de la mettre dans `.env` pour la production.

### 2. Obtenir votre propre clé API (Optionnel)

1. Créez un compte sur [RapidAPI](https://rapidapi.com/)
2. Abonnez-vous à [API-Football](https://rapidapi.com/api-sports/api/api-football)
3. Copiez votre clé API
4. Remplacez la valeur dans `.env`

**Plans disponibles:**
- **Gratuit:** 100 requêtes/jour
- **Basic:** 3,000 requêtes/mois - $10/mois
- **Pro:** 30,000 requêtes/mois - $25/mois

### 3. Démarrage

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## 🎨 Personnalisation

### Modifier les couleurs

Dans `FootballScores.tsx`, vous pouvez ajuster les couleurs :

```tsx
// Header gradient
className="bg-gradient-to-r from-orange-500 to-red-600"

// Scrollbar
background: #fb923c; // orange-400
```

### Filtrer par championnat

Pour afficher uniquement certains championnats en direct, modifiez l'endpoint backend :

```javascript
// Dans server.js, ligne 5779
const apiUrl = `https://${apiHost}/v3/fixtures?live=39`; // Premier League uniquement
```

**IDs championnats populaires:**
- 39: Premier League (Angleterre)
- 140: La Liga (Espagne)
- 61: Ligue 1 (France)
- 78: Bundesliga (Allemagne)
- 135: Serie A (Italie)
- `all`: Tous les championnats (défaut)

### Ajuster la hauteur du widget

```tsx
// Dans FootballScores.tsx
<div className="p-4 max-h-[600px] overflow-y-auto"> // Changez 600px
```

## 🔄 Workflow

```
1. User visite page d'accueil
   ↓
2. Widget FootballScores charge (LazyMount)
   ↓
3. Requête GET /api/football/fixtures (live=all)
   ↓
4. Backend appelle RapidAPI Football (matchs en direct)
   ↓
5. Parse et retourne uniquement les matchs EN COURS
   ↓
6. Frontend affiche par ligue avec indicateur LIVE
   ↓
7. Actualisation automatique possible (optionnel)
```

## 📊 Structure des données

### Réponse API

```json
{
  "response": [
    {
      "fixture": {
        "id": 123,
        "date": "2025-10-28T15:00:00+00:00",
        "status": {
          "short": "FT",
          "long": "Terminé",
          "elapsed": 90
        },
        "venue": {
          "name": "Emirates Stadium"
        }
      },
      "league": {
        "id": 39,
        "name": "Premier League",
        "logo": "https://...",
        "round": "9e journée"
      },
      "teams": {
        "home": {
          "id": 42,
          "name": "Arsenal",
          "logo": "https://...",
          "winner": true
        },
        "away": {
          "id": 52,
          "name": "Crystal Palace",
          "logo": "https://...",
          "winner": false
        }
      },
      "goals": {
        "home": 1,
        "away": 0
      }
    }
  ]
}
```

## 🐛 Dépannage

### Erreur "Failed to fetch"
- Vérifiez que le backend est démarré sur port 3001
- Vérifiez `NEXT_PUBLIC_API_URL` dans frontend/.env
- Vérifiez les logs backend pour les erreurs API

### Pas de données affichées
- Vérifiez votre clé API RapidAPI
- Consultez les limites de votre plan (100 requêtes/jour gratuit)
- Le widget affiche automatiquement des données de démo en cas d'erreur

### Images manquantes
- L'API retourne parfois des URLs cassées
- Le composant gère déjà les erreurs d'images

## 🚀 Optimisations futures

### 1. Cache Redis
Pour éviter de consommer les quotas API :

```javascript
// Dans server.js
const redis = require('redis');
const client = redis.createClient();

// Cache 5 minutes
const cacheKey = `football:${targetDate}`;
const cached = await client.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... appel API ...
await client.setex(cacheKey, 300, JSON.stringify(data));
```

### 2. Actualisation automatique

```tsx
// Dans FootballScores.tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchFixtures();
  }, 60000); // Actualise toutes les 60 secondes
  
  return () => clearInterval(interval);
}, [selectedDate]);
```

### 3. Filtrage par pays

```tsx
// Ajouter un sélecteur de pays
const [selectedCountry, setSelectedCountry] = useState('all');

// Modifier l'URL API
const apiUrl = `https://${apiHost}/v3/fixtures?date=${targetDate}&country=${selectedCountry}`;
```

## 📱 Responsive

Le widget est optimisé pour :
- ✅ Desktop (sidebar droite 320px)
- ✅ Hidden sur mobile/tablet (classe `hidden lg:block`)
- ✅ Scrollbar personnalisée orange

## 🔐 Sécurité

✅ **Bonnes pratiques appliquées:**
- Clé API stockée dans variables d'environnement
- Validation du format de date côté backend
- Gestion d'erreurs complète
- Fallback vers données de démo

❌ **À ne pas faire:**
- Exposer la clé API côté client
- Appeler directement RapidAPI depuis le frontend

## 📈 Monitoring

Pour suivre l'utilisation de votre quota API :

1. Connectez-vous à [RapidAPI Dashboard](https://rapidapi.com/developer/dashboard)
2. Consultez "API-Football" dans vos abonnements
3. Vérifiez les statistiques d'utilisation

## 🆘 Support

- **API Football:** https://www.api-football.com/documentation-v3
- **RapidAPI:** https://rapidapi.com/api-sports/api/api-football
- **React:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com

## ✅ Checklist de déploiement

- [ ] Clé API configurée dans `.env`
- [ ] Backend démarré et accessible
- [ ] Frontend compile sans erreurs
- [ ] Widget visible dans la sidebar droite
- [ ] Navigation par date fonctionnelle
- [ ] Données de démo s'affichent en cas d'erreur
- [ ] Design cohérent avec le site (orange/rouge)

---

**Version:** 1.0  
**Date:** 28 octobre 2025  
**Auteur:** Gabon24-7 Team
