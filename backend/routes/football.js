/**
 * ROUTES FOOTBALL
 * Endpoints pour les scores de football
 * API: free-api-live-football-data (RapidAPI / FotMob)
 */

const express = require('express');
const router = express.Router();
const footballController = require('../controllers/footballController');

// GET /api/football/fixtures - Matchs en direct + fallback matchs du jour
router.get('/fixtures', footballController.getLiveFixtures);

// GET /api/football/fixtures/date?date=YYYYMMDD - Matchs par date
router.get('/fixtures/date', footballController.getFixturesByDate);

// GET /api/football/live-count - Nombre de matchs en direct
router.get('/live-count', footballController.getLiveCount);

// GET /api/football/leagues - Liste de toutes les ligues
router.get('/leagues', footballController.getLeagues);

// GET /api/football/league/:leagueId - Détails d'une ligue
router.get('/league/:leagueId', footballController.getLeagueDetail);

// GET /api/football/event/:eventId - Détails d'un match
router.get('/event/:eventId', footballController.getEventDetail);

// GET /api/football/h2h?team1=ID&team2=ID - Face à face
router.get('/h2h', footballController.getHeadToHead);

module.exports = router;
