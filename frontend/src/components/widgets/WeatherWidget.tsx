'use client';

import React, { useState, useEffect } from 'react';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import axios from 'axios';
import { 
  Sun, Moon, Cloud, CloudRain, CloudLightning, Wind, 
  Droplets, Thermometer, MapPin, RefreshCw, ChevronRight
} from 'lucide-react';

interface WeatherData {
  temp: number;
  feels_like: number;
  humidity: number;
  description: string;
  icon: string;
  city: string;
  wind_speed: number;
  pressure: number;
  visibility?: number;
  uvIndex?: number;
  lastUpdate: number;
  isOffline?: boolean;
}

interface ForecastItem {
  dt: number;
  temp: number;
  temp_max?: number;
  temp_min?: number;
  description: string;
  icon: string;
  pop: number;
}

const GABON_CITIES = [
  { name: 'Libreville', province: 'Estuaire' },
  { name: 'Port-Gentil', province: 'Ogooué-Maritime' },
  { name: 'Oyem', province: 'Woleu-Ntem' },
  { name: 'Franceville', province: 'Haut-Ogooué' }
];

// Composant d'icône météo simple sans animation
const WeatherIcon = ({ icon, size = 'lg' }: { icon: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14'
  };
  
  const iconMap: { [key: string]: React.ReactNode } = {
    '01d': <Sun className={`${sizeClasses[size]} text-amber-400`} />,
    '01n': <Moon className={`${sizeClasses[size]} text-indigo-300`} />,
    '02d': <Cloud className={`${sizeClasses[size]} text-gray-400`} />,
    '02n': <Cloud className={`${sizeClasses[size]} text-gray-500`} />,
    '03d': <Cloud className={`${sizeClasses[size]} text-gray-400`} />,
    '03n': <Cloud className={`${sizeClasses[size]} text-gray-500`} />,
    '04d': <Cloud className={`${sizeClasses[size]} text-gray-500`} />,
    '04n': <Cloud className={`${sizeClasses[size]} text-gray-600`} />,
    '09d': <CloudRain className={`${sizeClasses[size]} text-blue-400`} />,
    '09n': <CloudRain className={`${sizeClasses[size]} text-blue-500`} />,
    '10d': <CloudRain className={`${sizeClasses[size]} text-blue-400`} />,
    '10n': <CloudRain className={`${sizeClasses[size]} text-blue-500`} />,
    '11d': <CloudLightning className={`${sizeClasses[size]} text-yellow-500`} />,
    '11n': <CloudLightning className={`${sizeClasses[size]} text-yellow-400`} />,
  };
  
  return iconMap[icon] || <Sun className={`${sizeClasses[size]} text-amber-400`} />;
};

const GABON_DEFAULT_WEATHER: { [key: string]: WeatherData } = {
  'Libreville': {
    temp: 27, feels_like: 30, humidity: 85, description: 'Partiellement nuageux',
    icon: '02d', city: 'Libreville', wind_speed: 3.2, pressure: 1012, lastUpdate: Date.now(), isOffline: true
  },
  'Port-Gentil': {
    temp: 26, feels_like: 29, humidity: 88, description: 'Temps humide',
    icon: '10d', city: 'Port-Gentil', wind_speed: 4.1, pressure: 1011, lastUpdate: Date.now(), isOffline: true
  },
  'Oyem': {
    temp: 24, feels_like: 27, humidity: 82, description: 'Averses éparses',
    icon: '09d', city: 'Oyem', wind_speed: 2.8, pressure: 1015, lastUpdate: Date.now(), isOffline: true
  },
  'Franceville': {
    temp: 25, feels_like: 28, humidity: 78, description: 'Ciel dégagé',
    icon: '01d', city: 'Franceville', wind_speed: 2.5, pressure: 1016, lastUpdate: Date.now(), isOffline: true
  }
};

// Configuration API - Utilise le backend pour proxy les requêtes météo
// La clé API est stockée côté serveur pour la sécurité
const API_CONFIG = {
  useBackendProxy: true, // Utiliser le backend au lieu d'appeler directement RapidAPI
  host: 'open-weather13.p.rapidapi.com',
  baseUrl: 'https://open-weather13.p.rapidapi.com'
};

