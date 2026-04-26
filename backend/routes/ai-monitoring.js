const express = require('express');
const router = express.Router();
const quotaManager = require('../services/openai-quota-manager');
const aiValidation = require('../middleware/ai-validation');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes /admin/* nécessitent un compte admin
// /health reste public (utilisé par monitoring/uptime checks)
router.use('/admin', requireAdmin);

/**
 * GET /api/ai/health
 * Endpoint public pour vérifier l'état du service IA
 */
router.get('/health', (req, res) => {
  try {
    const status = quotaManager.getQuotaStatus();
    
    res.json({
      success: true,
      status: status.status,
      available: status.status !== 'exhausted',
      message: getStatusMessage(status.status, status.percentageUsed),
      details: {
        percentageUsed: status.percentageUsed,
        remainingBudget: status.remainingBudget,
        estimatedRequestsLeft: status.estimatedRequestsLeft
      }
    });
  } catch (error) {
    console.error('Erreur health check:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification du statut'
    });
  }
});

/**
 * GET /api/ai/admin/status
 * Endpoint admin complet avec toutes les statistiques
 */
router.get('/admin/status', (req, res) => {
  try {
    const quotaStatus = quotaManager.getQuotaStatus();
    const serviceCosts = quotaManager.getServiceCosts();
    const creditsCosts = aiValidation.INTERNAL_CREDITS_COST;

    res.json({
      success: true,
      quota: quotaStatus,
      costs: {
        openai: serviceCosts,
        internal: creditsCosts
      },
      recommendations: getRecommendations(quotaStatus)
    });
  } catch (error) {
    console.error('Erreur admin status:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du statut'
    });
  }
});

/**
 * POST /api/ai/admin/reset-quota
 * Réinitialise le quota mensuel (à utiliser en début de mois)
 */
router.post('/admin/reset-quota', (req, res) => {
  try {
    const { confirmReset } = req.body;

    if (!confirmReset) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation requise pour réinitialiser le quota'
      });
    }

    const newStatus = quotaManager.resetMonthlyQuota();

    res.json({
      success: true,
      message: 'Quota mensuel réinitialisé avec succès',
      status: newStatus
    });
  } catch (error) {
    console.error('Erreur reset quota:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation du quota'
    });
  }
});

/**
 * GET /api/ai/admin/costs-calculator
 * Calcule le coût estimé pour un nombre de requêtes
 */
router.get('/admin/costs-calculator', (req, res) => {
  try {
    const { service, count = 1 } = req.query;

    if (!service) {
      const costs = quotaManager.getServiceCosts();
      return res.json({
        success: true,
        availableServices: Object.keys(costs),
        message: 'Spécifiez un service avec ?service=nom&count=nombre'
      });
    }

    const unitCost = quotaManager.getServiceCost(service);
    const totalCost = unitCost * parseInt(count);
    const internalCredits = aiValidation.INTERNAL_CREDITS_COST[service] || 5;
    const totalInternalCredits = internalCredits * parseInt(count);

    res.json({
      success: true,
      service,
      count: parseInt(count),
      costs: {
        perRequest: {
          openai: unitCost,
          internal: internalCredits
        },
        total: {
          openai: Math.round(totalCost * 1000) / 1000,
          internal: totalInternalCredits
        }
      }
    });
  } catch (error) {
    console.error('Erreur costs calculator:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du calcul des coûts'
    });
  }
});

// Helpers

function getStatusMessage(status, percentageUsed) {
  switch (status) {
    case 'ok':
      return 'Service IA opérationnel';
    case 'warning':
      return `Service IA opérationnel (budget à ${percentageUsed}%)`;
    case 'critical':
      return `Service IA limité (budget à ${percentageUsed}%)`;
    case 'exhausted':
      return 'Service IA temporairement indisponible (budget épuisé)';
    default:
      return 'Statut inconnu';
  }
}

function getRecommendations(quotaStatus) {
  const recommendations = [];

  if (quotaStatus.percentageUsed >= 90) {
    recommendations.push({
      severity: 'critical',
      message: 'Budget presque épuisé. Envisagez d\'augmenter le budget mensuel.',
      action: 'Modifier OPENAI_MONTHLY_BUDGET dans .env'
    });
  } else if (quotaStatus.percentageUsed >= 70) {
    recommendations.push({
      severity: 'warning',
      message: 'Budget à 70%. Surveillez la consommation.',
      action: 'Vérifier les requêtes inhabituelles'
    });
  }

  if (quotaStatus.requestsToday > 500) {
    recommendations.push({
      severity: 'info',
      message: 'Volume élevé de requêtes aujourd\'hui',
      action: 'Vérifier s\'il y a des pics anormaux'
    });
  }

  if (quotaStatus.recentErrorsCount > 5) {
    recommendations.push({
      severity: 'warning',
      message: `${quotaStatus.recentErrorsCount} erreurs récentes détectées`,
      action: 'Vérifier les logs pour identifier les problèmes'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      severity: 'success',
      message: 'Tout fonctionne normalement',
      action: 'Aucune action requise'
    });
  }

  return recommendations;
}

/**
 * GET /api/ai/admin/cache-stats
 * Statistiques du système de cache
 */
router.get('/admin/cache-stats', async (req, res) => {
  try {
    const analysisCache = require('../services/analysis-cache');
    const stats = await analysisCache.getCacheStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Erreur cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des stats du cache'
    });
  }
});

/**
 * POST /api/ai/admin/clean-cache
 * Nettoie le cache ancien
 */
router.post('/admin/clean-cache', async (req, res) => {
  try {
    const { daysOld = 7 } = req.body;
    const analysisCache = require('../services/analysis-cache');
    const result = await analysisCache.cleanOldCache(daysOld);

    res.json({
      success: true,
      message: `Cache nettoyé: ${result.deleted} entrées supprimées`,
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Erreur clean cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du nettoyage du cache'
    });
  }
});

module.exports = router;
