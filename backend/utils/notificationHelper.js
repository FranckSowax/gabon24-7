const supabaseService = require('../supabase-config');

/**
 * Helper pour créer des notifications
 */
class NotificationHelper {
  /**
   * Créer une notification pour un utilisateur
   */
  async createNotification({
    userId,
    type,
    category,
    title,
    message,
    metadata = {},
    actionUrl = null,
    actionLabel = null,
    referenceType = null,
    referenceId = null,
    priority = 'normal',
    expiresAt = null
  }) {
    try {
      const { data, error } = await supabaseService.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type,
          category,
          title,
          message,
          metadata,
          action_url: actionUrl,
          action_label: actionLabel,
          reference_type: referenceType,
          reference_id: referenceId,
          priority,
          expires_at: expiresAt,
          is_read: false,
          is_archived: false
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur création notification:', error);
        return null;
      }

      console.log('✅ Notification créée:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      return null;
    }
  }

  /**
   * Notification pour correspondance d'alerte veille
   */
  async notifyAlertMatch(userId, alertName, articleTitle, articleUrl, matchedKeywords, confidenceScore) {
    return this.createNotification({
      userId,
      type: 'alert_match',
      category: 'veille',
      title: `🔔 Nouvelle correspondance: ${alertName}`,
      message: `L'article "${articleTitle}" correspond à votre alerte avec ${confidenceScore}% de confiance`,
      metadata: {
        alert_name: alertName,
        article_title: articleTitle,
        matched_keywords: matchedKeywords,
        confidence_score: confidenceScore
      },
      actionUrl: articleUrl,
      actionLabel: 'Lire l\'article',
      priority: confidenceScore > 80 ? 'high' : 'normal'
    });
  }

