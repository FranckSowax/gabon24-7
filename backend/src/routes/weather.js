const express = require('express');
const axios = require('axios');
require('dotenv').config();

// Service météo avec cache pour limiter les consultations
class WeatherService {
  constructor() {
    this.cache = new Map(); // Cache des données météo
    this.cacheExpiry = 2.4 * 60 * 60 * 1000; // 2h24 = ~10 appels/jour par ville
    this.rapidApiKey = process.env.RAPIDAPI_KEY;
    this.rapidApiHost = 'open-weather13.p.rapidapi.com';
    this.openWeatherKey = process.env.OPENWEATHER_API_KEY;
    
    if (this.openWeatherKey) {
      console.log('✅ OPENWEATHER_API_KEY configurée - Service météo actif');
    } else if (this.rapidApiKey) {
      console.log('✅ RAPIDAPI_KEY configurée - Service météo actif (RapidAPI)');
    } else {
      console.warn('⚠️ Aucune clé API météo configurée - Mode fallback activé');
    }
    
    // Coordonnées GPS précises des villes gabonaises (Mise à jour 03/12/2025)
    this.cityCoordinates = {
      'Libreville': { latitude: 0.4162, longitude: 9.4673 },
      'Oyem': { latitude: 1.6171, longitude: 11.5704 },
      'Port-Gentil': { latitude: -0.7193, longitude: 8.7815 },
      'Franceville': { latitude: -1.6333, longitude: 13.5836 }
    };
  }

  getCacheKey(city) {
    return `weather_${city}`;
  }

  isCacheValid(timestamp) {
    return Date.now() - timestamp < this.cacheExpiry;
  }

