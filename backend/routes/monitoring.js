const express = require('express');
const router = express.Router();
const monitor = require('../utils/performance-monitor');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * 📊 ROUTES DE MONITORING APM
 * Endpoints pour visualiser les métriques de performance
 */

// GET /api/monitoring/metrics - Obtenir toutes les métriques
router.get('/metrics', requireAdmin, (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    logger.logDebug('Métriques consultées', {
      adminId: req.user.id
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.logError(error, { context: 'getMetrics' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métriques'
    });
  }
});

// GET /api/monitoring/health - Vérifier la santé de l'application
router.get('/health', (req, res) => {
  try {
    const health = monitor.getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health
    });
  } catch (error) {
    logger.logError(error, { context: 'healthCheck' });
    res.status(500).json({
      success: false,
      status: 'error',
      error: 'Erreur lors de la vérification de santé'
    });
  }
});

// GET /api/monitoring/performance - Métriques de performance uniquement
router.get('/performance', requireAdmin, (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      success: true,
      data: {
        averageResponseTime: metrics.performance.averageResponseTime,
        slowRequests: metrics.performance.slowRequestsCount,
        recentSlowRequests: metrics.performance.recentSlowRequests,
        topEndpoints: metrics.requests.topEndpoints
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'getPerformance' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des performances'
    });
  }
});

// GET /api/monitoring/errors - Erreurs récentes
router.get('/errors', requireAdmin, (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      success: true,
      data: {
        total: metrics.errors.total,
        byType: metrics.errors.byType,
        recent: metrics.errors.recent
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'getErrors' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des erreurs'
    });
  }
});

// GET /api/monitoring/requests - Statistiques des requêtes
router.get('/requests', requireAdmin, (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      success: true,
      data: {
        total: metrics.requests.total,
        success: metrics.requests.success,
        errors: metrics.requests.errors,
        successRate: metrics.requests.successRate,
        requestsPerMinute: metrics.requests.requestsPerMinute,
        byStatusCode: metrics.requests.byStatusCode,
        topEndpoints: metrics.requests.topEndpoints
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'getRequests' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// GET /api/monitoring/resources - Utilisation des ressources
router.get('/resources', requireAdmin, (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      success: true,
      data: {
        memory: metrics.resources.memory,
        process: metrics.resources.process,
        uptime: metrics.uptime
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'getResources' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des ressources'
    });
  }
});

// GET /api/monitoring/database - Statistiques base de données
router.get('/database', requireAdmin, (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      success: true,
      data: metrics.database
    });
  } catch (error) {
    logger.logError(error, { context: 'getDatabase' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des stats DB'
    });
  }
});

// POST /api/monitoring/reset - Réinitialiser les métriques (admin uniquement)
router.post('/reset', requireAdmin, (req, res) => {
  try {
    monitor.reset();
    
    logger.logSuccess('Métriques réinitialisées', {
      adminId: req.user.id
    });

    res.json({
      success: true,
      message: 'Métriques réinitialisées avec succès'
    });
  } catch (error) {
    logger.logError(error, { context: 'resetMetrics' });
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation'
    });
  }
});

module.exports = router;
