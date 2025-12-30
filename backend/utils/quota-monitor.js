/**
 * 🚨 Système de surveillance du quota OpenAI
 * Alerte l'admin quand le quota est bas ou épuisé
 */

const supabase = require('../supabase-config');

// Cooldown pour éviter le spam d'alertes (1 heure)
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;
let lastAlertTime = {};

/**
 * Enregistre une alerte de quota dans la base de données
 */
async function logQuotaAlert(service, level, message, details = {}) {
  const alertKey = `${service}_${level}`;
  const now = Date.now();
  
  // Vérifier le cooldown
  if (lastAlertTime[alertKey] && (now - lastAlertTime[alertKey]) < ALERT_COOLDOWN_MS) {
    console.log(`⏳ Alerte ${alertKey} en cooldown, prochaine dans ${Math.round((ALERT_COOLDOWN_MS - (now - lastAlertTime[alertKey])) / 60000)} minutes`);
    return false;
  }

  try {
    // Enregistrer dans la table admin_alerts (à créer)
    const { error } = await supabase.supabase
      .from('admin_alerts')
      .insert({
        service,
        alert_type: 'quota_warning',
        severity: level,
        message,
        details: {
          ...details,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
        },
        status: 'new',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Erreur enregistrement alerte:', error.message);
      // Si la table n'existe pas, log dans un fichier
      await logToFile(service, level, message, details);
    } else {
      console.log(`✅ Alerte ${level} enregistrée pour ${service}`);
      lastAlertTime[alertKey] = now;
    }

    return true;
  } catch (e) {
    console.error('❌ Erreur système alerte:', e.message);
    await logToFile(service, level, message, details);
    return false;
  }
}

/**
 * Log dans un fichier si Supabase n'est pas disponible
 */
async function logToFile(service, level, message, details) {
  const fs = require('fs');
  const path = require('path');
  
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'quota-alerts.log');
  const logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${service}] ${message}\nDetails: ${JSON.stringify(details, null, 2)}\n${'='.repeat(80)}\n`;
  
  fs.appendFileSync(logFile, logEntry);
  console.log(`📝 Alerte logged to file: ${logFile}`);
}

/**
 * Vérifie une erreur OpenAI et génère une alerte si nécessaire
 */
async function checkOpenAIError(error, context = {}) {
  if (!error) return;

  const errorMessage = error.message || error.toString();
  const errorCode = error.code || error.status;

  // Quota dépassé (429)
  if (errorCode === 429 || errorMessage.includes('429') || errorMessage.includes('quota')) {
    console.error('🚨🚨🚨 QUOTA OPENAI DÉPASSÉ 🚨🚨🚨');
    console.error('Message:', errorMessage);
    
    await logQuotaAlert(
      'openai',
      'critical',
      '🚨 QUOTA OPENAI ÉPUISÉ - Service indisponible',
      {
        error: errorMessage,
        context,
        action_required: 'Recharger le quota OpenAI immédiatement',
        impact: 'Les analyses IA sont temporairement indisponibles'
      }
    );

    // Envoyer aussi une notification console très visible
    console.error('\n' + '🔴'.repeat(40));
    console.error('🔴 ACTION REQUISE: QUOTA OPENAI ÉPUISÉ');
    console.error('🔴 Les utilisateurs ne peuvent plus faire d\'analyses');
    console.error('🔴 Recharger sur: https://platform.openai.com/account/billing');
    console.error('🔴'.repeat(40) + '\n');

    return true;
  }

  // Erreurs d'authentification
  if (errorCode === 401 || errorMessage.includes('401') || errorMessage.includes('authentication')) {
    console.error('🔑 ERREUR AUTHENTIFICATION OPENAI');
    
    await logQuotaAlert(
      'openai',
      'high',
      '🔑 Erreur authentification OpenAI - Vérifier la clé API',
      {
        error: errorMessage,
        context,
        action_required: 'Vérifier OPENAI_API_KEY dans .env'
      }
    );

    return true;
  }

  // Taux limite (rate limit)
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    console.warn('⚠️ Rate limit OpenAI atteint');
    
    await logQuotaAlert(
      'openai',
      'medium',
      '⚠️ Rate limit OpenAI - Trop de requêtes',
      {
        error: errorMessage,
        context,
        action_required: 'Surveiller la fréquence des requêtes'
      }
    );

    return true;
  }

  return false;
}

/**
 * Surveille l'utilisation et alerte si proche de la limite
 */
async function checkUsageThreshold(usage) {
  if (!usage || !usage.total_tokens) return;

  // Si on dépasse 10k tokens par requête, c'est beaucoup
  if (usage.total_tokens > 10000) {
    console.warn(`⚠️ Utilisation élevée: ${usage.total_tokens} tokens`);
    
    await logQuotaAlert(
      'openai',
      'low',
      `⚠️ Utilisation élevée détectée: ${usage.total_tokens} tokens`,
      {
        usage,
        recommendation: 'Optimiser les prompts pour réduire les coûts'
      }
    );
  }

  // Calculer le coût estimé (GPT-4o-mini: ~$0.15/1M input, ~$0.60/1M output)
  const estimatedCost = (
    (usage.prompt_tokens || 0) * 0.15 / 1_000_000 +
    (usage.completion_tokens || 0) * 0.60 / 1_000_000
  );

  if (estimatedCost > 0.05) { // Plus de 5 cents par requête
    console.warn(`💰 Coût élevé: ~$${estimatedCost.toFixed(4)}`);
  }
}

/**
 * Récupère les alertes non résolues pour l'admin
 */
async function getPendingAlerts() {
  try {
    const { data, error } = await supabase.supabase
      .from('admin_alerts')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Erreur récupération alertes:', e.message);
    return [];
  }
}

/**
 * Marque une alerte comme résolue
 */
async function resolveAlert(alertId) {
  try {
    const { error } = await supabase.supabase
      .from('admin_alerts')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) throw error;
    console.log(`✅ Alerte ${alertId} marquée comme résolue`);
    return true;
  } catch (e) {
    console.error('Erreur résolution alerte:', e.message);
    return false;
  }
}

module.exports = {
  logQuotaAlert,
  checkOpenAIError,
  checkUsageThreshold,
  getPendingAlerts,
  resolveAlert
};
