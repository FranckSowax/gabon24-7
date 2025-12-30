const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { supabase } = require('../config/supabase');
const uploadService = require('../services/upload-service');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../middleware/validation');

// ==================== SCHÉMAS DE VALIDATION ====================

// Schéma pour la création de campagne
const createCampaignSchema = z.object({
  campaign_type: z.enum(['banner_home', 'banner_feed', 'video_home', 'article_trending'], {
    errorMap: () => ({ message: 'Type de campagne invalide' })
  }),
  name: z.string().min(3, 'Nom trop court').max(100, 'Nom trop long'),
  budget: z.number().min(0).max(100000000).optional().default(0),
  duration_days: z.number().int().min(1).max(365).optional().default(7),

  // Bannière Page d'Accueil
  desktop_image_url: z.string().url().max(2000).optional().nullable(),
  mobile_image_url: z.string().url().max(2000).optional().nullable(),
  banner_title: z.string().max(200).optional().nullable(),
  banner_description: z.string().max(1000).optional().nullable(),

  // Bannière Feed
  feed_image_1_url: z.string().url().max(2000).optional().nullable(),
  feed_image_2_url: z.string().url().max(2000).optional().nullable(),
  feed_image_3_url: z.string().url().max(2000).optional().nullable(),

  // Vidéo Home
  video_url: z.string().url().max(2000).optional().nullable(),
  video_title: z.string().max(200).optional().nullable(),
  video_description: z.string().max(1000).optional().nullable(),

  // Article Sponsorisé
  article_title: z.string().max(200).optional().nullable(),
  article_subtitle: z.string().max(300).optional().nullable(),
  article_content: z.string().max(50000).optional().nullable(),
  article_category: z.string().max(50).optional().nullable(),
  article_company_name: z.string().max(100).optional().nullable(),
  article_product_service: z.string().max(200).optional().nullable(),
  article_target_audience: z.string().max(500).optional().nullable(),
  article_key_message: z.string().max(500).optional().nullable(),
  article_call_to_action: z.string().max(200).optional().nullable(),
  article_image_url: z.string().url().max(2000).optional().nullable(),

  // Commun
  redirect_url: z.string().url().max(2000).optional().nullable(),
  design_request: z.boolean().optional().default(false),
  design_request_notes: z.string().max(2000).optional().nullable(),
});

// Schéma pour les query params de liste
const listCampaignsQuerySchema = z.object({
  status: z.enum(['draft', 'pending', 'active', 'paused', 'completed', 'rejected']).optional(),
  campaign_type: z.enum(['banner_home', 'banner_feed', 'video_home', 'article_trending']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});

// GET /api/campaigns - Récupérer toutes les campagnes (admin)
// 🔒 SÉCURISÉ: Validation des query params
router.get('/', requireAdmin, validateQuery(listCampaignsQuerySchema), async (req, res) => {
  try {
    const { status, campaign_type, limit } = req.query;
    
    let query = supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (campaign_type) {
      query = query.eq('campaign_type', campaign_type);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, campaigns: data, count: data?.length || 0 });
  } catch (error) {
    console.error('Erreur récupération campagnes:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/campaigns/my-campaigns - Récupérer les campagnes de l'utilisateur
router.get('/my-campaigns', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT par le middleware

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ campaigns: data });
  } catch (error) {
    console.error('Erreur récupération campagnes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/campaigns/active - Récupérer campagnes actives (DOIT être AVANT /:id)
router.get('/active', async (req, res) => {
  try {
    const { campaign_type } = req.query;

    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString());

    if (campaign_type) {
      query = query.eq('campaign_type', campaign_type);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({ campaign: null });
    }

    res.json({ campaign: data[0] });

  } catch (error) {
    console.error('Erreur récupération campagne active:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/campaigns/:id - Détails d'une campagne
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validation UUID pour éviter confusion avec routes nommées (ex: /active)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'ID de campagne invalide' });
    }
    
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }

    res.json({ campaign: data });
  } catch (error) {
    console.error('Erreur récupération campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/campaigns - Créer une nouvelle campagne
// 🔒 SÉCURISÉ: Authentification + validation complète des inputs
router.post('/', requireAuth, validateBody(createCampaignSchema), async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT par le middleware

    // Les données sont déjà validées et nettoyées par le middleware
    const campaignData = {
      user_id: userId,
      status: 'pending',
      ...req.body, // Données validées par Zod
    };

    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignData])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Campagne créée:', data.id, campaignData.campaign_type);

    res.status(201).json({ 
      success: true,
      campaign: data,
      message: 'Campagne créée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur création campagne:', error);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// GET /api/campaigns/:id/analytics - Analytics d'une campagne
router.get('/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Récupérer la campagne
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (campaignError) throw campaignError;

    // Récupérer les analytics détaillés
    let analyticsQuery = supabase
      .from('campaign_analytics')
      .select('*')
      .eq('campaign_id', id);

    if (startDate) {
      analyticsQuery = analyticsQuery.gte('created_at', startDate);
    }
    if (endDate) {
      analyticsQuery = analyticsQuery.lte('created_at', endDate);
    }

    const { data: analytics, error: analyticsError } = await analyticsQuery;

    if (analyticsError) throw analyticsError;

    // Calculer les stats
    const stats = {
      totalViews: campaign.views || 0,
      totalClicks: campaign.clicks || 0,
      totalImpressions: campaign.impressions || 0,
      ctr: campaign.views > 0 ? ((campaign.clicks / campaign.views) * 100).toFixed(2) : 0,
      events: analytics,
      eventsByType: {
        views: analytics.filter(a => a.event_type === 'view').length,
        clicks: analytics.filter(a => a.event_type === 'click').length,
        impressions: analytics.filter(a => a.event_type === 'impression').length,
      },
      eventsByDay: groupEventsByDay(analytics)
    };

    res.json({ analytics: stats });

  } catch (error) {
    console.error('Erreur analytics:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/campaigns/:id/track - Tracker un événement
router.post('/:id/track', async (req, res) => {
  try {
    const { id } = req.params;
    const { event } = req.body; // 'view', 'click', 'impression'

    if (!['view', 'click', 'impression', 'share'].includes(event)) {
      return res.status(400).json({ error: 'Type d\'événement invalide' });
    }

    // Incrémenter le compteur dans la campagne
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('views, clicks, impressions')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const updates = {};
    if (event === 'view') updates.views = (campaign.views || 0) + 1;
    if (event === 'click') updates.clicks = (campaign.clicks || 0) + 1;
    if (event === 'impression') updates.impressions = (campaign.impressions || 0) + 1;

    const { error: updateError } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;

    // Enregistrer l'événement détaillé
    const analyticsData = {
      campaign_id: id,
      event_type: event,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      referrer: req.headers['referer'] || null,
    };

    const { error: analyticsError } = await supabase
      .from('campaign_analytics')
      .insert([analyticsData]);

    if (analyticsError) {
      console.error('⚠️ Erreur analytics:', analyticsError);
      // Ne pas bloquer la requête
    }

    res.json({ 
      success: true,
      [event + 's']: updates[event + 's'] || (campaign[event + 's'] || 0) + 1
    });

  } catch (error) {
    console.error('❌ Erreur tracking:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Fonctions utilitaires
function groupEventsByDay(events) {
  const grouped = {};
  events.forEach(event => {
    const date = new Date(event.created_at).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = { views: 0, clicks: 0, impressions: 0 };
    }
    grouped[date][event.event_type + 's']++;
  });
  return grouped;
}

module.exports = router;
