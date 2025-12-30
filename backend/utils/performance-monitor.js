const logger = require('./logger');

/**
 * 📊 PERFORMANCE MONITOR
 * Système de monitoring APM léger sans dépendances externes
 * Alternative à New Relic/Datadog pour le monitoring de base
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: new Map(),
        byStatusCode: new Map()
      },
      performance: {
        responseTimes: [],
        slowRequests: [],
        averageResponseTime: 0
      },
      resources: {
        memory: [],
        cpu: []
      },
      errors: {
        total: 0,
        byType: new Map(),
        recent: []
      },
      database: {
        queries: 0,
        slowQueries: [],
        errors: 0
      }
    };

    this.config = {
      slowRequestThreshold: 1000, // 1 seconde
      maxRecentErrors: 50,
      maxSlowRequests: 100,
      metricsRetentionMinutes: 60
    };

    // Nettoyer les anciennes métriques toutes les 5 minutes
    setInterval(() => this.cleanOldMetrics(), 5 * 60 * 1000);
  }

  /**
   * Middleware Express pour tracker les requêtes
   */
  trackRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      const originalSend = res.send;

      res.send = function(data) {
        const duration = Date.now() - startTime;
        
        // Enregistrer les métriques
        this.recordRequest({
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userId: req.user?.id,
          ip: req.ip
        });

        return originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }

  /**
   * Enregistrer une requête
   */
  recordRequest({ method, url, statusCode, duration, userId, ip }) {
    this.metrics.requests.total++;

    // Status
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }

    // Par endpoint
    const endpoint = `${method} ${this.normalizeUrl(url)}`;
    const endpointStats = this.metrics.requests.byEndpoint.get(endpoint) || {
      count: 0,
      totalDuration: 0,
      errors: 0
    };
    endpointStats.count++;
    endpointStats.totalDuration += duration;
    if (statusCode >= 400) endpointStats.errors++;
    this.metrics.requests.byEndpoint.set(endpoint, endpointStats);

    // Par status code
    const statusCount = this.metrics.requests.byStatusCode.get(statusCode) || 0;
    this.metrics.requests.byStatusCode.set(statusCode, statusCount + 1);

    // Performance
    this.metrics.performance.responseTimes.push({
      timestamp: Date.now(),
      duration,
      endpoint
    });

    // Requêtes lentes
    if (duration > this.config.slowRequestThreshold) {
      this.metrics.performance.slowRequests.push({
        timestamp: Date.now(),
        duration,
        endpoint,
        method,
        url,
        userId,
        ip
      });

      // Limiter la taille
      if (this.metrics.performance.slowRequests.length > this.config.maxSlowRequests) {
        this.metrics.performance.slowRequests.shift();
      }

      logger.logWarning('Requête lente détectée', {
        endpoint,
        duration: `${duration}ms`,
        userId
      });
    }

    // Calculer le temps de réponse moyen
    this.updateAverageResponseTime();
  }

  /**
   * Enregistrer une erreur
   */
  recordError(error, context = {}) {
    this.metrics.errors.total++;

    const errorType = error.name || 'UnknownError';
    const errorCount = this.metrics.errors.byType.get(errorType) || 0;
    this.metrics.errors.byType.set(errorType, errorCount + 1);

    this.metrics.errors.recent.push({
      timestamp: Date.now(),
      type: errorType,
      message: error.message,
      stack: error.stack,
      context
    });

    // Limiter la taille
    if (this.metrics.errors.recent.length > this.config.maxRecentErrors) {
      this.metrics.errors.recent.shift();
    }

    logger.logError(error, context);
  }

  /**
   * Enregistrer une requête DB
   */
  recordDatabaseQuery(duration, query, error = null) {
    this.metrics.database.queries++;

    if (error) {
      this.metrics.database.errors++;
      logger.logError(error, { context: 'database', query });
    }

    // Requêtes lentes (> 500ms)
    if (duration > 500) {
      this.metrics.database.slowQueries.push({
        timestamp: Date.now(),
        duration,
        query: query.substring(0, 200) // Tronquer
      });

      if (this.metrics.database.slowQueries.length > 50) {
        this.metrics.database.slowQueries.shift();
      }

      logger.logWarning('Requête DB lente', {
        duration: `${duration}ms`,
        query: query.substring(0, 100)
      });
    }
  }

  /**
   * Collecter les métriques système
   */
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.resources.memory.push({
      timestamp: Date.now(),
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external
    });

    this.metrics.resources.cpu.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });

    // Garder seulement les 100 dernières mesures
    if (this.metrics.resources.memory.length > 100) {
      this.metrics.resources.memory.shift();
    }
    if (this.metrics.resources.cpu.length > 100) {
      this.metrics.resources.cpu.shift();
    }
  }

  /**
   * Obtenir un snapshot des métriques
   */
  getMetrics() {
    this.collectSystemMetrics();

    const now = Date.now();
    const uptime = process.uptime();

    // Top 10 endpoints les plus utilisés
    const topEndpoints = Array.from(this.metrics.requests.byEndpoint.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        errorRate: ((stats.errors / stats.count) * 100).toFixed(2) + '%'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Mémoire actuelle
    const currentMemory = this.metrics.resources.memory[this.metrics.resources.memory.length - 1] || {};
    const memoryUsageMB = Math.round(currentMemory.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(currentMemory.heapTotal / 1024 / 1024);

    return {
      timestamp: now,
      uptime: Math.round(uptime),
      requests: {
        total: this.metrics.requests.total,
        success: this.metrics.requests.success,
        errors: this.metrics.requests.errors,
        successRate: ((this.metrics.requests.success / this.metrics.requests.total) * 100).toFixed(2) + '%',
        requestsPerMinute: Math.round(this.metrics.requests.total / (uptime / 60)),
        byStatusCode: Object.fromEntries(this.metrics.requests.byStatusCode),
        topEndpoints
      },
      performance: {
        averageResponseTime: Math.round(this.metrics.performance.averageResponseTime),
        slowRequestsCount: this.metrics.performance.slowRequests.length,
        recentSlowRequests: this.metrics.performance.slowRequests.slice(-10)
      },
      resources: {
        memory: {
          used: `${memoryUsageMB} MB`,
          total: `${memoryTotalMB} MB`,
          percentage: ((memoryUsageMB / memoryTotalMB) * 100).toFixed(2) + '%'
        },
        process: {
          pid: process.pid,
          uptime: `${Math.round(uptime / 60)} minutes`,
          nodeVersion: process.version
        }
      },
      errors: {
        total: this.metrics.errors.total,
        byType: Object.fromEntries(this.metrics.errors.byType),
        recent: this.metrics.errors.recent.slice(-10)
      },
      database: {
        queries: this.metrics.database.queries,
        errors: this.metrics.database.errors,
        slowQueries: this.metrics.database.slowQueries.slice(-10)
      }
    };
  }

  /**
   * Obtenir un résumé santé
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const issues = [];

    // Vérifier le taux d'erreur
    const errorRate = (this.metrics.requests.errors / this.metrics.requests.total) * 100;
    if (errorRate > 5) {
      issues.push({
        severity: 'warning',
        message: `Taux d'erreur élevé: ${errorRate.toFixed(2)}%`
      });
    }

    // Vérifier les requêtes lentes
    if (this.metrics.performance.slowRequests.length > 10) {
      issues.push({
        severity: 'warning',
        message: `${this.metrics.performance.slowRequests.length} requêtes lentes détectées`
      });
    }

    // Vérifier la mémoire
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (memPercentage > 90) {
      issues.push({
        severity: 'critical',
        message: `Utilisation mémoire critique: ${memPercentage.toFixed(2)}%`
      });
    } else if (memPercentage > 80) {
      issues.push({
        severity: 'warning',
        message: `Utilisation mémoire élevée: ${memPercentage.toFixed(2)}%`
      });
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      timestamp: Date.now(),
      issues,
      metrics: {
        uptime: Math.round(process.uptime()),
        requestsTotal: this.metrics.requests.total,
        errorRate: `${errorRate.toFixed(2)}%`,
        avgResponseTime: `${Math.round(this.metrics.performance.averageResponseTime)}ms`,
        memoryUsage: `${memPercentage.toFixed(2)}%`
      }
    };
  }

  /**
   * Normaliser l'URL (remplacer les IDs par :id)
   */
  normalizeUrl(url) {
    return url
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .split('?')[0]; // Enlever les query params
  }

  /**
   * Calculer le temps de réponse moyen
   */
  updateAverageResponseTime() {
    const recentTimes = this.metrics.performance.responseTimes.slice(-100);
    if (recentTimes.length === 0) return;

    const sum = recentTimes.reduce((acc, item) => acc + item.duration, 0);
    this.metrics.performance.averageResponseTime = sum / recentTimes.length;
  }

  /**
   * Nettoyer les anciennes métriques
   */
  cleanOldMetrics() {
    const cutoffTime = Date.now() - (this.config.metricsRetentionMinutes * 60 * 1000);

    // Nettoyer les temps de réponse
    this.metrics.performance.responseTimes = this.metrics.performance.responseTimes
      .filter(item => item.timestamp > cutoffTime);

    // Nettoyer les requêtes lentes
    this.metrics.performance.slowRequests = this.metrics.performance.slowRequests
      .filter(item => item.timestamp > cutoffTime);

    // Nettoyer les erreurs récentes
    this.metrics.errors.recent = this.metrics.errors.recent
      .filter(item => item.timestamp > cutoffTime);

    logger.logDebug('Métriques anciennes nettoyées', {
      cutoffTime: new Date(cutoffTime).toISOString()
    });
  }

  /**
   * Réinitialiser toutes les métriques
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: new Map(),
        byStatusCode: new Map()
      },
      performance: {
        responseTimes: [],
        slowRequests: [],
        averageResponseTime: 0
      },
      resources: {
        memory: [],
        cpu: []
      },
      errors: {
        total: 0,
        byType: new Map(),
        recent: []
      },
      database: {
        queries: 0,
        slowQueries: [],
        errors: 0
      }
    };

    logger.info('Métriques réinitialisées');
  }
}

// Instance singleton
const monitor = new PerformanceMonitor();

module.exports = monitor;
