/**
 * 💰 ROUTES PRICING
 * API pour récupérer les tarifs dynamiques
 */

const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricing-service');
const supabaseService = require('../supabase-config');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/pricing - Obtenir tous les tarifs (public)
router.get('/', async (req, res) => {
  try {
    const pricing = await pricingService.getAllPricing();
    const creditValue = await pricingService.getCreditValueFCFA();

    // Grouper par catégorie
    const byCategory = pricing.reduce((acc, item) => {
      const cat = item.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        key: item.feature_key,
        name: item.name || item.feature_key,
        credits: item.credits,
        fcfa: item.credits * creditValue,
        model: item.model,
        isActive: item.isActive !== false,
        isDefault: item.isDefault || false
      });
      return acc;
    }, {});

    res.json({
      success: true,
      creditValue,
      pricing: byCategory,
      total: pricing.length,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tarifs'
    });
  }
});

// GET /api/pricing/:featureKey - Obtenir le tarif d'une fonctionnalité
router.get('/:featureKey', async (req, res) => {
  try {
    const { featureKey } = req.params;
    const config = await pricingService.getServiceConfig(featureKey);
    const creditValue = await pricingService.getCreditValueFCFA();

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Fonctionnalité non trouvée'
      });
    }

    res.json({
      success: true,
      feature: {
        key: featureKey,
        credits: config.credits,
        fcfa: config.credits * creditValue,
        model: config.model,
        category: config.category,
        isActive: config.isActive
      },
      creditValue
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/pricing/:key:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du tarif'
    });
  }
});

// POST /api/pricing/refresh - Forcer le rechargement du cache (admin)
router.post('/refresh', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pricingService.refreshCache();

    res.json({
      success: true,
      message: 'Cache des tarifs rechargé'
    });

  } catch (error) {
    console.error('❌ Erreur POST /api/pricing/refresh:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rechargement'
    });
  }
});

// PUT /api/pricing/:featureKey - Modifier un tarif (admin)
router.put('/:featureKey', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { credits_cost, ai_model, is_active, estimated_api_cost_usd } = req.body;

    // Valider les données
    if (credits_cost !== undefined && (typeof credits_cost !== 'number' || credits_cost < 0)) {
      return res.status(400).json({
        success: false,
        error: 'credits_cost doit être un nombre positif'
      });
    }

    // Mettre à jour en base
    const { data, error } = await supabaseService.supabase
      .from('pricing_config')
      .update({
        credits_cost: credits_cost !== undefined ? credits_cost : undefined,
        ai_model: ai_model !== undefined ? ai_model : undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        estimated_api_cost_usd: estimated_api_cost_usd !== undefined ? estimated_api_cost_usd : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('feature_key', featureKey)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Rafraîchir le cache
    await pricingService.refreshCache();

    res.json({
      success: true,
      feature: data,
      message: `Tarif "${featureKey}" mis à jour`
    });

  } catch (error) {
    console.error('❌ Erreur PUT /api/pricing/:key:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du tarif'
    });
  }
});

// GET /api/pricing/credit-value - Obtenir la valeur du crédit en FCFA
router.get('/settings/credit-value', async (req, res) => {
  try {
    const creditValue = await pricingService.getCreditValueFCFA();

    res.json({
      success: true,
      creditValue,
      formatted: `1 crédit = ${creditValue} FCFA`
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/pricing/credit-value:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération'
    });
  }
});

// PUT /api/pricing/settings/credit-value - Modifier la valeur du crédit (admin)
router.put('/settings/credit-value', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { value } = req.body;

    if (!value || typeof value !== 'number' || value < 1) {
      return res.status(400).json({
        success: false,
        error: 'La valeur doit être un nombre positif'
      });
    }

    const { error } = await supabaseService.supabase
      .from('app_settings')
      .upsert({
        key: 'credit_value_fcfa',
        value: value.toString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      creditValue: value,
      message: `Valeur du crédit mise à jour: 1 crédit = ${value} FCFA`
    });

  } catch (error) {
    console.error('❌ Erreur PUT /api/pricing/credit-value:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour'
    });
  }
});

module.exports = router;
