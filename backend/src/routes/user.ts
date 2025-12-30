import { Router } from 'express';

const router = Router();

// Route de test simple pour les utilisateurs
router.get('/profile', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'test',
      phone_number: '+241000000',
      subscription_tier: 'free',
      subscription_status: 'active'
    }
  });
});

export default router;
