/**
 * Service d'alertes pour monitorer le quota OpenAI
 * Envoie des notifications par Email et/ou Slack
 */

const nodemailer = require('nodemailer');

// Configuration Email
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// État des alertes (éviter spam)
const alertState = {
  lastWarningAlert: null,      // 80%
  lastCriticalAlert: null,      // 90%
  lastExhaustedAlert: null,     // 100%
  lastErrorAlert: null,         // Erreurs multiples
  cooldownMinutes: 60           // Délai entre alertes similaires
};

/**
 * Vérifie si on peut envoyer une alerte (cooldown)
 */
function canSendAlert(alertType) {
  const lastAlert = alertState[`last${alertType}Alert`];
  if (!lastAlert) return true;
  
  const cooldownMs = alertState.cooldownMinutes * 60 * 1000;
  return (Date.now() - lastAlert) > cooldownMs;
}

/**
 * Enregistre qu'une alerte a été envoyée
 */
function recordAlert(alertType) {
  alertState[`last${alertType}Alert`] = Date.now();
}

/**
 * Envoie une alerte par Email
 */
async function sendEmailAlert(subject, message, details = {}) {
  if (!process.env.SMTP_USER || !process.env.ALERT_EMAIL_TO) {
    console.log('📧 Email non configuré, alerte ignorée');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🚨 Alerte Gabon24/7 IA</h2>
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3 style="color: #333;">${subject}</h3>
          <p style="color: #666; line-height: 1.6;">${message}</p>
          
          ${Object.keys(details).length > 0 ? `
            <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 20px;">
              <h4 style="margin-top: 0; color: #333;">Détails:</h4>
              <ul style="color: #666; line-height: 1.8;">
                ${Object.entries(details).map(([key, value]) => 
                  `<li><strong>${key}:</strong> ${value}</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
            <p style="margin: 0; color: #856404;">
              <strong>Action requise:</strong> Consultez le dashboard admin pour plus d'informations.
            </p>
          </div>
        </div>
        <div style="text-align: center; padding: 15px; color: #999; font-size: 12px;">
          <p>Gabon24/7 - Système de monitoring IA</p>
          <p>${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })}</p>
        </div>
      </div>
    `;

    await emailTransporter.sendMail({
      from: `"Gabon24/7 Alerts" <${process.env.SMTP_USER}>`,
      to: process.env.ALERT_EMAIL_TO,
      subject: `[Gabon24/7] ${subject}`,
      text: message + '\n\n' + JSON.stringify(details, null, 2),
      html: htmlMessage
    });

    console.log('✅ Email envoyé:', subject);
    return { sent: true };
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Envoie une alerte sur Slack
 */
async function sendSlackAlert(subject, message, details = {}, severity = 'warning') {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  
  if (!slackWebhook) {
    console.log('💬 Slack non configuré, alerte ignorée');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    // Couleurs selon sévérité
    const colors = {
      info: '#36a64f',
      warning: '#ff9800',
      critical: '#f44336',
      error: '#9c27b0'
    };

    const payload = {
      username: 'Gabon24/7 AI Monitor',
      icon_emoji: ':robot_face:',
      attachments: [{
        color: colors[severity] || colors.warning,
        title: subject,
        text: message,
        fields: Object.entries(details).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        })),
        footer: 'Gabon24/7 Monitoring',
        footer_icon: 'https://platform.slack-edge.com/img/default_application_icon.png',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const response = await fetch(slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Slack notifié:', subject);
      return { sent: true };
    } else {
      throw new Error(`Slack error: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Erreur Slack:', error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Alerte principale avec cooldown et multi-canal
 */
async function sendAlert(type, subject, message, details = {}) {
  // Vérifier cooldown
  const alertTypeKey = type.charAt(0).toUpperCase() + type.slice(1);
  if (!canSendAlert(alertTypeKey)) {
    console.log(`⏸️  Alerte ${type} en cooldown, ignorée`);
    return { sent: false, reason: 'cooldown' };
  }

  // Déterminer la sévérité
  const severityMap = {
    warning: 'warning',
    critical: 'critical',
    exhausted: 'critical',
    error: 'error'
  };
  const severity = severityMap[type] || 'warning';

  // Envoyer sur tous les canaux configurés
  const results = {
    email: null,
    slack: null
  };

  if (process.env.ALERT_EMAIL_TO) {
    results.email = await sendEmailAlert(subject, message, details);
  }

  if (process.env.SLACK_WEBHOOK_URL) {
    results.slack = await sendSlackAlert(subject, message, details, severity);
  }

  // Enregistrer l'alerte
  recordAlert(alertTypeKey);

  const sentCount = [results.email?.sent, results.slack?.sent].filter(Boolean).length;
  console.log(`📢 Alerte ${type}: ${sentCount} canal(aux) notifié(s)`);

  return {
    sent: sentCount > 0,
    results
  };
}

/**
 * Alertes spécifiques par scénario
 */

async function alertBudgetWarning(quotaStatus) {
  return sendAlert(
    'warning',
    `⚠️ Budget IA à ${quotaStatus.percentageUsed}%`,
    `Le budget OpenAI mensuel atteint ${quotaStatus.percentageUsed}%. Surveillez la consommation pour éviter une interruption de service.`,
    {
      'Budget total': `$${quotaStatus.monthlyBudget}`,
      'Dépensé': `$${quotaStatus.totalSpent}`,
      'Restant': `$${quotaStatus.remainingBudget}`,
      'Requêtes aujourd\'hui': quotaStatus.requestsToday,
      'Requêtes restantes (estimées)': quotaStatus.estimatedRequestsLeft
    }
  );
}

async function alertBudgetCritical(quotaStatus) {
  return sendAlert(
    'critical',
    `🚨 CRITIQUE: Budget IA à ${quotaStatus.percentageUsed}%`,
    `ALERTE CRITIQUE! Le budget OpenAI est presque épuisé (${quotaStatus.percentageUsed}%). Le service sera bientôt indisponible. Action immédiate requise!`,
    {
      'Budget total': `$${quotaStatus.monthlyBudget}`,
      'Dépensé': `$${quotaStatus.totalSpent}`,
      'Restant': `$${quotaStatus.remainingBudget}`,
      'Requêtes restantes': quotaStatus.estimatedRequestsLeft,
      'Action': 'Augmenter OPENAI_MONTHLY_BUDGET ou attendre le reset mensuel'
    }
  );
}

async function alertBudgetExhausted() {
  return sendAlert(
    'exhausted',
    '🛑 Budget IA ÉPUISÉ',
    'Le budget OpenAI mensuel est entièrement consommé. Le service IA est désactivé jusqu\'au prochain reset.',
    {
      'Status': 'Service IA DÉSACTIVÉ',
      'Action urgente': 'Reset manuel via /api/ai/admin/reset-quota ou attendre le 1er du mois',
      'Impact': 'Les utilisateurs ne peuvent plus utiliser les fonctions IA'
    }
  );
}

async function alertTooManyErrors(errorCount, recentErrors) {
  const errorSamples = recentErrors.slice(0, 3).map(e => 
    `${e.serviceName}: ${e.error}`
  ).join('\n');

  return sendAlert(
    'error',
    `⚠️ Erreurs OpenAI multiples détectées`,
    `${errorCount} erreurs OpenAI ont été détectées dans les 5 dernières minutes. Vérifiez la configuration et les logs.`,
    {
      'Nombre d\'erreurs': errorCount,
      'Échantillon': errorSamples,
      'Action': 'Vérifier les logs serveur et la configuration OpenAI'
    }
  );
}

async function alertRateLimitReached(limitType) {
  const messages = {
    hourly: 'La limite horaire de requêtes OpenAI a été atteinte.',
    daily: 'La limite journalière de requêtes OpenAI a été atteinte.'
  };

  return sendAlert(
    'warning',
    `⏸️ Rate Limit ${limitType} atteint`,
    messages[limitType] || 'Une limite de requêtes a été atteinte.',
    {
      'Type': limitType === 'hourly' ? 'Limite horaire' : 'Limite journalière',
      'Impact': 'Nouvelles requêtes bloquées temporairement',
      'Action': 'Augmenter les limites dans .env ou attendre le reset'
    }
  );
}

module.exports = {
  sendAlert,
  alertBudgetWarning,
  alertBudgetCritical,
  alertBudgetExhausted,
  alertTooManyErrors,
  alertRateLimitReached
};
