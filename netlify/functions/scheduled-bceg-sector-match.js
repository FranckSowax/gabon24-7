// BCEG sector-match cron — chaque heure
// Hit /api/bceg/cron/sector-match qui :
//   1. Liste les users avec préférences WhatsApp actives
//   2. Cherche articles publiés dans la dernière heure
//   3. Match titre/catégorie/résumé vs secteurs préférés
//   4. Envoie WhatsApp via Whapi (idempotent via user_sector_matches_sent)

const fetch = require('node-fetch');

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.RAILWAY_PUBLIC_URL ||
  'https://gabon24-7-production.up.railway.app';

const CRON_SECRET = process.env.CRON_SECRET || '';

exports.handler = async () => {
  console.log('🏦 [cron] BCEG sector-match déclenché');

  if (!CRON_SECRET) {
    console.error('❌ CRON_SECRET absent — abandon');
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'CRON_SECRET missing' }) };
  }

  try {
    const url = `${BACKEND_URL}/api/bceg/cron/sector-match?key=${encodeURIComponent(CRON_SECRET)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
      timeout: 120000,
    });

    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = { raw: body }; }

    if (!response.ok) {
      console.error(`❌ Backend ${response.status}:`, parsed);
      return {
        statusCode: 502,
        body: JSON.stringify({ success: false, status: response.status, body: parsed }),
      };
    }

    console.log(`✅ BCEG sector-match: ${parsed.sent || 0} message(s) envoyé(s)`);
    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch (error) {
    console.error('❌ Erreur sector-match cron:', error.message);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};
