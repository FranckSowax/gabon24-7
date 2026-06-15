const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const notificationHelper = require('../utils/notificationHelper');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const supabase = supabaseService.supabase;

// Toutes les routes admin-notifications requièrent une authentification minimum
// (POST /new-user est appelé après signup, donc requireAuth suffit ;
//  les autres routes admin sont protégées par requireAdmin individuellement)
router.use(requireAuth);

/**
 * POST /api/admin-notifications/new-user
 * Notifier les admins d'un nouvel utilisateur
 * (À appeler depuis le frontend après inscription)
 */
router.post('/new-user', async (req, res) => {
  try {
    const { newUserId, newUserEmail, newUserName } = req.body;

    if (!newUserId || !newUserEmail) {
      return res.status(400).json({
        success: false,
        error: 'newUserId et newUserEmail requis'
      });
    }

    // Récupérer tous les admins
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id')
      .eq('subscription_type', 'enterprise');

    if (adminError) {
      console.error('❌ Erreur récupération admins:', adminError);
      // Ne pas bloquer si pas d'admins
      return res.json({
        success: true,
        message: 'Aucun admin à notifier'
      });
    }

    if (!admins || admins.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun admin trouvé'
      });
    }

    // Créer une notification pour chaque admin
    let notificationCount = 0;
    for (const admin of admins) {
      try {
        await notificationHelper.notifyNewUser(
          admin.id,
          newUserEmail,
          newUserName || newUserEmail
        );
        notificationCount++;
      } catch (notifError) {
        console.warn(`⚠️ Erreur notification admin ${admin.id}:`, notifError.message);
      }
    }

    console.log(`✅ ${notificationCount} notifications admin envoyées pour nouvel user`);

    res.json({
      success: true,
      notificationsSent: notificationCount,
      message: `${notificationCount} admin(s) notifié(s)`
    });

  } catch (error) {
    console.error('❌ Erreur notification nouvel utilisateur:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin-notifications/broadcast
 * Envoyer un message à tous les utilisateurs ou un groupe
 * (Réservé aux admins)
 */
router.post('/broadcast', requireAdmin, async (req, res) => {
  try {
    const { 
      adminId, 
      title, 
      message, 
      priority = 'normal',
      targetGroup = 'all', // 'all', 'premium', 'business', 'enterprise'
      actionUrl,
      actionLabel
    } = req.body;

    if (!adminId || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'adminId, title et message requis'
      });
    }

    // Vérifier que l'utilisateur est admin
    const { data: adminUser } = await supabase
      .from('users')
      .select('subscription_type')
      .eq('id', adminId)
      .single();

    if (!adminUser || adminUser.subscription_type !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Accès réservé aux administrateurs'
      });
    }

    // Récupérer les utilisateurs cibles
    let query = supabase.from('users').select('id');

    if (targetGroup !== 'all') {
      query = query.eq('subscription_type', targetGroup);
    }

    const { data: targetUsers, error: usersError } = await query;

    if (usersError) throw usersError;

    if (!targetUsers || targetUsers.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun utilisateur cible trouvé'
      });
    }

    // Créer les notifications
    const notifications = targetUsers.map(user => ({
      user_id: user.id,
      type: 'admin_message',
      category: 'admin',
      title: `📢 ${title}`,
      message: message,
      metadata: {
        sent_by_admin: adminId,
        target_group: targetGroup,
        broadcast_date: new Date().toISOString()
      },
      action_url: actionUrl || null,
      action_label: actionLabel || null,
      priority: priority,
      is_read: false,
      is_archived: false
    }));

    // Insérer en batch (par groupes de 100 pour éviter les timeouts)
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(batch);

      if (insertError) {
        console.error('❌ Erreur insertion batch:', insertError);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`✅ ${totalInserted} notifications broadcast envoyées`);

    res.json({
      success: true,
      notificationsSent: totalInserted,
      targetUsers: targetUsers.length,
      message: `Message envoyé à ${totalInserted} utilisateur(s)`
    });

  } catch (error) {
    console.error('❌ Erreur broadcast admin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin-notifications/system-update
 * Notifier tous les utilisateurs d'une mise à jour système
 */
router.post('/system-update', requireAdmin, async (req, res) => {
  try {
    const { 
      adminId,
      updateTitle, 
      updateMessage,
      version,
      features = []
    } = req.body;

    if (!adminId || !updateTitle || !updateMessage) {
      return res.status(400).json({
        success: false,
        error: 'adminId, updateTitle et updateMessage requis'
      });
    }

    // Vérifier que l'utilisateur est admin
    const { data: adminUser } = await supabase
      .from('users')
      .select('subscription_type')
      .eq('id', adminId)
      .single();

    if (!adminUser || adminUser.subscription_type !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Accès réservé aux administrateurs'
      });
    }

    // Récupérer tous les utilisateurs
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) throw usersError;

    if (!allUsers || allUsers.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun utilisateur à notifier'
      });
    }

    // Créer les notifications
    const notifications = allUsers.map(user => ({
      user_id: user.id,
      type: 'system_update',
      category: 'system',
      title: `🔔 ${updateTitle}`,
      message: updateMessage,
      metadata: {
        version: version || null,
        features: features,
        update_date: new Date().toISOString()
      },
      priority: 'low',
      is_read: false,
      is_archived: false
    }));

    // Insérer en batch
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(batch);

      if (insertError) {
        console.error('❌ Erreur insertion batch:', insertError);
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(`✅ ${totalInserted} notifications système envoyées`);

    res.json({
      success: true,
      notificationsSent: totalInserted,
      message: `Mise à jour notifiée à ${totalInserted} utilisateur(s)`
    });

  } catch (error) {
    console.error('❌ Erreur notification système:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin-notifications/stats
 * Statistiques des notifications pour les admins
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { adminId } = req.query;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: 'adminId requis'
      });
    }

    // Vérifier que l'utilisateur est admin
    const { data: adminUser } = await supabase
      .from('users')
      .select('subscription_type')
      .eq('id', adminId)
      .single();

    if (!adminUser || adminUser.subscription_type !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Accès réservé aux administrateurs'
      });
    }

    // Statistiques globales
    const { count: totalNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    const { count: unreadNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    const { count: adminNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'admin');

    const { count: systemNotifications } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'system');

    // Notifications par type
    const { data: byType } = await supabase
      .from('notifications')
      .select('type')
      .limit(10000);

    const typeCounts = {};
    if (byType) {
      byType.forEach(n => {
        typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
      });
    }

    res.json({
      success: true,
      stats: {
        total: totalNotifications || 0,
        unread: unreadNotifications || 0,
        admin: adminNotifications || 0,
        system: systemNotifications || 0,
        byType: typeCounts
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
