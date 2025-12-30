import { Router } from 'express';

const router = Router();

// Route de test simple pour les abonnements
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Abonnements en cours de développement'
  });
});

export default router;
