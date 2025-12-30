# Documentation RapidAPI Open Weather 13 - Référence

## Configuration de base

### Endpoints principaux
```
Météo actuelle: https://open-weather13.p.rapidapi.com/latlon
Prévisions 5 jours: https://open-weather13.p.rapidapi.com/fivedaysforcast
```

### Headers requis
```javascript
const headers = {
  'X-RapidAPI-Key': 'c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7',
  'X-RapidAPI-Host': 'open-weather13.p.rapidapi.com'
};
```

### Paramètres requis
- `latitude` : Latitude de la ville
- `longitude` : Longitude de la ville  
- `lang` : FR (français)

### Coordonnées des villes gabonaises
```javascript
const CITIES_COORDINATES = {
  'Libreville': { lat: 0.4162, lon: 9.4673 },
  'Port-Gentil': { lat: -0.7193, lon: 8.7815 },
  'Oyem': { lat: 1.5993, lon: 11.5804 },
  'Franceville': { lat: -1.6323, lon: 13.5847 }
};
```

## Structure de la réponse API

### Données météo actuelles (/latlon)
```json
{
  "coord": {
    "lon": 9.47,
    "lat": 0.42
  },
  "weather": [
    {
      "id": 802,
      "main": "Clouds",
      "description": "partiellement nuageux",
      "icon": "03d"
    }
  ],
  "base": "stations",
  "main": {
    "temp": 28.5,
    "feels_like": 31.2,
    "temp_min": 26.1,
    "temp_max": 30.8,
    "pressure": 1013,
    "humidity": 78
  },
  "visibility": 10000,
  "wind": {
    "speed": 2.5,
    "deg": 180
  },
  "clouds": {
    "all": 75
  },
  "dt": 1609459200,
  "sys": {
    "type": 1,
    "id": 1234,
    "country": "GA",
    "sunrise": 1609441500,
    "sunset": 1609482993
  },
  "timezone": 3600,
  "id": 2399697,
  "name": "Libreville",
  "cod": 200
}
```

### Prévisions 5 jours (/fivedaysforcast)
```json
{
  "cod": "200",
  "message": 0,
  "cnt": 40,
  "list": [
    {
      "dt": 1609459200,
      "main": {
        "temp": 28.5,
        "feels_like": 31.2,
        "temp_min": 26.1,
        "temp_max": 30.8,
        "pressure": 1013,
        "sea_level": 1013,
        "grnd_level": 1013,
        "humidity": 78,
        "temp_kf": 0
      },
      "weather": [
        {
          "id": 500,
          "main": "Rain",
          "description": "légère pluie",
          "icon": "10d"
        }
      ],
      "clouds": {
        "all": 75
      },
      "wind": {
        "speed": 2.5,
        "deg": 180,
        "gust": 3.1
      },
      "visibility": 10000,
      "pop": 0.6,
      "rain": {
        "3h": 2.1
      },
      "sys": {
        "pod": "d"
      },
      "dt_txt": "2021-01-01 12:00:00"
    }
  ],
  "city": {
    "id": 2399697,
    "name": "Libreville",
    "coord": {
      "lat": 0.4162,
      "lon": 9.4673
    },
    "country": "GA",
    "population": 703904,
    "timezone": 3600,
    "sunrise": 1609441500,
    "sunset": 1609482993
  }
}
```

## Codes d'icônes météo

### Mapping des icônes
```javascript
const WEATHER_ICONS = {
  '01d': '☀️', // clear sky day
  '01n': '🌙', // clear sky night
  '02d': '🌤️', // few clouds day
  '02n': '☁️', // few clouds night
  '03d': '☁️', // scattered clouds
  '03n': '☁️', // scattered clouds
  '04d': '☁️', // broken clouds
  '04n': '☁️', // broken clouds
  '09d': '🌧️', // shower rain
  '09n': '🌧️', // shower rain
  '10d': '🌦️', // rain day
  '10n': '🌧️', // rain night
  '11d': '⛈️', // thunderstorm
  '11n': '⛈️', // thunderstorm
  '13d': '❄️', // snow
  '13n': '❄️', // snow
  '50d': '🌫️', // mist
  '50n': '🌫️'  // mist
};
```

## Fonctions utilitaires

### Formatage de la température
```javascript
function formatTemperature(temp) {
  return Math.round(temp) + '°';
}
```

### Formatage de la date/heure
```javascript
function formatTime(timestamp, timezone) {
  return new Date(timestamp * 1000).toLocaleTimeString('fr-FR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(timestamp, timezone) {
  return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}
```

### Traduction des conditions météo
```javascript
const WEATHER_TRANSLATIONS = {
  'clear sky': 'ciel dégagé',
  'few clouds': 'quelques nuages',
  'scattered clouds': 'nuages épars',
  'broken clouds': 'nuageux',
  'shower rain': 'averses',
  'rain': 'pluie',
  'thunderstorm': 'orage',
  'snow': 'neige',
  'mist': 'brume'
};
```

