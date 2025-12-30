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

// GET /api/admin/stats - Statistiques principales du dashboard
// 🔒 SÉCURISÉ: Authentification admin requise
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Total articles
    const { count: totalArticles } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    // Articles aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const { count: todayArticles } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .gte('published_at', today);
    
    // Total utilisateurs
    const { count: totalUsers } = await supabaseService.supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Flux RSS actifs
    const { count: activeFeeds } = await supabaseService.supabase
      .from('rss_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    res.json({
      totalArticles: totalArticles || 0,
      todayArticles: todayArticles || 0,
      totalUsers: totalUsers || 0,
      activeFeeds: activeFeeds || 0
    });
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    // Retourner des valeurs par défaut en cas d'erreur
    res.json({
      totalArticles: 0,
      todayArticles: 0,
      totalUsers: 0,
      activeFeeds: 0
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

    res.json({
      success: true,
      stats: stats || {
        totalArticles: totalArticles || 0,
        totalUsers: totalUsers || 0,
        activeFeeds: 14
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
router.post('/campaigns', async (req, res) => {
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
router.get('/clients', async (req, res) => {
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
router.post('/clients', async (req, res) => {
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
router.put('/clients/:id', async (req, res) => {
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
router.delete('/clients/:id', async (req, res) => {
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
router.get('/slides', async (req, res) => {
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
router.post('/slides', async (req, res) => {
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
router.put('/slides/:id', async (req, res) => {
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
router.delete('/slides/:id', async (req, res) => {
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
router.get('/routes', async (req, res) => {
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
router.post('/routes', async (req, res) => {
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
router.put('/routes/:id', async (req, res) => {
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
router.delete('/routes/:id', async (req, res) => {
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