export function WeatherWidget() {
  const [selectedCity, setSelectedCity] = useState('Libreville');
  // Initialiser avec les données par défaut pour afficher immédiatement
  const [weatherData, setWeatherData] = useState<WeatherData>(GABON_DEFAULT_WEATHER['Libreville']);
  const [forecast, setForecast] = useState<ForecastItem[]>([
    { dt: Date.now() / 1000, temp: 27, temp_max: 29, temp_min: 24, description: 'Ensoleillé', icon: '01d', pop: 0.1 },
    { dt: (Date.now() / 1000) + 86400, temp: 26, temp_max: 28, temp_min: 23, description: 'Partiellement nuageux', icon: '02d', pop: 0.3 },
    { dt: (Date.now() / 1000) + 172800, temp: 25, temp_max: 27, temp_min: 22, description: 'Averses', icon: '10d', pop: 0.7 },
    { dt: (Date.now() / 1000) + 259200, temp: 28, temp_max: 30, temp_min: 25, description: 'Orageux', icon: '11d', pop: 0.8 },
    { dt: (Date.now() / 1000) + 345600, temp: 26, temp_max: 28, temp_min: 24, description: 'Nuageux', icon: '04d', pop: 0.2 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTemperature = (temp: number): string => Math.round(temp) + '°';

  const getDataFreshnessInfo = (lastUpdate: number) => {
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastUpdate) / (1000 * 60));
    
    if (diffMinutes < 5) {
      return { status: 'fresh', message: 'maintenant', color: '#27ae60' };
    } else if (diffMinutes < 60) {
      return { status: 'recent', message: `${diffMinutes}min`, color: '#f39c12' };
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return { status: 'old', message: `${hours}h`, color: '#e74c3c' };
    } else {
      const days = Math.floor(diffMinutes / 1440);
      return { status: 'stale', message: `${days}j`, color: '#95a5a6' };
    }
  };

  const fetchWeatherData = async () => {
    setLoading(true);
    // Mettre les données par défaut immédiatement pour affichage instantané
    const defaultData = GABON_DEFAULT_WEATHER[selectedCity] || GABON_DEFAULT_WEATHER['Libreville'];
    setWeatherData(defaultData);
    
    try {
      // Récupérer les données depuis l'API backend
      const response = await axios.get(`${API_URL}/api/weather/${selectedCity}`, { timeout: 5000 });
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        const processedData: WeatherData = {
          temp: data.temperature,
          feels_like: data.feels_like || data.temperature,
          description: data.weather_description,
          humidity: data.humidity,
          wind_speed: data.wind_speed,
          pressure: data.pressure,
          visibility: Math.round((data.visibility || 10000) / 1000),
          uvIndex: data.uv_index,
          icon: data.weather_icon || '01d',
          city: selectedCity,
          lastUpdate: Date.now()
        };
        
        setWeatherData(processedData);
        
        // Mettre à jour les prévisions si disponibles
        if (response.data.forecast && Array.isArray(response.data.forecast)) {
          setForecast(response.data.forecast);
        }
      } else {
        // Utiliser les données de fallback du serveur
        const fallbackData = response.data.fallback;
        const processedData: WeatherData = {
          temp: fallbackData.temperature,
          feels_like: fallbackData.temperature,
          description: fallbackData.weather_description,
          humidity: fallbackData.humidity,
          wind_speed: fallbackData.wind_speed,
          pressure: 1013,
          visibility: 10,
          uvIndex: 0,
          icon: fallbackData.weather_icon || '01d',
          city: selectedCity,
          lastUpdate: Date.now(),
          isOffline: true
        };
        
        setWeatherData(processedData);
      }
    } catch (error) {
      console.log(`Utilisation des données météo par défaut pour ${selectedCity}`);
      console.error('Erreur météo:', error);
      // Les données par défaut sont déjà définies au début de la fonction
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
  }, [selectedCity]);

  const freshnessInfo = weatherData ? getDataFreshnessInfo(weatherData.lastUpdate) : null;

  // Gradient dynamique selon l'heure
  const getGradientByTime = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'from-amber-50 via-orange-50 to-sky-100';
    if (hour >= 12 && hour < 18) return 'from-sky-50 via-blue-50 to-indigo-100';
    if (hour >= 18 && hour < 21) return 'from-orange-100 via-rose-100 to-purple-200';
    return 'from-indigo-900 via-purple-900 to-slate-900';
  };

  const isNight = () => {
    const hour = new Date().getHours();
    return hour >= 21 || hour < 6;
  };

  return (
    <div 
      className={`rounded-3xl h-[500px] w-full overflow-hidden
        bg-gradient-to-br ${getGradientByTime()}
        ${isNight() ? 'text-white' : 'text-gray-800'}
        shadow-xl border border-white/20`}
    >
      {/* Contenu principal */}
      <div className="p-4 h-full box-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-xl ${isNight() ? 'bg-white/10' : 'bg-white/50'} flex-shrink-0`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold opacity-90">Météo Gabon</h3>
              <p className={`text-xs ${isNight() ? 'text-white/60' : 'text-gray-500'} truncate`}>
                {freshnessInfo?.message ? `Mis à jour ${freshnessInfo.message}` : 'Chargement...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchWeatherData()}
            disabled={loading}
            className={`p-1.5 sm:p-2 rounded-xl flex-shrink-0 ml-2
              ${isNight() ? 'bg-white/10 hover:bg-white/20' : 'bg-white/50 hover:bg-white/70'} 
              transition-all disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-3 mb-3">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {weatherData && (
          <div>
              {/* Zone météo principale */}
              <div className={`rounded-2xl p-3 mb-3 ${isNight() ? 'bg-white/5' : 'bg-white/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <WeatherIcon icon={weatherData.icon} size="xl" />
                    <div>
                      <div className="text-3xl font-light">
                        {formatTemperature(weatherData.temp)}
                      </div>
                      <p className={`text-sm ${isNight() ? 'text-white/70' : 'text-gray-600'}`}>
                        {weatherData.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{selectedCity}</p>
                    <p className={`text-xs ${isNight() ? 'text-white/60' : 'text-gray-500'}`}>
                      {GABON_CITIES.find(c => c.name === selectedCity)?.province}
                    </p>
                  </div>
                </div>

                {/* Stats météo */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className={`p-2 rounded-xl ${isNight() ? 'bg-white/5' : 'bg-white/30'}`}>
                    <p className={`text-xs ${isNight() ? 'text-white/60' : 'text-gray-500'}`}>Ressenti</p>
                    <p className="text-sm font-medium">{formatTemperature(weatherData.feels_like)}</p>
                  </div>
                  <div className={`p-2 rounded-xl ${isNight() ? 'bg-white/5' : 'bg-white/30'}`}>
                    <p className={`text-xs ${isNight() ? 'text-white/60' : 'text-gray-500'}`}>Humidité</p>
                    <p className="text-sm font-medium">{weatherData.humidity}%</p>
                  </div>
                  <div className={`p-2 rounded-xl ${isNight() ? 'bg-white/5' : 'bg-white/30'}`}>
                    <p className={`text-xs ${isNight() ? 'text-white/60' : 'text-gray-500'}`}>Vent</p>
                    <p className="text-sm font-medium">{weatherData.wind_speed} km/h</p>
                  </div>
                </div>
              </div>

              {/* Sélection des villes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {GABON_CITIES.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => setSelectedCity(city.name)}
                    className={`p-2 rounded-xl text-xs font-medium transition-all
                      ${selectedCity === city.name
                        ? `${isNight() ? 'bg-white/20' : 'bg-white/70'} shadow-lg`
                        : `${isNight() ? 'bg-white/5 hover:bg-white/10' : 'bg-white/30 hover:bg-white/50'}`
                      }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>

              {/* Prévisions 5 jours */}
              {forecast.length > 0 && (
                <div className={`rounded-2xl p-3 ${isNight() ? 'bg-white/5' : 'bg-white/40'}`}>
                  <p className={`text-xs font-medium mb-2 ${isNight() ? 'text-white/70' : 'text-gray-600'}`}>
                    Prévisions 5 jours
                  </p>
                  <div className="grid grid-cols-5 gap-1">
                    {forecast.slice(0, 5).map((item, index) => {
                      const date = new Date(item.dt * 1000);
                      const isToday = index === 0;
                      const dayName = isToday ? 'Auj.' : date.toLocaleDateString('fr-FR', { weekday: 'short' });
                      
                      return (
                        <div key={index} className="text-center p-1">
                          <p className={`text-xs mb-1 ${isNight() ? 'text-white/60' : 'text-gray-500'}`}>
                            {dayName}
                          </p>
                          <div className="flex justify-center mb-1">
                            <WeatherIcon icon={item.icon} size="sm" />
                          </div>
                          <p className="text-sm font-semibold">
                            {formatTemperature(item.temp_max || item.temp)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Loading state */}
        {loading && !weatherData && (
          <div className="text-center py-8">
            <Sun className="w-12 h-12 text-amber-400 animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}

export default WeatherWidget;
