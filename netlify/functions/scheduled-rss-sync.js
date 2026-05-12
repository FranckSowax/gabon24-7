// Fonction programmée RSS — déclenche la sync sur le backend Railway
// Le backend itère sur la table `rss_feeds` (Supabase) et fetch chaque flux
// individuellement via rss-parser-service.syncAllFeeds().
//
// Migration depuis la version bundle rss.app (HTTP 402 Payment Required).

const fetch = require('node-fetch');

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.RAILWAY_PUBLIC_URL ||
  'https://gabon24-7-production.up.railway.app';

const CRON_SECRET = process.env.CRON_SECRET || '';

exports.handler = async () => {
  console.log('📅 [cron] Sync RSS démarrée (mode multi-flux table)');
  console.log(`   Backend: ${BACKEND_URL}`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/rss/process-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET && { 'X-Cron-Secret': CRON_SECRET }),
      },
      // Timeout généreux : la sync peut prendre quelques minutes selon le nombre de flux
      timeout: 240000,
    });

    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }

    if (!response.ok) {
      console.error(`❌ Backend a renvoyé ${response.status}:`, parsed);
      return {
        statusCode: 502,
        body: JSON.stringify({ success: false, status: response.status, body: parsed }),
      };
    }

    console.log('✅ Sync RSS terminée:', parsed);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result: parsed }),
    };
  } catch (error) {
    console.error('❌ Erreur appel backend RSS:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
