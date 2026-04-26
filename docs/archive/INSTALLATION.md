# Guide d'installation - Scores de Football en Direct

## 📋 Vue d'ensemble
Ce projet affiche les scores de matchs de football en temps réel avec une interface similaire à l'application L'Équipe.

## 🗂️ Fichiers fournis
1. **football-scores.jsx** - Composant React pour l'interface
2. **fixtures.php** - Backend PHP pour appeler l'API Football

## 🚀 Installation

### Étape 1: Configuration du backend PHP

1. Téléchargez le fichier `fixtures.php`
2. Placez-le sur votre serveur web PHP (par exemple dans un dossier `/api/`)
3. Assurez-vous que cURL est activé dans votre configuration PHP
4. Testez l'accès: `https://votre-domaine.com/api/fixtures.php?date=2025-10-26`

**Note importante:** Protégez votre clé API en production !
- Ne commitez jamais la clé API dans un dépôt public
- Utilisez des variables d'environnement
- Exemple avec `.env`:
```php
$apiKey = getenv('RAPIDAPI_KEY');
```

### Étape 2: Configuration du composant React

1. Ouvrez `football-scores.jsx`
2. Trouvez la ligne commentée (ligne ~73):
```javascript
// const response = await fetch(`/api/fixtures.php?date=${dateStr}`);
```
3. Décommentez cette ligne et commentez la ligne de démonstration:
```javascript
const response = await fetch(`/api/fixtures.php?date=${dateStr}`);
// const response = await fetchDemoData();
```
4. Remplacez `/api/fixtures.php` par l'URL complète de votre fichier PHP

### Étape 3: Intégration dans votre application

**Pour une application React:**
```javascript
import FootballScores from './football-scores';

function Sidebar() {
  return (
    <div className="sidebar">
      <FootballScores />
    </div>
  );
}
```

**Pour un site HTML:**
```html
<!DOCTYPE html>
<html>
<head>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="football-scores.jsx"></script>
</body>
</html>
```

## 🔧 Configuration avancée

### Filtrer par championnat
Modifiez l'URL dans fixtures.php pour filtrer:
```php
$apiUrl = "https://api-football-v1.p.rapidapi.com/v3/fixtures?date=" . $date . "&league=39"; // Premier League uniquement
```

### Ajouter un cache
Pour optimiser les appels API:
```php
// Début du fichier fixtures.php
$cacheFile = 'cache/fixtures_' . $date . '.json';
$cacheTime = 60; // 60 secondes

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
    echo file_get_contents($cacheFile);
    exit;
}

// ... après curl_exec($curl)
file_put_contents($cacheFile, $response);
```

### Actualisation automatique
Dans le composant React, ajoutez un intervalle:
```javascript
useEffect(() => {
  const interval = setInterval(() => {
    fetchFixtures();
  }, 30000); // Actualise toutes les 30 secondes
  
  return () => clearInterval(interval);
}, []);
```

## 🎨 Personnalisation

### Modifier les couleurs
Le composant utilise Tailwind CSS. Modifiez les classes:
```javascript
// Fond sombre
className="bg-gray-950" → className="bg-slate-900"

// Couleur d'accent
className="text-blue-400" → className="text-green-400"
```

### Ajuster la largeur de la barre latérale
```javascript
<div className="bg-gray-950 text-white min-h-screen w-full">
// Changez w-full en w-96 pour une largeur fixe de 384px
```

## 🔍 Dépannage

### Erreur "Failed to fetch"
- Vérifiez que le fichier PHP est accessible
- Contrôlez les headers CORS dans fixtures.php
- Testez l'URL PHP directement dans le navigateur

### Pas de données affichées
- Vérifiez que votre clé API RapidAPI est valide
- Consultez les limites de votre plan API (nombre de requêtes)
- Vérifiez la console du navigateur pour les erreurs

### Images manquantes
- L'API Football retourne parfois des URLs d'images cassées
- Ajoutez un placeholder par défaut:
```javascript
<img 
  src={logo || '/placeholder-team.png'} 
  alt={name}
  onError={(e) => e.target.src = '/placeholder-team.png'}
/>
```

## 📊 Limites de l'API

Plan gratuit RapidAPI:
- 100 requêtes / jour
- 1 requête / seconde
- Données en temps réel limitées

**Conseil:** Implémentez un système de cache pour optimiser l'utilisation.

## 🔐 Sécurité

✅ **À faire:**
- Stocker la clé API dans des variables d'environnement
- Limiter les origines CORS autorisées
- Implémenter un rate limiting
- Valider toutes les entrées utilisateur

❌ **À ne pas faire:**
- Exposer la clé API côté client
- Permettre CORS depuis n'importe quelle origine en production
- Stocker la clé dans le code source versionné

## 📱 Responsive

Le composant est optimisé pour:
- Barre latérale (320px - 400px)
- Écran mobile (portrait)
- Tablet (en pleine largeur)

## 🆘 Support

Pour toute question sur:
- L'API Football: https://www.api-football.com/documentation-v3
- React: https://react.dev
- Tailwind CSS: https://tailwindcss.com

## 📝 Notes

La version actuelle utilise des données de démonstration pour tester l'interface sans backend. Pour utiliser les vraies données, suivez les étapes d'installation ci-dessus.
