const express = require('express');
const router = express.Router();
const { z } = require('zod');
const whapiService = require('../services/whapiService');
const { requireAdmin } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');

// Schéma de validation pour le trigger
const triggerSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
});

// Route de statut WhatsApp (publique pour health checks)
router.get('/status', async (req, res) => {
  try {
    const pending = await whapiService.getPendingCount();
    res.json({
      success: true,
      data: {
        status: 'connected',
        pendingArticles: pending.count
      },
      message: 'WhatsApp service actif'
    });
  } catch (error) {
    console.error('Erreur status WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Récupérer la liste des chaînes WhatsApp (admin)
router.get('/channels', requireAdmin, async (req, res) => {
  try {
    const result = await whapiService.getChannels();
    res.json({
      success: result.success,
      channels: result.channels
    });
  } catch (error) {
    console.error('Erreur channels WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Nombre d'articles en attente d'envoi (admin)
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const result = await whapiService.getPendingCount();
    res.json({
      success: result.success,
      count: result.count
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Déclencher l'envoi manuel des articles en attente (admin)
router.post('/trigger', requireAdmin, validateBody(triggerSchema), async (req, res) => {
  try {
    const { limit } = req.body;
    console.log(`Déclenchement manuel envoi WhatsApp (limite: ${limit}) par admin ${req.user.id}`);

    // Lancer en arrière-plan pour ne pas bloquer la requête
    whapiService.sendPendingArticles(limit).then(result => {
      console.log('Envoi WhatsApp terminé:', result);
    }).catch(err => {
      console.error('Erreur lors de l\'envoi manuel WhatsApp:', err);
    });

    res.json({
      success: true,
      message: 'Envoi WhatsApp déclenché en arrière-plan',
      triggeredBy: req.user.id
    });
  } catch (error) {
    console.error('Erreur route trigger WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

// Diagnostic public : compare WHAPI_CHANNEL_ID configuré vs channels accessibles via le token
// Sécurisé par CRON_SECRET en query (?key=...)
router.get('/diagnose', async (req, res) => {
  try {
    const providedKey = req.query.key;
    const validKeys = [
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ].filter(Boolean);
    if (!providedKey || !validKeys.includes(providedKey)) {
      return res.status(401).json({ success: false, error: 'key requis (?key=CRON_SECRET)' });
    }

    const channelId = process.env.WHAPI_CHANNEL_ID || null;
    const mask = (id) => id ? `…${String(id).slice(-15)}` : null;

    const result = await whapiService.getChannels();

    const channels = (result.channels || []).map(c => ({
      id: c.id,
      id_masked: mask(c.id),
      name: c.name || c.title || '(sans nom)',
      role: c.role || null,
      matches_configured: c.id === channelId,
    }));
    const match = channels.find(c => c.matches_configured);

    res.json({
      success: true,
      configured_channel_id: channelId,
      configured_channel_id_masked: mask(channelId),
      configured_match_found: !!match,
      available_channels_count: channels.length,
      available_channels: channels,
      diagnosis: !channelId
        ? 'WHAPI_CHANNEL_ID NON CONFIGURÉ dans Railway env'
        : !match
          ? `WHAPI_CHANNEL_ID configuré (${mask(channelId)}) ne correspond à AUCUN channel accessible — corriger l'env Railway`
          : `OK : channel "${match.name}" reconnu et accessible`,
    });
  } catch (error) {
    console.error('Erreur diagnose WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test direct : envoie un message simple à un channel donné en argument (debug)
// POST /test-channel?key=CRON_SECRET   body: { channelId: "...", message: "..." }
router.post('/test-channel', async (req, res) => {
  try {
    const providedKey = req.query.key;
    const validKeys = [
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ].filter(Boolean);
    if (!providedKey || !validKeys.includes(providedKey)) {
      return res.status(401).json({ success: false, error: 'key requis (?key=CRON_SECRET)' });
    }

    const channelId = req.body.channelId || process.env.WHAPI_CHANNEL_ID;
    const message = req.body.message || '🧪 Test Gabon Insight — la chaîne est de retour !';

    if (!channelId) return res.status(400).json({ success: false, error: 'channelId requis (body ou env)' });

    const axios = require('axios');
    const resp = await axios.post(
      'https://gate.whapi.cloud/messages/text',
      { to: channelId, body: message, typing_time: 0 },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      channelId,
      whapi_response: resp.data,
    });
  } catch (error) {
    console.error('Erreur test-channel:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      whapi_error: error.response?.data,
    });
  }
});

// Test: envoyer un carrousel avec les derniers articles (admin ou cron secret)
router.post('/test-carousel', async (req, res) => {
  try {
    // Auth: admin JWT ou secret (CRON_SECRET / SUPABASE_SERVICE_ROLE_KEY)
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const validSecrets = [
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.OPENAI_API_KEY,
    ].filter(Boolean);
    const isSecretAuth = token && validSecrets.includes(token);

    if (!isSecretAuth) {
      // Fallback: vérifier admin JWT
      const { requireAdmin: checkAdmin } = require('../middleware/auth');
      await new Promise((resolve, reject) => {
        checkAdmin(req, res, (err) => err ? reject(err) : resolve());
      });
      if (res.headersSent) return;
    }

    const { limit = 5, phone } = req.body;
    const supabaseService = require('../supabase-config');
    const frontendUrl = process.env.FRONTEND_URL || 'https://gabon24-7.netlify.app';

    // Destination: numéro de téléphone (DM) ou chaîne WhatsApp
    let destination;
    if (phone) {
      // Nettoyer le numéro: enlever +, espaces, tirets
      destination = phone.replace(/[\s\-\+]/g, '') + '@s.whatsapp.net';
    } else {
      destination = process.env.WHAPI_CHANNEL_ID;
      if (!destination) {
        return res.status(400).json({ success: false, error: 'WHAPI_CHANNEL_ID non configuré et aucun phone fourni' });
      }
    }

    // Récupérer les derniers articles avec images
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary_ai, summary, source, image_urls')
      .not('image_urls', 'is', null)
      .order('published_at', { ascending: false })
      .limit(Math.min(limit, 10));

    if (error) throw error;
    if (!articles || articles.length === 0) {
      return res.json({ success: false, message: 'Aucun article avec image trouvé' });
    }

    console.log(`🧪 Test carrousel vers ${phone ? phone : 'chaîne'}: ${articles.length} articles`);
    const result = await whapiService.sendCarouselPost(destination, articles, frontendUrl);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Erreur test carrousel:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data
    });
  }
});

module.exports = router;
