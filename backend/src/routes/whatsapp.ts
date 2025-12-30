import { Router } from 'express';
import { whatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';

const router = Router();

// Route de test simple pour WhatsApp
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: { status: 'connected' },
    message: 'WhatsApp service actif'
  });
});

// Déclencher l'envoi manuel des articles en attente
router.post('/trigger', async (req, res) => {
  try {
    const limit = req.body.limit ? parseInt(req.body.limit) : 5;
    logger.info(`Déclenchement manuel envoi WhatsApp (limite: ${limit})`);
    
    // Lancer en arrière-plan pour ne pas bloquer la requête
    whatsAppService.sendPendingArticles(limit).catch(err => {
      logger.error('Erreur lors de l\'envoi manuel WhatsApp:', err);
    });

    res.json({
      success: true,
      message: 'Envoi WhatsApp déclenché en arrière-plan'
    });
  } catch (error) {
    logger.error('Erreur route trigger WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Erreur interne' });
  }
});

export default router;
