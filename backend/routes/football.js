/**
 * ROUTES FOOTBALL
 * Endpoints pour les scores de football en direct
 * API: free-api-live-football-data (RapidAPI)
 */

const express = require('express');
const router = express.Router();
const footballController = require('../controllers/footballController');

// GET /api/football/fixtures - Matchs en direct (live)
router.get('/fixtures', footballController.getLiveFixtures);

// GET /api/football/fixtures/date - Matchs par date
// Params: date (YYYY-MM-DD), league (optionnel), season (optionnel)
router.get('/fixtures/date', footballController.getFixturesByDate);

// GET /api/football/h2h - Confrontations directes (Head-to-Head)
// Params: team1 (ID équipe 1), team2 (ID équipe 2), last (nombre de matchs, défaut 10)
router.get('/h2h', footballController.getHeadToHead);

// GET /api/football/standings - Classement d'une ligue
// Params: league (ID de la ligue), season (optionnel, année ex: 2024)
router.get('/standings', footballController.getStandings);

// GET /api/football/team - Infos d'une équipe
// Params: id (ID de l'équipe)
router.get('/team', footballController.getTeam);

// GET /api/football/teams/search - Recherche d'équipes
// Params: name (minimum 3 caractères)
router.get('/teams/search', footballController.searchTeams);

module.exports = router;
