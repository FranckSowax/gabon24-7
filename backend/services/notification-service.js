/**
 * 🔔 SERVICE DE NOTIFICATIONS CENTRALISÉ
 * 
 * Gère l'envoi de notifications admin et utilisateur
 * pour tous les événements de l'application.
 */

const { supabase } = require('../config/supabase');

class NotificationService {
  constructor() {
    if (supabase) {
      this.supabase = supabase;
      this.isConfigured = true;
    } else {
      console.warn('⚠️ NotificationService: Supabase non configuré');
      this.isConfigured = false;
    }
  }

  /**
   * Envoyer une notification admin
   * @param {Object} notification - Données de la notification
   */
  async sendAdminNotification(notification) {
    if (!this.isConfigured) {
      console.warn('⚠️ NotificationService non configuré');
      return null;
    }

    const {
      title,
      message,
      type = 'info', // info, success, warning, error, system
      category = 'system', // system, user, content, payment, security, ai
      priority = 'normal', // low, normal, high, urgent
      source = null,
      actionUrl = null,
      actionLabel = null,
      referenceType = null,
      referenceId = null,
      metadata = {},
      expiresAt = null
    } = notification;

    try {
      const { data, error } = await this.supabase
        .from('admin_notifications')
        .insert({
          title,
          message,
          type,
          category,
          priority,
          source,
          action_url: actionUrl,
          action_label: actionLabel,
          reference_type: referenceType,
          reference_id: referenceId,
          metadata,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`🔔 Notification admin envoyée: ${title}`);
      return data;
    } catch (error) {
      console.error('❌ Erreur envoi notification admin:', error);
      return null;
    }
  }

  /**
   * Envoyer une notification utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} notification - Données de la notification
   */
  async sendUserNotification(userId, notification) {
    if (!this.isConfigured) {
      console.warn('⚠️ NotificationService non configuré');
      return null;
    }

    const {
      title,
      message,
      type = 'info',
      category = 'system',
      priority = 'normal',
      actionUrl = null,
      actionLabel = null,
      referenceType = null,
      referenceId = null,
      metadata = {}
    } = notification;

    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          category,
          priority,
          action_url: actionUrl,
          action_label: actionLabel,
          reference_type: referenceType,
          reference_id: referenceId,
          metadata
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`🔔 Notification utilisateur envoyée à ${userId}: ${title}`);
      return data;
    } catch (error) {
      console.error('❌ Erreur envoi notification utilisateur:', error);
      return null;
    }
  }

  // ============================================
  // NOTIFICATIONS PRÉ-DÉFINIES
  // ============================================

  /**
   * Nouvel utilisateur inscrit
   */
  async notifyNewUser(user) {
    return this.sendAdminNotification({
      title: 'Nouvel utilisateur inscrit',
      message: `${user.email || user.name || 'Un utilisateur'} vient de s'inscrire sur la plateforme.`,
      type: 'info',
      category: 'user',
      priority: 'normal',
      source: 'auth-service',
      actionUrl: '/admin/users',
      actionLabel: 'Voir les utilisateurs',
      referenceType: 'user',
      referenceId: user.id,
      metadata: { email: user.email, name: user.name }
    });
  }

  /**
   * Achat de crédits
   */
  async notifyCreditPurchase(userId, amount, credits) {
    // Notification admin
    await this.sendAdminNotification({
      title: 'Achat de crédits',
      message: `Un utilisateur a acheté ${credits} crédits pour ${amount} FCFA.`,
      type: 'success',
      category: 'payment',
      priority: 'normal',
      source: 'payment-service',
      actionUrl: '/admin/users',
      actionLabel: 'Voir le détail',
      referenceType: 'user',
      referenceId: userId,
      metadata: { amount, credits }
    });

    // Notification utilisateur
    return this.sendUserNotification(userId, {
      title: 'Achat confirmé',
      message: `Votre achat de ${credits} crédits a été confirmé. Merci !`,
      type: 'success',
      category: 'payment',
      actionUrl: '/dashboard/credits',
      actionLabel: 'Voir mes crédits'
    });
  }

  /**
   * Synchronisation RSS terminée
   */
  async notifyRssSync(articlesCount, feedsCount) {
    return this.sendAdminNotification({
      title: 'Synchronisation RSS terminée',
      message: `${articlesCount} nouveaux articles importés depuis ${feedsCount} flux RSS.`,
      type: 'info',
      category: 'content',
      priority: 'normal',
      source: 'rss-sync',
      actionUrl: '/admin/veille',
      actionLabel: 'Voir les articles',
      metadata: { articlesCount, feedsCount }
    });
  }

  /**
   * Erreur système
   */
  async notifySystemError(errorMessage, source = 'system') {
    return this.sendAdminNotification({
      title: 'Erreur système',
      message: errorMessage,
      type: 'error',
      category: 'system',
      priority: 'high',
      source,
      actionUrl: '/admin/settings',
      actionLabel: 'Voir les logs'
    });
  }

  /**
   * Alerte de sécurité
   */
  async notifySecurityAlert(message, details = {}) {
    return this.sendAdminNotification({
      title: 'Alerte de sécurité',
      message,
      type: 'warning',
      category: 'security',
      priority: 'urgent',
      source: 'security-service',
      actionUrl: '/admin/settings',
      actionLabel: 'Vérifier',
      metadata: details
    });
  }

  /**
   * Configuration IA mise à jour
   */
  async notifyAiConfigUpdate(changes = {}) {
    return this.sendAdminNotification({
      title: 'Configuration IA mise à jour',
      message: 'Les paramètres de tarification IA ont été modifiés.',
      type: 'info',
      category: 'ai',
      priority: 'normal',
      source: 'pricing-service',
      actionUrl: '/admin/tarification',
      actionLabel: 'Voir la tarification',
      metadata: changes
    });
  }

  /**
   * Nouveau projet créé par un utilisateur
   */
  async notifyNewProject(userId, project) {
    // Notification admin
    await this.sendAdminNotification({
      title: 'Nouveau projet créé',
      message: `Un utilisateur a créé le projet "${project.titre || project.title}".`,
      type: 'info',
      category: 'user',
      priority: 'low',
      source: 'project-service',
      referenceType: 'project',
      referenceId: project.id,
      metadata: { projectTitle: project.titre || project.title }
    });

    // Notification utilisateur
    return this.sendUserNotification(userId, {
      title: 'Projet créé avec succès',
      message: `Votre projet "${project.titre || project.title}" a été créé. Commencez à travailler dessus !`,
      type: 'success',
      category: 'system',
      actionUrl: `/dashboard/projets/${project.id}`,
      actionLabel: 'Voir le projet'
    });
  }

  /**
   * Analyse IA terminée
   */
  async notifyAiAnalysisComplete(userId, analysisType, result) {
    return this.sendUserNotification(userId, {
      title: 'Analyse IA terminée',
      message: `Votre ${analysisType} est prête. Consultez les résultats.`,
      type: 'success',
      category: 'ai',
      actionUrl: result.actionUrl || '/dashboard',
      actionLabel: 'Voir les résultats',
      metadata: { analysisType }
    });
  }

  /**
   * Crédits faibles
   */
  async notifyLowCredits(userId, remainingCredits) {
    return this.sendUserNotification(userId, {
      title: 'Crédits faibles',
      message: `Il vous reste ${remainingCredits} crédits. Rechargez pour continuer à utiliser les fonctionnalités premium.`,
      type: 'warning',
      category: 'payment',
      priority: 'high',
      actionUrl: '/dashboard/credits',
      actionLabel: 'Recharger'
    });
  }

  /**
   * Nouvel article publié (pour les abonnés)
   */
  async notifyNewArticle(userIds, article) {
    const promises = userIds.map(userId => 
      this.sendUserNotification(userId, {
        title: 'Nouvel article',
        message: article.title,
        type: 'info',
        category: 'content',
        actionUrl: `/articles/${article.slug || article.id}`,
        actionLabel: 'Lire',
        referenceType: 'article',
        referenceId: article.id
      })
    );

    return Promise.all(promises);
  }

  /**
   * WhatsApp - Message envoyé
   */
  async notifyWhatsAppBroadcast(recipientsCount, messageType) {
    return this.sendAdminNotification({
      title: 'Diffusion WhatsApp envoyée',
      message: `Message ${messageType} envoyé à ${recipientsCount} destinataires.`,
      type: 'success',
      category: 'system',
      priority: 'normal',
      source: 'whatsapp-service',
      actionUrl: '/admin/whatsapp',
      actionLabel: 'Voir les messages',
      metadata: { recipientsCount, messageType }
    });
  }

  /**
   * Mode maintenance activé/désactivé
   */
  async notifyMaintenanceMode(enabled) {
    return this.sendAdminNotification({
      title: enabled ? 'Mode maintenance activé' : 'Mode maintenance désactivé',
      message: enabled 
        ? 'Le site est maintenant en mode maintenance. Les utilisateurs ne peuvent pas accéder aux fonctionnalités.'
        : 'Le mode maintenance a été désactivé. Le site est de nouveau accessible.',
      type: enabled ? 'warning' : 'success',
      category: 'system',
      priority: enabled ? 'high' : 'normal',
      source: 'system',
      actionUrl: '/admin/settings',
      actionLabel: 'Paramètres'
    });
  }
}

// Singleton
const notificationService = new NotificationService();

module.exports = notificationService;
module.exports.NotificationService = NotificationService;
