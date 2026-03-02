/**
 * CRON: Scheduled Alert Processor
 * Toutes les heures (6h-21h UTC) = 7h-22h Gabon
 *
 * Appelle POST /api/alerts/process sur le backend Railway
 * qui fait le matching articles/keywords + envoi carrousel WhatsApp
 */

const BACKEND_URL = process.env.BACKEND_URL || 'https://gabon24-7-production.up.railway.app';
const CRON_SECRET = process.env.CRON_SECRET;

exports.handler = async (event, context) => {
  const startTime = Date.now();
  console.log('🔔 [CRON] Déclenchement du processeur d\'alertes...');

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Ajouter le secret cron si configuré (pour auth)
    if (CRON_SECRET) {
      headers['x-cron-secret'] = CRON_SECRET;
    }

    const response = await fetch(`${BACKEND_URL}/api/alerts/process`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: 'netlify-cron' }),
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      console.error(`❌ [CRON] Backend a répondu ${response.status}:`, data);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          success: false,
          error: data.error || `Backend status ${response.status}`,
          duration_ms: duration
        })
      };
    }

    console.log(`✅ [CRON] Traitement terminé en ${duration}ms:`, JSON.stringify(data));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...data,
        duration_ms: duration,
        source: 'netlify-cron'
      })
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [CRON] Erreur appel backend:`, error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        duration_ms: duration
      })
    };
  }
};
