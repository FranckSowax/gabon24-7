/**
 * Service Redis Cache pour le serveur Express (JavaScript)
 * Fournit un cache haute performance pour les endpoints API
 */

const { createClient } = require('redis');

class RedisCacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Initialise la connexion Redis
   */
  async connect() {
    // Éviter les connexions multiples
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnected && this.client) {
      return this.client;
    }

    this.connectionPromise = this._initConnection();
    return this.connectionPromise;
  }

  async _initConnection() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      console.log('🔗 Connexion Redis en cours...');

      this.client = createClient({
        url: redisUrl,
        ...(redisPassword && { password: redisPassword }),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.warn('⚠️ Redis: Trop de tentatives, abandon');
              return false;
            }
            return Math.min(retries * 100, 3000);
          },
          connectTimeout: 5000
        }
      });

      this.client.on('error', (err) => {
        console.error('❌ Erreur Redis:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connecté');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        console.log('✅ Redis prêt');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        console.log('🔌 Redis déconnecté');
      });

      await this.client.connect();
      this.isConnected = true;
      return this.client;

    } catch (error) {
      console.error('❌ Impossible de connecter Redis:', error.message);
      this.isConnected = false;
      this.connectionPromise = null;
      // Ne pas throw - le cache est optionnel
      return null;
    }
  }

  /**
   * Vérifie si Redis est disponible
   */
  isAvailable() {
    return this.isConnected && this.client;
  }

  /**
   * Stocke une valeur avec TTL optionnel
   * @param {string} key - Clé de cache
   * @param {any} value - Valeur (sera JSON.stringify si objet)
   * @param {number} ttl - Time To Live en secondes (défaut: 300 = 5 min)
   */
  async set(key, value, ttl = 300) {
    if (!this.isAvailable()) return false;

    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.setEx(key, ttl, stringValue);
      return true;
    } catch (error) {
      console.error(`❌ Redis SET error [${key}]:`, error.message);
      return false;
    }
  }

  /**
   * Récupère une valeur
   * @param {string} key - Clé de cache
   * @returns {any} Valeur parsée ou null
   */
  async get(key) {
    if (!this.isAvailable()) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error(`❌ Redis GET error [${key}]:`, error.message);
      return null;
    }
  }

  /**
   * Supprime une clé
   * @param {string} key - Clé à supprimer
   */
  async del(key) {
    if (!this.isAvailable()) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Redis DEL error [${key}]:`, error.message);
      return false;
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   * @param {string} pattern - Pattern (ex: "projects:*")
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log(`🗑️ Redis: ${keys.length} clés supprimées pour ${pattern}`);
      }
      return true;
    } catch (error) {
      console.error(`❌ Redis DEL pattern error [${pattern}]:`, error.message);
      return false;
    }
  }

  /**
   * Vérifie si une clé existe
   * @param {string} key - Clé à vérifier
   */
  async exists(key) {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Redis EXISTS error [${key}]:`, error.message);
      return false;
    }
  }

  /**
   * Middleware Express pour le cache automatique
   * @param {number} ttl - TTL en secondes
   * @param {function} keyGenerator - Fonction pour générer la clé (req) => string
   */
  cacheMiddleware(ttl = 300, keyGenerator = null) {
    return async (req, res, next) => {
      if (!this.isAvailable()) {
        return next();
      }

      // Générer la clé de cache
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : `api:${req.originalUrl}:${req.user?.id || 'anon'}`;

      try {
        // Vérifier le cache
        const cachedData = await this.get(cacheKey);
        if (cachedData) {
          console.log(`⚡ Cache HIT: ${cacheKey}`);
          return res.json(cachedData);
        }

        // Intercepter la réponse pour la mettre en cache
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          // Ne mettre en cache que les réponses réussies
          if (data && (data.success !== false)) {
            this.set(cacheKey, data, ttl).catch(() => {});
          }
          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('❌ Cache middleware error:', error.message);
        next();
      }
    };
  }

  /**
   * Helper pour cache avec fallback
   * @param {string} key - Clé de cache
   * @param {function} fetchFn - Fonction async pour récupérer les données
   * @param {number} ttl - TTL en secondes
   */
  async getOrFetch(key, fetchFn, ttl = 300) {
    // Essayer le cache d'abord
    const cached = await this.get(key);
    if (cached) {
      console.log(`⚡ Cache HIT: ${key}`);
      return cached;
    }

    // Sinon, exécuter la fonction
    console.log(`📥 Cache MISS: ${key}`);
    const data = await fetchFn();

    // Mettre en cache si données valides
    if (data) {
      await this.set(key, data, ttl);
    }

    return data;
  }

  /**
   * Ferme la connexion proprement
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
      this.connectionPromise = null;
      console.log('🔌 Redis déconnecté proprement');
    }
  }
}

// Export singleton
const redisCache = new RedisCacheService();
module.exports = redisCache;