  async getWeatherData(city = 'Libreville') {
    const cacheKey = this.getCacheKey(city);
    const cached = this.cache.get(cacheKey);
    
    // Vérifier si les données en cache sont encore valides
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`📋 Cache hit pour ${city} - données récupérées du cache (expire dans ${Math.round((this.cacheExpiry - (Date.now() - cached.timestamp)) / 60000)} min)`);
      return cached.data;
    }
    
    const coordinates = this.cityCoordinates[city] || this.cityCoordinates['Libreville'];
    
    // Essayer OpenWeatherMap en priorité si la clé est configurée
    if (this.openWeatherKey) {
      try {
        console.log(`🌤️ Récupération météo pour ${city} via OpenWeatherMap`);
        const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
          params: {
            lat: coordinates.latitude,
            lon: coordinates.longitude,
            appid: this.openWeatherKey,
            units: 'metric',
            lang: 'fr'
          },
          timeout: 10000
        });

        const data = response.data;
        const weatherData = {
          city: city,
          temperature: Math.round(data.main?.temp || 27),
          feels_like: Math.round(data.main?.feels_like || 29),
          weather_condition: data.weather?.[0]?.main || 'Variable',
          weather_description: data.weather?.[0]?.description || 'Ciel variable',
          weather_icon: data.weather?.[0]?.icon || '02d',
          humidity: data.main?.humidity || 80,
          wind_speed: data.wind?.speed || 5,
          pressure: data.main?.pressure || 1013,
          visibility: data.visibility || 10000,
          uv_index: 6
        };

        // Mettre en cache pour 12 heures
        this.cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
        console.log(`✅ Météo ${city}: ${weatherData.temperature}°C - ${weatherData.weather_description}`);
        return weatherData;

      } catch (error) {
        console.error(`❌ Erreur OpenWeatherMap pour ${city}:`, error.message);
      }
    }
    
    // Fallback sur RapidAPI si OpenWeatherMap échoue ou n'est pas configuré
    if (this.rapidApiKey) {
      try {
        console.log(`🌤️ Fallback RapidAPI pour ${city}`);
        const response = await axios.get(`https://${this.rapidApiHost}/latlon`, {
          params: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            lang: 'FR'
          },
          headers: {
            'x-rapidapi-key': this.rapidApiKey,
            'x-rapidapi-host': this.rapidApiHost
          },
          timeout: 10000
        });

        const data = response.data;
        const tempK = data.main?.temp || 300;
        const tempC = tempK > 200 ? Math.round(tempK - 273.15) : Math.round(tempK);
        const feelsLikeK = data.main?.feels_like || 300;
        const feelsLikeC = feelsLikeK > 200 ? Math.round(feelsLikeK - 273.15) : Math.round(feelsLikeK);

        const weatherData = {
          city: city,
          temperature: tempC,
          feels_like: feelsLikeC,
          weather_condition: data.weather?.[0]?.main || 'Variable',
          weather_description: data.weather?.[0]?.description || 'Ciel variable',
          weather_icon: data.weather?.[0]?.icon || '02d',
          humidity: data.main?.humidity || 80,
          wind_speed: data.wind?.speed || 5,
          pressure: data.main?.pressure || 1013,
          visibility: data.visibility || 10000,
          uv_index: 6
        };

        this.cache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
        return weatherData;

      } catch (error) {
        console.error(`❌ Erreur RapidAPI Météo pour ${city}:`, error.message);
      }
    }
    
    // Fallback sur données simulées
    console.log(`⚠️ Utilisation données météo simulées pour ${city}`);
    return this.getSimulatedWeatherData(city);
  }

  // Méthode de secours (ancien getWeatherData logique simulée)
  getSimulatedWeatherData(city) {
    // Déterminer si c'est le jour ou la nuit (heure locale Gabon UTC+1)
    const now = new Date();
    const gabonTime = new Date(now.getTime() + (1 * 60 * 60 * 1000)); // UTC+1
    const hour = gabonTime.getHours();
    const isNight = hour < 6 || hour >= 19; // Nuit entre 19h et 6h
    
    // Données météo spécifiques par ville
    const cityWeatherData = {
      'Libreville': {
        temp: 27, feels_like: 30, humidity: 85, wind: 3.2, pressure: 1012,
        conditions: { day: 'Partiellement nuageux', night: 'Nuit nuageuse' },
        icons: { day: '02d', night: '02n' }
      },
      'Port-Gentil': {
        temp: 26, feels_like: 29, humidity: 88, wind: 4.1, pressure: 1011,
        conditions: { day: 'Temps humide', night: 'Nuit humide' },
        icons: { day: '10d', night: '10n' }
      },
      'Oyem': {
        temp: 24, feels_like: 27, humidity: 82, wind: 2.8, pressure: 1015,
        conditions: { day: 'Averses éparses', night: 'Nuit pluvieuse' },
        icons: { day: '09d', night: '09n' }
      },
      'Franceville': {
        temp: 25, feels_like: 28, humidity: 78, wind: 2.5, pressure: 1016,
        conditions: { day: 'Ciel dégagé', night: 'Nuit claire' },
        icons: { day: '01d', night: '01n' }
      }
    };

    // Récupérer les données de la ville ou utiliser Libreville par défaut
    const cityData = cityWeatherData[city] || cityWeatherData['Libreville'];
    
    // Adapter selon l'heure
    const weatherDescription = isNight ? cityData.conditions.night : cityData.conditions.day;
    const weatherIcon = isNight ? cityData.icons.night : cityData.icons.day;
    
    return {
      city: city,
      temperature: cityData.temp,
      feels_like: cityData.feels_like,
      weather_condition: 'variable',
      weather_description: weatherDescription,
      weather_icon: weatherIcon,
      humidity: cityData.humidity,
      wind_speed: cityData.wind,
      pressure: cityData.pressure,
      visibility: 10000,
      uv_index: isNight ? 0 : Math.floor(Math.random() * 3) + 4 // 4-6 le jour
    };
  }

  // Traite les données de prévision (OpenWeatherMap ou RapidAPI)
  processForecastData(city, list, isKelvin = false) {
    const dailyForecasts = [];
    const sortedList = list.sort((a, b) => a.dt - b.dt);

    for (const item of sortedList) {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      const hours = date.getHours();
      const existingIndex = dailyForecasts.findIndex(d => new Date(d.dt * 1000).toDateString() === dateKey);

      if (existingIndex !== -1) {
        const existingHours = new Date(dailyForecasts[existingIndex].dt * 1000).getHours();
        if (Math.abs(hours - 12) < Math.abs(existingHours - 12)) {
          dailyForecasts[existingIndex] = item;
        }
      } else {
        dailyForecasts.push(item);
      }
    }

    return {
      city: city,
      forecasts: dailyForecasts.slice(0, 5).map(item => {
        let temp = item.main?.temp || 27;
        let feelsLike = item.main?.feels_like || 29;
        if (isKelvin && temp > 200) {
          temp = Math.round(temp - 273.15);
          feelsLike = Math.round(feelsLike - 273.15);
        } else {
          temp = Math.round(temp);
          feelsLike = Math.round(feelsLike);
        }
        return {
          dt: item.dt,
          date: new Date(item.dt * 1000).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' }),
          temperature: temp,
          feels_like: feelsLike,
          description: item.weather?.[0]?.description || 'Variable',
          icon: item.weather?.[0]?.icon || '02d',
          humidity: item.main?.humidity || 80,
          wind_speed: item.wind?.speed || 5,
          pressure: item.main?.pressure || 1013
        };
      })
    };
  }

  async getFiveDayForecast(city = 'Libreville') {
    const forecastCacheKey = `forecast_${city}`;
    const cached = this.cache.get(forecastCacheKey);
    
    // Vérifier si les données en cache sont encore valides
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`📋 Cache hit pour prévisions ${city} - données récupérées du cache`);
      return cached.data;
    }

    const coordinates = this.cityCoordinates[city] || this.cityCoordinates['Libreville'];
    
    // Essayer OpenWeatherMap en priorité
    if (this.openWeatherKey) {
      try {
        console.log(`🌤️ Récupération prévisions 5 jours pour ${city} via OpenWeatherMap`);
        const response = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
          params: {
            lat: coordinates.latitude,
            lon: coordinates.longitude,
            appid: this.openWeatherKey,
            units: 'metric',
            lang: 'fr'
          },
          timeout: 10000
        });

        if (response.data && response.data.list) {
          const forecastData = this.processForecastData(city, response.data.list, false);
          this.cache.set(forecastCacheKey, { data: forecastData, timestamp: Date.now() });
          console.log(`✅ Prévisions ${city}: ${forecastData.forecasts.length} jours récupérés`);
          return forecastData;
        }
      } catch (error) {
        console.error(`❌ Erreur OpenWeatherMap prévisions pour ${city}:`, error.message);
      }
    }
    
    // Fallback sur RapidAPI
    if (this.rapidApiKey) {
      try {
        console.log(`🌤️ Fallback RapidAPI prévisions pour ${city}`);
        const response = await axios.get('https://open-weather13.p.rapidapi.com/fivedaysforcast', {
          params: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            lang: 'FR'
          },
          headers: {
            'x-rapidapi-key': this.rapidApiKey,
            'x-rapidapi-host': this.rapidApiHost
          },
          timeout: 10000
        });

        if (response.data && response.data.list) {
          const forecastData = this.processForecastData(city, response.data.list, true);
          this.cache.set(forecastCacheKey, { data: forecastData, timestamp: Date.now() });
          return forecastData;
        }
      } catch (error) {
        console.error(`❌ Erreur RapidAPI prévisions pour ${city}:`, error.message);
      }
    }

    // Fallback avec données simulées
    const fallbackForecasts = {
      city: city,
      forecasts: Array.from({ length: 5 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dt = Math.floor(date.getTime() / 1000);
        const cityData = this.getSimulatedWeatherData(city);
        
        return {
          dt: dt,
          date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' }),
          temperature: cityData.temperature + Math.floor(Math.random() * 4 - 2), // Variation ±2°C
          feels_like: cityData.feels_like + Math.floor(Math.random() * 4 - 2),
          description: cityData.weather_description,
          icon: cityData.weather_icon,
          humidity: cityData.humidity + Math.floor(Math.random() * 10 - 5),
          wind_speed: cityData.wind_speed + Math.random() * 2 - 1,
          pressure: cityData.pressure + Math.floor(Math.random() * 10 - 5)
        };
      })
    };

    // Mettre en cache les données de fallback
    this.cache.set(forecastCacheKey, {
      data: fallbackForecasts,
      timestamp: Date.now()
    });

    return fallbackForecasts;
  }
}

