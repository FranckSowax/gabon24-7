import { Router } from 'express';

const router = Router();

// Route de test simple pour les journalistes
router.get('/editorials', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Outils journalistes en cours de développement'
  });
});

export default router;
