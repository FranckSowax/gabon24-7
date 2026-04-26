/**
 * 🚨 ROUTES ADMIN - Gestion des alertes système
 */

const express = require('express');
const router = express.Router();
const supabase = require('../supabase-config');
const { getPendingAlerts, resolveAlert } = require('../utils/quota-monitor');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes admin-alerts requièrent un compte admin
router.use(requireAdmin);

/**
 * GET /api/admin/alerts
 * Récupère toutes les alertes actives
 */
router.get('/alerts', async (req, res) => {
  try {
    const { status = 'new', limit = 50 } = req.query;

    let query = supabase.supabase
      .from('admin_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    // Statistiques
    const { data: stats } = await supabase.supabase
      .from('admin_alerts')
      .select('severity, status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Dernières 24h

    const statistics = {
      total_24h: stats?.length || 0,
      by_severity: {
        critical: stats?.filter(a => a.severity === 'critical').length || 0,
        high: stats?.filter(a => a.severity === 'high').length || 0,
        medium: stats?.filter(a => a.severity === 'medium').length || 0,
        low: stats?.filter(a => a.severity === 'low').length || 0
      },
      unresolved: stats?.filter(a => a.status === 'new').length || 0
    };

    res.json({
      success: true,
      alerts: alerts || [],
      statistics
    });

  } catch (error) {
    console.error('❌ Erreur récupération alertes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/alerts/active
 * Vue simplifiée des alertes actives (critical et high en priorité)
 */
router.get('/alerts/active', async (req, res) => {
  try {
    const alerts = await getPendingAlerts();

    // Grouper par service
    const byService = alerts.reduce((acc, alert) => {
      if (!acc[alert.service]) acc[alert.service] = [];
      acc[alert.service].push(alert);
      return acc;
    }, {});

    res.json({
      success: true,
      active_count: alerts.length,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      alerts,
      by_service: byService
    });

  } catch (error) {
    console.error('❌ Erreur récupération alertes actives:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/alerts/:id/acknowledge
 * Marque une alerte comme "prise en compte"
 */
router.put('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, notes } = req.body;

    const { data, error } = await supabase.supabase
      .from('admin_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId || null,
        acknowledged_at: new Date().toISOString(),
        notes: notes || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Alerte ${id} prise en compte`);

    res.json({
      success: true,
      alert: data
    });

  } catch (error) {
    console.error('❌ Erreur acknowledge alerte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/alerts/:id/resolve
 * Marque une alerte comme résolue
 */
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, notes } = req.body;

    const success = await resolveAlert(id);

    if (success) {
      // Mettre à jour avec les infos supplémentaires
      await supabase.supabase
        .from('admin_alerts')
        .update({
          resolved_by: userId || null,
          notes: notes || null
        })
        .eq('id', id);
    }

    res.json({
      success,
      message: success ? 'Alerte résolue' : 'Erreur lors de la résolution'
    });

  } catch (error) {
    console.error('❌ Erreur résolution alerte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/alerts/:id
 * Supprime une alerte (ignorer)
 */
router.delete('/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.supabase
      .from('admin_alerts')
      .update({ status: 'ignored' })
      .eq('id', id);

    if (error) throw error;

    console.log(`🗑️ Alerte ${id} ignorée`);

    res.json({
      success: true,
      message: 'Alerte ignorée'
    });

  } catch (error) {
    console.error('❌ Erreur suppression alerte:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/alerts/summary
 * Résumé du statut système
 */
router.get('/alerts/summary', async (req, res) => {
  try {
    const { data: recentAlerts } = await supabase.supabase
      .from('admin_alerts')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const summary = {
      status: 'healthy',
      last_7_days: {
        total_alerts: recentAlerts?.length || 0,
        critical_alerts: recentAlerts?.filter(a => a.severity === 'critical').length || 0,
        unresolved: recentAlerts?.filter(a => a.status === 'new').length || 0
      },
      services: {}
    };

    // Analyser par service
    recentAlerts?.forEach(alert => {
      if (!summary.services[alert.service]) {
        summary.services[alert.service] = {
          total: 0,
          critical: 0,
          last_alert: null
        };
      }
      summary.services[alert.service].total++;
      if (alert.severity === 'critical') {
        summary.services[alert.service].critical++;
      }
      if (!summary.services[alert.service].last_alert || 
          new Date(alert.created_at) > new Date(summary.services[alert.service].last_alert)) {
        summary.services[alert.service].last_alert = alert.created_at;
      }
    });

    // Déterminer le statut global
    if (summary.last_7_days.critical_alerts > 0 || summary.last_7_days.unresolved > 5) {
      summary.status = 'critical';
    } else if (summary.last_7_days.unresolved > 0) {
      summary.status = 'warning';
    }

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('❌ Erreur récupération summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