const router = express.Router();
const weatherService = new WeatherService();

/**
 * GET /api/weather/:city
 * Récupère les données météo pour une ville
 */
router.get('/:city', async (req, res) => {
  try {
    const { city } = req.params;
    
    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Nom de ville requis'
      });
    }

    const weatherData = await weatherService.getWeatherData(city);
    
    if (!weatherData) {
      return res.status(404).json({
        success: false,
        error: 'Données météo non disponibles',
        fallback: {
          city: city,
          temperature: 27,
          weather_condition: 'clear',
          weather_description: 'Temps ensoleillé',
          humidity: 75,
          wind_speed: 5.2
        }
      });
    }

    res.json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    console.error('Erreur route météo:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      fallback: {
        city: req.params.city || 'Libreville',
        temperature: 27,
        weather_condition: 'clear',
        weather_description: 'Temps ensoleillé',
        humidity: 75,
        wind_speed: 5.2
      }
    });
  }
});

/**
 * GET /api/weather
 * Récupère les données météo pour Libreville par défaut
 */
router.get('/', async (req, res) => {
  try {
    const weatherData = await weatherService.getWeatherData('Libreville');
    
    if (!weatherData) {
      return res.status(404).json({
        success: false,
        error: 'Données météo non disponibles',
        fallback: {
          city: 'Libreville',
          temperature: 27,
          weather_condition: 'clear',
          weather_description: 'Temps ensoleillé',
          humidity: 75,
          wind_speed: 5.2
        }
      });
    }

    res.json({
      success: true,
      data: weatherData
    });
  } catch (error) {
    console.error('Erreur route météo par défaut:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      fallback: {
        city: 'Libreville',
        temperature: 27,
        weather_condition: 'clear',
        weather_description: 'Temps ensoleillé',
        humidity: 75,
        wind_speed: 5.2
      }
    });
  }
});

