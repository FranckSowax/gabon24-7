/**
 * ⚽ ROUTES FOOTBALL
 * Endpoints pour les scores de football en direct
 */

const express = require('express');
const router = express.Router();
const footballController = require('../controllers/footballController');

// GET /api/football/fixtures - Matchs en direct
router.get('/fixtures', footballController.getLiveFixtures);

module.exports = router;
