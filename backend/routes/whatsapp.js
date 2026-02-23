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

module.exports = router;
