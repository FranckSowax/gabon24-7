import { Router } from 'express';

const router = Router();

// Route de test simple pour l'authentification
router.post('/login', (req, res) => {
  res.json({
    success: true,
    message: 'Authentification en cours de développement',
    data: {
      user: { id: 'test', phone_number: '+241000000', subscription_tier: 'free' },
      access_token: 'test_token'
    }
  });
});

export default router;
