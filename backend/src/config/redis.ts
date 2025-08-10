import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;

export const redis = createClient({
  url: redisUrl,
  ...(redisPassword && { password: redisPassword }),
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

redis.on('error', (err) => {
  logger.error('Erreur Redis:', err);
});

redis.on('connect', () => {
  logger.info('Connexion Redis établie');
});

redis.on('ready', () => {
  logger.info('Redis prêt');
});

redis.on('end', () => {
  logger.info('Connexion Redis fermée');
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('Redis connecté avec succès');
  } catch (error) {
    logger.error('Erreur de connexion Redis:', error);
    throw error;
  }
}

// Utilitaires Redis
export class RedisService {
  static async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await redis.setEx(key, ttl, stringValue);
      } else {
        await redis.set(key, stringValue);
      }
    } catch (error) {
      logger.error(`Erreur Redis SET pour la clé ${key}:`, error);
      throw error;
    }
  }

  static async get(key: string): Promise<any> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Erreur Redis GET pour la clé ${key}:`, error);
      throw error;
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error(`Erreur Redis DEL pour la clé ${key}:`, error);
      throw error;
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Erreur Redis EXISTS pour la clé ${key}:`, error);
      throw error;
    }
  }

  static async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await redis.incr(key);
      if (ttl && result === 1) {
        await redis.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error(`Erreur Redis INCR pour la clé ${key}:`, error);
      throw error;
    }
  }

  static async setHash(key: string, field: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      await redis.hSet(key, field, stringValue);
    } catch (error) {
      logger.error(`Erreur Redis HSET pour ${key}.${field}:`, error);
      throw error;
    }
  }

  static async getHash(key: string, field: string): Promise<any> {
    try {
      const value = await redis.hGet(key, field);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      logger.error(`Erreur Redis HGET pour ${key}.${field}:`, error);
      throw error;
    }
  }

  static async getAllHash(key: string): Promise<Record<string, any>> {
    try {
      const hash = await redis.hGetAll(key);
      const result: Record<string, any> = {};
      
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`Erreur Redis HGETALL pour la clé ${key}:`, error);
      throw error;
    }
  }
}
