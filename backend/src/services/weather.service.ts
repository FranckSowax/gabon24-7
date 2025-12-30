import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

interface WeatherData {
  city: string;
  country: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  pressure: number;
  visibility: number;
  uv_index: number;
  wind_speed: number;
  wind_direction: number;
  weather_condition: string;
  weather_description: string;
  weather_icon: string;
  sunrise: string;
  sunset: string;
  forecast: any[];
  created_at?: string;
}

export class WeatherService {
  private supabase;
  private rapidApiKey: string;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.rapidApiKey = process.env.RAPIDAPI_KEY || '';
  }

  /**
   * Récupère les données météo depuis Supabase (données les plus récentes)
   */
  async getWeatherFromDatabase(city: string): Promise<WeatherData | null> {
    try {
      const { data, error } = await this.supabase
        .from('weather_data')
        .select('*')
        .eq('city', city)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Erreur récupération météo depuis DB:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erreur service météo DB:', error);
      return null;
    }
  }

  /**
   * Vérifie si les données météo sont récentes (moins de 12 heures)
   */
  private isDataFresh(createdAt: string): boolean {
    const dataAge = Date.now() - new Date(createdAt).getTime();
    const twelveHours = 12 * 60 * 60 * 1000; // 12 heures en millisecondes
    return dataAge < twelveHours;
  }

  /**
   * Récupère les données météo depuis l'API externe RapidAPI
   */
  private async fetchWeatherFromAPI(city: string): Promise<WeatherData | null> {
    try {
      if (!this.rapidApiKey) {
        throw new Error('Clé API RapidAPI manquante');
      }

      const response = await axios.get(
        `https://open-weather13.p.rapidapi.com/city/${city}`,
        {
          headers: {
            'X-RapidAPI-Key': this.rapidApiKey,
            'X-RapidAPI-Host': 'open-weather13.p.rapidapi.com'
          },
          timeout: 10000
        }
      );

      const data = response.data;
      
      // Transformation des données API vers notre format
      const weatherData: WeatherData = {
        city: data.name || city,
        country: data.sys?.country || 'GA',
        temperature: Math.round(data.main.temp - 273.15), // Kelvin vers Celsius
        feels_like: Math.round(data.main.feels_like - 273.15),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility || 10000,
        uv_index: 0, // Non disponible dans cette API
        wind_speed: data.wind?.speed || 0,
        wind_direction: data.wind?.deg || 0,
        weather_condition: data.weather[0]?.main?.toLowerCase() || 'clear',
        weather_description: data.weather[0]?.description || '',
        weather_icon: data.weather[0]?.icon || '01d',
        sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
        sunset: new Date(data.sys.sunset * 1000).toISOString(),
        forecast: [] // À implémenter si nécessaire
      };

      return weatherData;
    } catch (error) {
      console.error('Erreur API météo externe:', error);
      return null;
    }
  }

  /**
   * Sauvegarde les données météo dans Supabase
   */
  private async saveWeatherToDatabase(weatherData: WeatherData): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('weather_data')
        .insert([weatherData]);

      if (error) {
        console.error('Erreur sauvegarde météo:', error);
        return false;
      }

      console.log(`✅ Données météo sauvegardées pour ${weatherData.city}`);
      return true;
    } catch (error) {
      console.error('Erreur service sauvegarde météo:', error);
      return false;
    }
  }

  /**
   * Récupère les données météo (depuis DB ou API si nécessaire)
   */
  async getWeatherData(city: string = 'Libreville'): Promise<WeatherData | null> {
    try {
      // 1. Essayer de récupérer depuis la base de données
      const dbData = await this.getWeatherFromDatabase(city);
      
      // 2. Si les données existent et sont fraîches (< 12h), les retourner
      if (dbData && dbData.created_at && this.isDataFresh(dbData.created_at)) {
        console.log(`📊 Utilisation données météo DB pour ${city} (${dbData.created_at})`);
        return dbData;
      }

      // 3. Sinon, récupérer depuis l'API externe
      console.log(`🌐 Récupération météo API externe pour ${city}`);
      const apiData = await this.fetchWeatherFromAPI(city);
      
      if (apiData) {
        // 4. Sauvegarder les nouvelles données
        await this.saveWeatherToDatabase(apiData);
        return apiData;
      }

      // 5. En dernier recours, retourner les anciennes données DB si disponibles
      if (dbData) {
        console.log(`⚠️ Utilisation données météo DB expirées pour ${city}`);
        return dbData;
      }

      // 6. Aucune donnée disponible
      return null;
    } catch (error) {
      console.error('Erreur service météo général:', error);
      return null;
    }
  }

  /**
   * Force la mise à jour des données météo (pour le cron job)
   */
  async updateWeatherData(cities: string[] = ['Libreville', 'Port-Gentil', 'Franceville']): Promise<void> {
    console.log('🔄 Mise à jour programmée des données météo...');
    
    for (const city of cities) {
      try {
        const apiData = await this.fetchWeatherFromAPI(city);
        if (apiData) {
          await this.saveWeatherToDatabase(apiData);
        }
        
        // Attendre 2 secondes entre chaque ville pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Erreur mise à jour météo pour ${city}:`, error);
      }
    }
    
    console.log('✅ Mise à jour météo terminée');
  }
}
