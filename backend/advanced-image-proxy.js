const axios = require('axios');
const crypto = require('crypto');

/**
 * 🖼️ PROXY D'IMAGES AVANCÉ
 * Taux de succès cible: 95%+
 */

class AdvancedImageProxy {
  constructor() {
    // Cache en mémoire pour les images fréquentes
    this.cache = new Map();
    this.MAX_CACHE_SIZE = 500;
    this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
    
    // Statistiques
    this.stats = {
      total: 0,
      success: 0,
      cached: 0,
      failed: 0,
      facebook: 0
    };
  }

  /**
   * 📊 Obtenir les statistiques
   */
  getStats() {
    const successRate = this.stats.total > 0 
      ? ((this.stats.success / this.stats.total) * 100).toFixed(1)
      : 0;
      
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      cacheSize: this.cache.size
    };
  }

  /**
   * 🔑 Générer clé de cache
   */
  getCacheKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * 🖼️ Proxy d'image principal
   */
  async proxyImage(url, res) {
    this.stats.total++;
    
    try {
      // 1. Vérifier le cache
      const cacheKey = this.getCacheKey(url);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.stats.cached++;
        this.stats.success++;
        console.log(`📦 Cache hit: ${url.substring(0, 50)}...`);
        
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('X-Cache-Status', 'HIT');
        return res.send(cached.data);
      }

      // 2. Détection spéciale Facebook
      if (this.isFacebookUrl(url)) {
        return await this.proxyFacebookImage(url, res);
      }

      // 3. Proxy standard avec retry
      await this.fetchAndStreamImage(url, res, cacheKey);
      
    } catch (error) {
      this.stats.failed++;
      console.error(`❌ Erreur proxy image: ${error.message}`);
      
      // Fallback vers image par défaut
      this.sendDefaultImage(res);
    }
  }

  /**
   * 🌐 Fetch et stream image standard
   */
  async fetchAndStreamImage(url, res, cacheKey, retryCount = 0) {
    try {
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer', // Utiliser arraybuffer pour caching
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': this.getReferer(url),
          'DNT': '1',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site'
        }
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const imageData = Buffer.from(response.data);

      // Mettre en cache
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        // Supprimer les plus anciennes entrées
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      this.cache.set(cacheKey, {
        data: imageData,
        contentType: contentType,
        timestamp: Date.now()
      });

      this.stats.success++;
      
      // Envoyer au client avec headers CORS
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Image-Source', 'direct');
      res.send(imageData);
      
      console.log(`✅ Image proxy: ${url.substring(0, 50)}...`);
      
    } catch (error) {
      // Retry une fois avec headers différents
      if (retryCount === 0 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
        console.log(`🔄 Retry image: ${url.substring(0, 50)}...`);
        return await this.fetchAndStreamImage(url, res, cacheKey, 1);
      }
      throw error;
    }
  }

  /**
   * 📘 Proxy spécial Facebook
   */
  async proxyFacebookImage(url, res) {
    this.stats.facebook++;
    
    try {
      console.log(`📘 Facebook image proxy: ${url.substring(0, 50)}...`);
      
      // Facebook nécessite des headers spécifiques
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 10,
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.facebook.com/',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"'
        }
      });

      const contentType = response.headers['content-type'] || 'image/jpeg';
      const imageData = Buffer.from(response.data);

      // Cache les images Facebook aussi
      const cacheKey = this.getCacheKey(url);
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, {
        data: imageData,
        contentType: contentType,
        timestamp: Date.now()
      });

      this.stats.success++;
      
      // Headers CORS spéciaux pour Facebook
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
      res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
      res.setHeader('X-Image-Source', 'facebook');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(imageData);
      
      console.log(`✅ Facebook image proxied successfully`);
      
    } catch (error) {
      console.error(`❌ Facebook proxy failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔍 Détection URL Facebook
   */
  isFacebookUrl(url) {
    return url.includes('facebook.com') || 
           url.includes('fbcdn.net') ||
           url.includes('fb.com');
  }

  /**
   * 🔗 Obtenir referer approprié
   */
  getReferer(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}/`;
    } catch (error) {
      return 'https://google.com/';
    }
  }

  /**
   * 🖼️ Image par défaut
   */
  sendDefaultImage(res) {
    // Pixel transparent 1x1 PNG
    const transparentPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5min seulement
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Image-Source', 'fallback');
    res.send(transparentPixel);
  }

  /**
   * 🧹 Nettoyer le cache ancien
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cache nettoyé: ${cleaned} entrées supprimées`);
    }
  }
}

module.exports = AdvancedImageProxy;
