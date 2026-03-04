/**
 * 👤 ROUTES ADMIN - Migration depuis Netlify
 * Gestion administrative: analytics, campagnes, clients, slides, routes
 *
 * ⚠️ SÉCURITÉ: Toutes les routes admin requièrent une authentification admin
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/stats - Statistiques completes du dashboard
// 🔒 SÉCURISÉ: Authentification admin requise
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const supabase = supabaseService.supabase;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Lancer toutes les requetes en parallele
    const [
      articlesTotal,
      articlesToday,
      articlesWeek,
      articlesMonth,
      usersTotal,
      usersThisWeek,
      feedsTotal,
      feedsActive,
      feedsError,
      viewsTotal,
      viewsToday,
      viewsUniqueToday,
      campaignsData,
      aiTransactions,
      subscriptionsActive,
      feedbacksCount,
      veilleSubsCount
    ] = await Promise.all([
      // --- Articles ---
      supabase.from('articles').select('*', { count: 'exact', head: true }),
      supabase.from('articles').select('*', { count: 'exact', head: true }).gte('published_at', today),
      supabase.from('articles').select('*', { count: 'exact', head: true }).gte('published_at', weekAgo),
      supabase.from('articles').select('*', { count: 'exact', head: true }).gte('published_at', monthAgo),
      // --- Users ---
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      // --- RSS Feeds ---
      supabase.from('rss_feeds').select('*', { count: 'exact', head: true }),
      supabase.from('rss_feeds').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('rss_feeds').select('*', { count: 'exact', head: true }).eq('status', 'error'),
      // --- Article Views (page views) ---
      supabase.from('article_views').select('*', { count: 'exact', head: true }),
      supabase.from('article_views').select('*', { count: 'exact', head: true }).gte('viewed_at', today),
      supabase.from('article_views').select('session_id', { count: 'exact', head: true }).gte('viewed_at', today),
      // --- Campaigns (ads) ---
      supabase.from('campaigns').select('views, clicks, impressions, budget, status'),
      // --- AI / Credit Transactions ---
      supabase.from('credit_transactions').select('amount, type, description, created_at').eq('type', 'consumption').gte('created_at', monthAgo),
      // --- Active subscriptions (premium users) ---
      supabase.from('veille_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      // --- Feedbacks ---
      supabase.from('feedbacks').select('*', { count: 'exact', head: true }),
      // --- Veille subscriptions ---
      supabase.from('veille_subscriptions').select('*', { count: 'exact', head: true })
    ]);

    // Calculer stats campagnes (ads)
    const campaigns = campaignsData.data || [];
    const adImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const adClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const adViews = campaigns.reduce((sum, c) => sum + (c.views || 0), 0);
    const adRevenue = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
    const adCtr = adViews > 0 ? parseFloat(((adClicks / adViews) * 100).toFixed(2)) : 0;

    // Calculer stats AI par fonction
    const aiTx = aiTransactions.data || [];
    const aiByFunction = {};
    aiTx.forEach(tx => {
      const desc = tx.description || 'Autre';
      const key = desc.includes('résumé') || desc.includes('resume') ? 'Resume IA'
        : desc.includes('quiz') || desc.includes('jeu') ? 'Quiz Jeu'
        : desc.includes('audio') || desc.includes('tts') ? 'Audio TTS'
        : desc.includes('analyse') || desc.includes('opportunit') ? 'Analyse'
        : 'Autre';
      aiByFunction[key] = (aiByFunction[key] || 0) + Math.abs(tx.amount || 1);
    });
    const aiTotal = Object.values(aiByFunction).reduce((a, b) => a + b, 0);
    // Convertir en pourcentages
    const aiByFunctionPct = {};
    Object.entries(aiByFunction).forEach(([k, v]) => {
      aiByFunctionPct[k] = aiTotal > 0 ? Math.round((v / aiTotal) * 100) : 0;
    });

    res.json({
      // Articles
      totalArticles: articlesTotal.count || 0,
      todayArticles: articlesToday.count || 0,
      weekArticles: articlesWeek.count || 0,
      monthArticles: articlesMonth.count || 0,
      // Users
      totalUsers: usersTotal.count || 0,
      newUsersThisWeek: usersThisWeek.count || 0,
      premiumUsers: subscriptionsActive.count || 0,
      // RSS
      totalFeeds: feedsTotal.count || 0,
      activeFeeds: feedsActive.count || 0,
      errorFeeds: feedsError.count || 0,
      // Page views
      totalPageViews: viewsTotal.count || 0,
      todayPageViews: viewsToday.count || 0,
      uniqueVisitorsToday: viewsUniqueToday.count || 0,
      // Ads / Campaigns
      adImpressions,
      adClicks,
      adCtr,
      adRevenue,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      // AI usage
      aiTotalRequests: aiTx.length,
      aiByFunction: aiByFunctionPct,
      // Feedbacks
      totalFeedbacks: feedbacksCount.count || 0,
      // Veille
      totalVeilleSubscriptions: veilleSubsCount.count || 0,
    });
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.json({
      totalArticles: 0, todayArticles: 0, weekArticles: 0, monthArticles: 0,
      totalUsers: 0, newUsersThisWeek: 0, premiumUsers: 0,
      totalFeeds: 0, activeFeeds: 0, errorFeeds: 0,
      totalPageViews: 0, todayPageViews: 0, uniqueVisitorsToday: 0,
      adImpressions: 0, adClicks: 0, adCtr: 0, adRevenue: 0, activeCampaigns: 0,
      aiTotalRequests: 0, aiByFunction: {},
      totalFeedbacks: 0, totalVeilleSubscriptions: 0
    });
  }
});

// GET /api/admin/analytics - Statistiques admin
// 🔒 SÉCURISÉ: Authentification admin requise
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const { data: stats } = await supabaseService.supabase.rpc('get_admin_stats');
    
    // Si pas de fonction RPC, calculer manuellement
    const { count: totalArticles } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalUsers } = await supabaseService.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Count active feeds from rss_feeds table
    const { count: activeFeedsCount } = await supabaseService.supabase
      .from('rss_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    res.json({
      success: true,
      stats: stats || {
        totalArticles: totalArticles || 0,
        totalUsers: totalUsers || 0,
        activeFeeds: activeFeedsCount || 0
      }
    });
  } catch (error) {
    console.error('❌ Erreur analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/campaigns - Liste campagnes publicitaires
// 🔒 SÉCURISÉ: Authentification admin requise
router.get('/campaigns', requireAdmin, async (req, res) => {
  try {
    const { data: campaigns } = await supabaseService.supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      campaigns: campaigns || []
    });
  } catch (error) {
    console.error('❌ Erreur get campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/campaigns - Créer campagne
router.post('/campaigns', requireAdmin, async (req, res) => {
  try {
    const { name, budget, start_date, end_date, status } = req.body;

    const { data: campaign, error } = await supabaseService.supabase
      .from('campaigns')
      .insert({
        name,
        budget,
        start_date,
        end_date,
        status: status || 'draft'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (error) {
    console.error('❌ Erreur create campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/clients - Liste clients
router.get('/clients', requireAdmin, async (req, res) => {
  try {
    const { data: clients } = await supabaseService.supabase
      .from('ad_clients')
      .select('*')
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      clients: clients || []
    });
  } catch (error) {
    console.error('❌ Erreur get clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/clients - Créer client
router.post('/clients', requireAdmin, async (req, res) => {
  try {
    const { name, email, company, phone, status } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le nom et l\'email sont obligatoires' 
      });
    }

    const { data: client, error } = await supabaseService.supabase
      .from('ad_clients')
      .insert({
        name,
        email,
        company,
        phone,
        status: status || 'active'
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      client
    });
  } catch (error) {
    console.error('❌ Erreur create client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/clients/:id - Mettre à jour client
router.put('/clients/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: client, error } = await supabaseService.supabase
      .from('ad_clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      client
    });
  } catch (error) {
    console.error('❌ Erreur update client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/clients/:id - Supprimer client
router.delete('/clients/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService.supabase
      .from('ad_clients')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Client supprimé'
    });
  } catch (error) {
    console.error('❌ Erreur delete client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/slides - Liste slides publicitaires
router.get('/slides', requireAdmin, async (req, res) => {
  try {
    const { data: slides } = await supabaseService.supabase
      .from('ad_slides')
      .select('*')
      .order('order_index', { ascending: true });

    res.json({
      success: true,
      slides: slides || []
    });
  } catch (error) {
    console.error('❌ Erreur get slides:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/slides - Créer slide
router.post('/slides', requireAdmin, async (req, res) => {
  try {
    const { title, image_url, link_url, is_active, order_index } = req.body;

    const { data: slide, error } = await supabaseService.supabase
      .from('ad_slides')
      .insert({
        title,
        image_url,
        link_url,
        is_active: is_active !== undefined ? is_active : true,
        order_index: order_index || 0
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      slide
    });
  } catch (error) {
    console.error('❌ Erreur create slide:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/slides/:id - Mettre à jour slide
router.put('/slides/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: slide, error } = await supabaseService.supabase
      .from('ad_slides')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      slide
    });
  } catch (error) {
    console.error('❌ Erreur update slide:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/slides/:id - Supprimer slide
router.delete('/slides/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService.supabase
      .from('ad_slides')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Slide supprimé'
    });
  } catch (error) {
    console.error('❌ Erreur delete slide:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/routes - Liste routes personnalisées
router.get('/routes', requireAdmin, async (req, res) => {
  try {
    const { data: routes } = await supabaseService.supabase
      .from('custom_routes')
      .select('*')
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      routes: routes || []
    });
  } catch (error) {
    console.error('❌ Erreur get routes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/routes - Créer route
router.post('/routes', requireAdmin, async (req, res) => {
  try {
    const { path, redirect_to, is_active } = req.body;

    if (!path || !redirect_to) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le chemin et la redirection sont obligatoires' 
      });
    }

    const { data: route, error } = await supabaseService.supabase
      .from('custom_routes')
      .insert({
        path,
        redirect_to,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      route
    });
  } catch (error) {
    console.error('❌ Erreur create route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/routes/:id - Mettre à jour route
router.put('/routes/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: route, error } = await supabaseService.supabase
      .from('custom_routes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      route
    });
  } catch (error) {
    console.error('❌ Erreur update route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/admin/routes/:id - Supprimer route
router.delete('/routes/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseService.supabase
      .from('custom_routes')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Route supprimée'
    });
  } catch (error) {
    console.error('❌ Erreur delete route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
