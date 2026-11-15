/**
 * Scores de football en direct : GET /api/live-scores
 * Lecture publique, sans paramètre. Le serveur lit la source et la met en
 * cache (voir services/live-scores.js) ; le navigateur n'appelle que cette route.
 */

const express = require('express');
const { getLiveScores, COMPETITIONS } = require('../services/live-scores');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const payload = await getLiveScores();
    res.json({
      success: true,
      ...payload,
      competitions: COMPETITIONS.map(({ key, name, international }) => ({ key, name, international: Boolean(international) })),
    });
  } catch (error) {
    console.error('❌ live-scores :', error.message);
    // Pas de mise en cache d'une panne par le navigateur ou le CDN.
    res.set('Cache-Control', 'no-store');
    res.status(503).json({ success: false, error: 'Scores momentanément indisponibles', matches: [], liveCount: 0 });
  }
});

module.exports = router;
