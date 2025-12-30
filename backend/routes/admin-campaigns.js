const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');
const { sendCampaignApprovalNotification, sendCampaignRejectionNotification } = require('../services/emailService');

// Alias pour compatibilité avec le code existant
const isAdmin = requireAdmin;

// GET /api/admin/campaigns - Toutes les campagnes
router.get('/', isAdmin, async (req, res) => {
  try {
    const { status, campaign_type, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('campaigns')
      .select('*, user:user_id(email)')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (campaign_type) {
      query = query.eq('campaign_type', campaign_type);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Stats globales
    const { data: stats } = await supabase
      .from('campaigns')
      .select('status, count', { count: 'exact' });

    res.json({ 
      campaigns: data,
      total: count,
      stats: calculateStats(data)
    });

  } catch (error) {
    console.error('Erreur récupération campagnes admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/campaigns/stats - Statistiques globales
router.get('/stats', isAdmin, async (req, res) => {
  try {
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('status, budget, views, clicks, campaign_type');

    if (error) throw error;

    const stats = {
      total: campaigns.length,
      byStatus: {
        pending: campaigns.filter(c => c.status === 'pending').length,
        active: campaigns.filter(c => c.status === 'active').length,
        rejected: campaigns.filter(c => c.status === 'rejected').length,
        completed: campaigns.filter(c => c.status === 'completed').length,
      },
      byType: {
        'banner-home': campaigns.filter(c => c.campaign_type === 'banner-home').length,
        'banner-feed': campaigns.filter(c => c.campaign_type === 'banner-feed').length,
        'video-home': campaigns.filter(c => c.campaign_type === 'video-home').length,
        'article-trending': campaigns.filter(c => c.campaign_type === 'article-trending').length,
      },
      revenue: {
        total: campaigns.reduce((sum, c) => sum + (c.status === 'active' ? c.budget : 0), 0),
        pending: campaigns.reduce((sum, c) => sum + (c.status === 'pending' ? c.budget : 0), 0),
      },
      engagement: {
        totalViews: campaigns.reduce((sum, c) => sum + (c.views || 0), 0),
        totalClicks: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0),
        averageCTR: calculateAverageCTR(campaigns)
      }
    };

    res.json({ stats });

  } catch (error) {
    console.error('Erreur stats campagnes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/campaigns/:id/approve - Approuver une campagne
router.post('/:id/approve', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id; // Extrait du JWT par le middleware
    const { startDate, endDate } = req.body;

    // Récupérer la campagne
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (!campaign) {
      return res.status(404).json({ error: 'Campagne non trouvée' });
    }

    // Calculer les dates si non fournies
    const start = startDate || new Date().toISOString();
    const end = endDate || new Date(Date.now() + campaign.duration_days * 24 * 60 * 60 * 1000).toISOString();

    // Approuver
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        status: 'active',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        start_date: start,
        end_date: end
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Campagne approuvée: ${id}`);

    // Envoyer email de notification
    try {
      // Récupérer les infos utilisateur
      const { data: userData } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', data.user_id)
        .single();

      if (userData?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://gabon-insight.netlify.app';
        await sendCampaignApprovalNotification({
          userEmail: userData.email,
          userName: userData.full_name || 'Utilisateur',
          campaignTitle: data.title,
          startDate: data.start_date,
          endDate: data.end_date,
          campaignUrl: `${frontendUrl}/campaigns/${id}`
        });
        console.log('📧 Email d\'approbation envoyé');
      }
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email:', emailError.message);
      // Ne pas bloquer la réponse si l'email échoue
    }

    res.json({ 
      success: true,
      campaign: data,
      message: 'Campagne approuvée'
    });

  } catch (error) {
    console.error('❌ Erreur approbation campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/campaigns/:id/reject - Rejeter une campagne
router.post('/:id/reject', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id; // Extrait du JWT par le middleware
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Raison du rejet requise' });
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
        rejection_reason: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`❌ Campagne rejetée: ${id}`);

    // Envoyer email de notification avec raison
    try {
      // Récupérer les infos utilisateur
      const { data: userData } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', data.user_id)
        .single();

      if (userData?.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://gabon-insight.netlify.app';
        await sendCampaignRejectionNotification({
          userEmail: userData.email,
          userName: userData.full_name || 'Utilisateur',
          campaignTitle: data.title,
          rejectionReason: reason,
          campaignUrl: `${frontendUrl}/campaigns/${id}`
        });
        console.log('📧 Email de rejet envoyé');
      }
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email:', emailError.message);
      // Ne pas bloquer la réponse si l'email échoue
    }

    res.json({ 
      success: true,
      campaign: data,
      message: 'Campagne rejetée'
    });

  } catch (error) {
    console.error('❌ Erreur rejet campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/campaigns/:id/pause - Mettre en pause une campagne
router.patch('/:id/pause', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      campaign: data,
      message: 'Campagne mise en pause'
    });

  } catch (error) {
    console.error('❌ Erreur pause campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/campaigns/:id/resume - Reprendre une campagne
router.patch('/:id/resume', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      campaign: data,
      message: 'Campagne reprise'
    });

  } catch (error) {
    console.error('❌ Erreur reprise campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/campaigns/:id/complete - Marquer comme terminée
router.patch('/:id/complete', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ status: 'completed' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      campaign: data,
      message: 'Campagne terminée'
    });

  } catch (error) {
    console.error('❌ Erreur complétion campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/campaigns/:id/notes - Ajouter des notes admin
router.put('/:id/notes', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data, error } = await supabase
      .from('campaigns')
      .update({ admin_notes: notes })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      campaign: data
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour notes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/campaigns/:id - Supprimer une campagne (soft delete)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // On ne supprime pas vraiment, on marque juste comme rejetée
    const { data, error } = await supabase
      .from('campaigns')
      .update({ 
        status: 'rejected',
        rejection_reason: 'Supprimée par l\'administrateur'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      message: 'Campagne supprimée'
    });

  } catch (error) {
    console.error('❌ Erreur suppression campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonctions utilitaires
function calculateStats(campaigns) {
  return {
    pending: campaigns.filter(c => c.status === 'pending').length,
    active: campaigns.filter(c => c.status === 'active').length,
    rejected: campaigns.filter(c => c.status === 'rejected').length,
    totalRevenue: campaigns
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + c.budget, 0)
  };
}

function calculateAverageCTR(campaigns) {
  const activeCampaigns = campaigns.filter(c => c.views > 0);
  if (activeCampaigns.length === 0) return 0;
  
  const totalCTR = activeCampaigns.reduce((sum, c) => {
    return sum + (c.clicks / c.views * 100);
  }, 0);
  
  return (totalCTR / activeCampaigns.length).toFixed(2);
}

module.exports = router;
