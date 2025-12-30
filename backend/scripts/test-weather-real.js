const axios = require('axios');
// Mock express router to allow requiring the file
const express = { Router: () => ({ get: () => {}, post: () => {} }) };
const originalRequire = require('module').prototype.require;

// Hack pour importer weather.js qui fait un require('express')
// On va plutôt copier la classe WeatherService pour le test pour éviter les dépendances express
require('dotenv').config();

class WeatherService {
  constructor() {
    this.cache = new Map(); 
    this.cacheExpiry = 6 * 60 * 60 * 1000;
    this.rapidApiKey = process.env.RAPIDAPI_KEY || 'c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7';
    this.rapidApiHost = 'open-weather13.p.rapidapi.com';
    
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

  async getWeatherData(city = 'Libreville') {
    console.log(`🌤️ TEST: Récupération météo pour ${city}`);
    const coordinates = this.cityCoordinates[city];
    
    try {
      console.log(`   API: https://${this.rapidApiHost}/latlon`);
      console.log(`   Params:`, coordinates);
      
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

      console.log('   ✅ Réponse API reçue');
      console.log('   Données brutes:', JSON.stringify(response.data).substring(0, 200) + '...');
      
      return response.data;

    } catch (error) {
      console.error(`   ❌ Erreur API:`, error.message);
      if (error.response) {
          console.error('   Status:', error.response.status);
          console.error('   Body:', JSON.stringify(error.response.data));
      }
      return null;
    }
  }
}

async function test() {
    const service = new WeatherService();
    
    console.log('--- TEST LIBREVILLE ---');
    await service.getWeatherData('Libreville');
    
    console.log('\n--- TEST OYEM ---');
    await service.getWeatherData('Oyem');
}

test();
