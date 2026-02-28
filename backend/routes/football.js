/**
 * ROUTES FOOTBALL
 * Endpoints pour les scores de football en direct
 * API: free-football-api-data (RapidAPI)
 */

const express = require('express');
const router = express.Router();
const footballController = require('../controllers/footballController');

// ============================================
// LIVE SCORES
// ============================================

// GET /api/football/fixtures - Matchs en direct (live)
router.get('/fixtures', footballController.getLiveFixtures);

// GET /api/football/live-count - Nombre de matchs en direct
router.get('/live-count', footballController.getLiveCount);

// GET /api/football/live/country/:countryId - Matchs live par pays
router.get('/live/country/:countryId', footballController.getLiveByCountry);

// GET /api/football/live/league/:leagueId - Matchs live par ligue
router.get('/live/league/:leagueId', footballController.getLiveByLeague);

// ============================================
// EVENT DETAILS
// ============================================

// GET /api/football/event/:eventId - Détails d'un événement
router.get('/event/:eventId', footballController.getEventDetail);

// GET /api/football/event/:eventId/status - Statut d'un événement
router.get('/event/:eventId/status', footballController.getEventStatus);

// ============================================
// LEGACY (stubs)
// ============================================

// GET /api/football/fixtures/date - Matchs par date (stub)
router.get('/fixtures/date', footballController.getFixturesByDate);

// GET /api/football/h2h - Head-to-Head (stub)
router.get('/h2h', footballController.getHeadToHead);

// GET /api/football/standings - Classements (stub)
router.get('/standings', footballController.getStandings);

// GET /api/football/team - Info équipe (stub)
router.get('/team', footballController.getTeam);

// GET /api/football/teams/search - Recherche (stub)
router.get('/teams/search', footballController.searchTeams);

module.exports = router;