### Gestion du cache avec consultation programmée
```javascript
const CACHE_CONFIG = {
  MORNING_UPDATE: 6 * 60 * 60 * 1000, // 6h du matin
  CACHE_DURATION: 6 * 60 * 60 * 1000, // 6 heures
  DAY_CHECK_INTERVAL: 3 * 60 * 60 * 1000 // Vérification toutes les 3h
};

function getCachedWeather(cityKey) {
  const cached = localStorage.getItem(`weather_${cityKey}`);
  if (!cached) return null;
  
  const { current, forecast, lastUpdate } = JSON.parse(cached);
  const now = Date.now();
  
  // Vérifier si les données sont encore valides
  const morningCacheValid = now - lastUpdate < CACHE_CONFIG.CACHE_DURATION;
  const isMorningUpdate = isTimeBetween(lastUpdate, 6, 9); // Mis à jour entre 6h et 9h
  
  if (morningCacheValid || isMorningUpdate) {
    return { current, forecast, lastUpdate, fromCache: true };
  }
  
  return null;
}

function setCachedWeather(cityKey, current, forecast) {
  const weatherData = {
    current,
    forecast,
    lastUpdate: Date.now(),
    updateType: getCurrentHour() === 6 ? 'morning' : 'ondemand'
  };
  
  localStorage.setItem(`weather_${cityKey}`, JSON.stringify(weatherData));
}

// Fonction pour vérifier si c'est l'heure de mise à jour du matin
function isMorningUpdateTime() {
  const now = new Date();
  const hour = now.getHours();
  return hour === 6; // 6h du matin
}

// Planificateur de mise à jour automatique
function setupMorningScheduler() {
  const checkMorningUpdate = () => {
    if (isMorningUpdateTime()) {
      console.log('🌅 Mise à jour météo matinale programmée');
      updateAllCitiesWeather('morning');
    }
  };
  
  // Vérifier toutes les heures
  setInterval(checkMorningUpdate, 60 * 60 * 1000);
  
  // Vérifier immédiatement au chargement
  checkMorningUpdate();
}

// Fonction principale de mise à jour
async function updateAllCitiesWeather(updateType = 'ondemand') {
  const updatePromises = GABON_CITIES.map(async (city) => {
    try {
      console.log(`🔄 Mise à jour ${updateType} pour ${city.name}`);
      
      // Récupérer météo actuelle et prévisions
      const [currentWeather, forecast] = await Promise.all([
        fetchCurrentWeather(city.lat, city.lon),
        fetchFiveDaysForecast(city.lat, city.lon)
      ]);
      
      if (currentWeather && forecast) {
        setCachedWeather(city.name, currentWeather, forecast);
        console.log(`✅ ${city.name} mise à jour avec succès`);
      }
    } catch (error) {
      console.error(`❌ Erreur mise à jour ${city.name}:`, error);
    }
  });
  
  await Promise.allSettled(updatePromises);
}
```

## Gestion d'erreurs

### Codes d'erreur API
- `400` : Bad Request (paramètres manquants)
- `401` : Unauthorized (clé API invalide)
- `404` : Not Found (ville non trouvée)
- `429` : Too Many Requests (quota dépassé)
- `500` : Internal Server Error

### Fonction de gestion d'erreurs
```javascript
function handleWeatherError(error) {
  const errorMessages = {
    400: 'Paramètres de requête invalides',
    401: 'Clé RapidAPI invalide ou expirée',
    403: 'Accès interdit - quota dépassé',
    404: 'Données météo non disponibles pour cette ville',
    429: 'Trop de requêtes - limite atteinte',
    500: 'Erreur du serveur météo',
    default: 'Impossible de récupérer les données météo'
  };
  
  const status = error.status || 'default';
  return errorMessages[status] || errorMessages.default;
}

// Fonction pour basculer en mode dégradé
function getFallbackWeather(cityName) {
  const fallbackData = GABON_DEFAULT_WEATHER[cityName];
  return {
    ...fallbackData,
    isOffline: true,
    lastUpdate: Date.now(),
    message: 'Données en mode hors-ligne'
  };
}
```

## Optimisations pour le Gabon

### Données par défaut (mode offline)
```javascript
const GABON_DEFAULT_WEATHER = {
  'Libreville': {
    temp: 27,
    humidity: 85,
    description: 'Partiellement nuageux',
    icon: '02d'
  },
  'Port-Gentil': {
    temp: 26,
    humidity: 88,
    description: 'Nuageux',
    icon: '04d'
  },
  'Oyem': {
    temp: 25,
    humidity: 82,
    description: 'Averses éparses',
    icon: '09d'
  },
  'Franceville': {
    temp: 24,
    humidity: 80,
    description: 'Ciel dégagé',
    icon: '01d'
  }
};
```

### Détection de connexion
```javascript
function isOnline() {
  return navigator.onLine && 
         window.navigator.connection?.effectiveType !== 'slow-2g';
}
```

## URL complètes d'exemple

### Météo actuelle
```
https://open-weather13.p.rapidapi.com/latlon?latitude=0.4162&longitude=9.4673&lang=FR
```

### Prévisions 5 jours
```
https://open-weather13.p.rapidapi.com/fivedaysforcast?latitude=0.4162&longitude=9.4673&lang=FR
```

## Stratégie d'optimisation pour consultation

### Schéma de mise à jour
1. **6h00 du matin** : Mise à jour automatique de toutes les villes
2. **Journée** : Utilisation du cache (valide 6h)
3. **À la demande** : Mise à jour si cache expiré ou utilisateur force

### Indicateurs de fraîcheur des données
```javascript
function getDataFreshnessInfo(lastUpdate) {
  const now = Date.now();
  const diffMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
  
  if (diffMinutes < 60) {
    return {
      status: 'fresh',
      message: `Mis à jour il y a ${diffMinutes} min`,
      color: '#00b894'
    };
  } else if (diffMinutes < 360) { // 6h
    const diffHours = Math.floor(diffMinutes / 60);
    return {
      status: 'valid',
      message: `Mis à jour il y a ${diffHours}h`,
      color: '#fdcb6e'
    };
  } else {
    return {
      status: 'stale',
      message: 'Données anciennes',
      color: '#e17055'
    };
  }
}
```

## Limites de l'API RapidAPI
- **Quotas variables** selon l'abonnement
- **Rate limiting** : Attention aux requêtes trop fréquentes
- **Données historiques** : Non disponibles sur cette API
- **Résolution** : Données actuelles + prévisions 5 jours (intervalles 3h)