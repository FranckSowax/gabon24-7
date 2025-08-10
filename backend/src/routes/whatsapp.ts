import { Router } from 'express';

const router = Router();

// Route de test simple pour WhatsApp
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: { status: 'connected' },
    message: 'WhatsApp en cours de développement'
  });
});

export default router;