  /**
   * Notification pour document généré
   */
  async notifyDocumentGenerated(userId, projectId, documentType, documentTitle) {
    const typeLabels = {
      'custom-letter': 'Courrier',
      'custom-training': 'Formation',
      'skill-test': 'Test de compétences',
      'business-plan-section': 'Section de business plan',
      'action-plan': 'Plan d\'action'
    };

    const label = typeLabels[documentType] || 'Document';

    return this.createNotification({
      userId,
      type: 'document_generated',
      category: 'ia',
      title: `📄 ${label} généré avec succès`,
      message: `"${documentTitle}" est maintenant disponible dans votre bibliothèque`,
      metadata: {
        document_type: documentType,
        document_title: documentTitle
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Voir le document',
      referenceType: 'project',
      referenceId: projectId,
      priority: 'normal'
    });
  }

  /**
   * Notification pour courrier généré
   */
  async notifyLetterGenerated(userId, projectId, letterId, recipientName) {
    return this.createNotification({
      userId,
      type: 'letter_generated',
      category: 'ia',
      title: `✉️ Courrier généré`,
      message: `Votre courrier pour ${recipientName} est prêt`,
      metadata: {
        letter_id: letterId,
        recipient_name: recipientName
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Voir le courrier',
      referenceType: 'letter',
      referenceId: letterId,
      priority: 'normal'
    });
  }

  /**
   * Notification pour formation générée
   */
  async notifyTrainingGenerated(userId, projectId, trainingId, trainingTitle) {
    return this.createNotification({
      userId,
      type: 'training_generated',
      category: 'ia',
      title: `🎓 Formation générée`,
      message: `"${trainingTitle}" est disponible`,
      metadata: {
        training_id: trainingId,
        training_title: trainingTitle
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Commencer la formation',
      referenceType: 'training',
      referenceId: trainingId,
      priority: 'normal'
    });
  }

  /**
   * Notification pour test de compétences généré
   */
  async notifySkillTestGenerated(userId, projectId, testId, difficulty) {
    return this.createNotification({
      userId,
      type: 'skill_test_generated',
      category: 'ia',
      title: `🎯 Test de compétences prêt`,
      message: `Votre test de niveau ${difficulty} est disponible`,
      metadata: {
        test_id: testId,
        difficulty
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Passer le test',
      referenceType: 'skill_test',
      referenceId: testId,
      priority: 'normal'
    });
  }

  /**
   * Notification pour business plan prêt
   */
  async notifyBusinessPlanReady(userId, projectId, projectName) {
    return this.createNotification({
      userId,
      type: 'business_plan_ready',
      category: 'ia',
      title: `💼 Business plan complet`,
      message: `Le business plan de "${projectName}" est finalisé`,
      metadata: {
        project_name: projectName
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Consulter',
      referenceType: 'project',
      referenceId: projectId,
      priority: 'high'
    });
  }

  /**
   * Notification pour plan d'action prêt
   */
  async notifyActionPlanReady(userId, projectId, projectName, stepsCount) {
    return this.createNotification({
      userId,
      type: 'action_plan_ready',
      category: 'ia',
      title: `📋 Plan d'action généré`,
      message: `${stepsCount} étapes définies pour "${projectName}"`,
      metadata: {
        project_name: projectName,
        steps_count: stepsCount
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Voir le plan',
      referenceType: 'project',
      referenceId: projectId,
      priority: 'normal'
    });
  }

  /**
   * Notification pour projet partagé
   */
  async notifyProjectShared(userId, projectId, projectName, sharedBy) {
    return this.createNotification({
      userId,
      type: 'project_shared',
      category: 'project',
      title: `🤝 Projet partagé avec vous`,
      message: `${sharedBy} vous a donné accès à "${projectName}"`,
      metadata: {
        project_name: projectName,
        shared_by: sharedBy
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Ouvrir le projet',
      referenceType: 'project',
      referenceId: projectId,
      priority: 'normal'
    });
  }

  /**
   * Notification pour commentaire ajouté
   */
  async notifyCommentAdded(userId, projectId, projectName, commentAuthor, commentPreview) {
    return this.createNotification({
      userId,
      type: 'comment_added',
      category: 'project',
      title: `💬 Nouveau commentaire`,
      message: `${commentAuthor} a commenté "${projectName}": ${commentPreview}`,
      metadata: {
        project_name: projectName,
        comment_author: commentAuthor
      },
      actionUrl: `/business/mes-projets?project=${projectId}`,
      actionLabel: 'Voir le commentaire',
      referenceType: 'project',
      referenceId: projectId,
      priority: 'low'
    });
  }

  /**
   * Notification système (mise à jour)
   */
  async notifySystemUpdate(userId, updateTitle, updateMessage) {
    return this.createNotification({
      userId,
      type: 'system_update',
      category: 'system',
      title: `🔔 ${updateTitle}`,
      message: updateMessage,
      priority: 'low'
    });
  }

  /**
   * Notification admin (message)
   */
  async notifyAdminMessage(userId, messageTitle, messageContent, priority = 'normal') {
    return this.createNotification({
      userId,
      type: 'admin_message',
      category: 'admin',
      title: `📢 ${messageTitle}`,
      message: messageContent,
      priority
    });
  }

  /**
   * Notification pour nouvel utilisateur (admin only)
   */
  async notifyNewUser(adminUserId, newUserEmail, newUserName) {
    return this.createNotification({
      userId: adminUserId,
      type: 'new_user',
      category: 'admin',
      title: `👤 Nouvel utilisateur`,
      message: `${newUserName} (${newUserEmail}) vient de s'inscrire`,
      metadata: {
        user_email: newUserEmail,
        user_name: newUserName
      },
      actionUrl: '/admin/users',
      actionLabel: 'Voir les utilisateurs',
      priority: 'low'
    });
  }

  /**
   * Envoyer une notification à tous les admins
   */
  async notifyAllAdmins(title, message, metadata = {}, priority = 'normal') {
    try {
      // Récupérer tous les admins (à adapter selon votre logique)
      const { data: admins, error } = await supabaseService.supabase
        .from('users')
        .select('id')
        .eq('subscription_type', 'enterprise'); // Ou autre critère pour identifier les admins

      if (error || !admins || admins.length === 0) {
        console.log('⚠️ Aucun admin trouvé');
        return;
      }

      // Créer une notification pour chaque admin
      const promises = admins.map(admin =>
        this.createNotification({
          userId: admin.id,
          type: 'admin_message',
          category: 'admin',
          title,
          message,
          metadata,
          priority
        })
      );

      await Promise.all(promises);
      console.log(`✅ ${admins.length} notifications admin créées`);
    } catch (error) {
      console.error('❌ Erreur notification admins:', error);
    }
  }
}

module.exports = new NotificationHelper();