/**
 * POST /api/weather/update
 * Force la mise à jour des données météo (pour le cron job)
 */
router.post('/update', async (req, res) => {
  try {
    const cities = req.body.cities || ['Libreville', 'Port-Gentil', 'Franceville'];
    
    await weatherService.updateWeatherData(cities);
    
    res.json({
      success: true,
      message: 'Mise à jour météo terminée',
      cities: cities
    });
  } catch (error) {
    console.error('Erreur mise à jour météo:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour'
    });
  }
});

/**
 * GET /api/weather/:city/forecast
 * Récupère les prévisions 5 jours pour une ville
 */
router.get('/:city/forecast', async (req, res) => {
  try {
    const { city } = req.params;
    
    if (!city) {
      return res.status(400).json({
        success: false,
        error: 'Nom de ville requis'
      });
    }

    const forecastData = await weatherService.getFiveDayForecast(city);
    
    if (!forecastData) {
      return res.status(404).json({
        success: false,
        error: 'Prévisions météo non disponibles'
      });
    }

    res.json({
      success: true,
      data: forecastData
    });

  } catch (error) {
    console.error('❌ Erreur récupération prévisions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des prévisions'
    });
  }
});

/**
 * GET /api/weather/all/cities
 * Récupère la météo actuelle pour les 4 villes du widget
 */
router.get('/all/cities', async (req, res) => {
  try {
    const cities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem'];
    const results = await Promise.all(
      cities.map(async (city) => {
        const data = await weatherService.getWeatherData(city);
        return { city, ...data };
      })
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('❌ Erreur récupération météo toutes villes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/weather/all/forecasts
 * Récupère les prévisions 5 jours pour les 4 villes du widget
 */
router.get('/all/forecasts', async (req, res) => {
  try {
    const cities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem'];
    const results = await Promise.all(
      cities.map(async (city) => {
        const data = await weatherService.getFiveDayForecast(city);
        return data;
      })
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('❌ Erreur récupération prévisions toutes villes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
