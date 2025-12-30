import { Router } from 'express';

const router = Router();

// Route de test simple pour les articles
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Articles en cours de développement'
  });
});

export default router;
