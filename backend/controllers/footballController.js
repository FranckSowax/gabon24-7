/**
 * FOOTBALL CONTROLLER
 * Scores de football en direct via free-api-live-football-data (RapidAPI)
 *
 * API: https://rapidapi.com/Creativesdev/api/free-api-live-football-data
 * Endpoints utilisés:
 *   - /football-current-live : matchs en direct
 *   - /football-popular-leagues : ligues populaires
 *
 * Le backend transforme la réponse de la nouvelle API en format compatible
 * avec le frontend (format API-Football v3) pour éviter de modifier le widget.
 */

const API_HOST = 'free-api-live-football-data.p.rapidapi.com';
const API_BASE = `https://${API_HOST}`;

// Cache pour les matchs en direct (2 minutes)
let fixturesCache = {
  data: null,
  timestamp: 0,
  expiry: 2 * 60 * 1000
};

/**
 * Headers pour l'API RapidAPI
 */
function getHeaders() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null;
  return {
    'x-rapidapi-host': API_HOST,
    'x-rapidapi-key': apiKey
  };
}

/**
 * Transforme un match de la nouvelle API (FotMob-style) en format API-Football v3
 * Le frontend attend: { fixture, league, teams, goals }
 *
 * La nouvelle API peut retourner plusieurs formats possibles.
 * Cette fonction gère les cas connus et log les formats inconnus.
 */
function transformMatch(match, index) {
  // Format A: Objet avec home/away comme sous-objets (FotMob-style)
  // { id, home: { name, id, score }, away: { name, id, score }, status, league/tournament, ... }
  if (match.home && match.away) {
    const homeScore = match.home.score ?? match.homeScore ?? match.scores?.home ?? null;
    const awayScore = match.away.score ?? match.awayScore ?? match.scores?.away ?? null;

    // Déterminer le statut du match
    let statusShort = 'LIVE';
    let statusLong = 'En cours';
    let elapsed = null;

    const rawStatus = match.status || match.matchStatus || {};
    if (typeof rawStatus === 'string') {
      statusShort = rawStatus.toUpperCase();
      statusLong = rawStatus;
    } else if (typeof rawStatus === 'object') {
      if (rawStatus.finished || rawStatus.cancelled) {
        statusShort = 'FT';
        statusLong = 'Terminé';
      } else if (rawStatus.started || rawStatus.ongoing) {
        statusShort = 'LIVE';
        statusLong = 'En cours';
      }
    }

    // Minutes écoulées
    elapsed = match.time?.minutes || match.minute || match.elapsed || match.min || null;
    if (typeof elapsed === 'string') elapsed = parseInt(elapsed, 10) || null;

    // Si le match a un statut textuel plus précis
    if (match.statusText) {
      statusLong = match.statusText;
      if (match.statusText.includes('HT') || match.statusText === 'Half Time') {
        statusShort = 'HT';
        statusLong = 'Mi-temps';
      }
    }

    // Ligue / Tournoi
    const league = match.league || match.tournament || match.competition || {};
    const leagueId = league.id || league.leagueId || 0;
    const leagueName = league.name || league.leagueName || 'Compétition';
    const leagueLogo = league.logo || (leagueId ? `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${leagueId}.png` : '');

    return {
      fixture: {
        id: match.id || match.matchId || index,
        date: match.date || match.utcTime || match.startTime || new Date().toISOString(),
        status: {
          short: statusShort,
          long: statusLong,
          elapsed: elapsed
        },
        venue: {
          name: match.venue?.name || match.stadium || null
        }
      },
      league: {
        id: leagueId,
        name: leagueName,
        logo: leagueLogo,
        round: league.round || league.roundName || null
      },
      teams: {
        home: {
          id: match.home.id || match.home.teamId || 0,
          name: match.home.name || match.home.teamName || 'Domicile',
          logo: match.home.logo || match.home.crest || '',
          winner: homeScore !== null && awayScore !== null ? homeScore > awayScore : null
        },
        away: {
          id: match.away.id || match.away.teamId || 0,
          name: match.away.name || match.away.teamName || 'Extérieur',
          logo: match.away.logo || match.away.crest || '',
          winner: homeScore !== null && awayScore !== null ? awayScore > homeScore : null
        }
      },
      goals: {
        home: homeScore,
        away: awayScore
      }
    };
  }

  // Format B: Objet plat avec homeTeam/awayTeam
  if (match.homeTeam && match.awayTeam) {
    const homeScore = match.homeScore ?? match.score?.home ?? null;
    const awayScore = match.awayScore ?? match.score?.away ?? null;

    return {
      fixture: {
        id: match.id || index,
        date: match.date || match.utcTime || new Date().toISOString(),
        status: {
          short: match.status === 'FINISHED' ? 'FT' : 'LIVE',
          long: match.status === 'FINISHED' ? 'Terminé' : 'En cours',
          elapsed: match.minute || null
        },
        venue: { name: match.venue || null }
      },
      league: {
        id: match.competition?.id || 0,
        name: match.competition?.name || 'Compétition',
        logo: match.competition?.logo || '',
        round: match.matchday ? `Journée ${match.matchday}` : null
      },
      teams: {
        home: {
          id: match.homeTeam.id || 0,
          name: match.homeTeam.name || match.homeTeam.shortName || 'Domicile',
          logo: match.homeTeam.crest || match.homeTeam.logo || '',
          winner: homeScore !== null && awayScore !== null ? homeScore > awayScore : null
        },
        away: {
          id: match.awayTeam.id || 0,
          name: match.awayTeam.name || match.awayTeam.shortName || 'Extérieur',
          logo: match.awayTeam.crest || match.awayTeam.logo || '',
          winner: homeScore !== null && awayScore !== null ? awayScore > homeScore : null
        }
      },
      goals: { home: homeScore, away: awayScore }
    };
  }

  // Format C: Déjà au format API-Football v3 (passthrough)
  if (match.fixture && match.teams && match.goals) {
    return match;
  }

  // Format inconnu - log pour debug et retourner un format valide
  console.warn('⚠️ Format match inconnu, clés:', Object.keys(match));
  return {
    fixture: {
      id: match.id || index,
      date: new Date().toISOString(),
      status: { short: 'LIVE', long: 'En cours', elapsed: null },
      venue: { name: null }
    },
    league: {
      id: 0,
      name: 'Match en direct',
      logo: '',
      round: null
    },
    teams: {
      home: { id: 0, name: 'Équipe A', logo: '', winner: null },
      away: { id: 0, name: 'Équipe B', logo: '', winner: null }
    },
    goals: { home: null, away: null }
  };
}

/**
 * Extrait la liste des matchs depuis la réponse de l'API
 * L'API peut retourner différentes structures
 */
function extractMatches(apiResponse) {
  if (!apiResponse) return [];

  const resp = apiResponse.response || apiResponse;

  // { response: { live: [...] } }
  if (resp.live && Array.isArray(resp.live)) return resp.live;

  // { response: { matches: [...] } }
  if (resp.matches && Array.isArray(resp.matches)) return resp.matches;

  // { response: { data: [...] } }
  if (resp.data && Array.isArray(resp.data)) return resp.data;

  // { response: [...] } (tableau direct)
  if (Array.isArray(resp)) return resp;

  // { response: { leagues: [{ matches: [...] }] } } (groupé par ligue)
  if (resp.leagues && Array.isArray(resp.leagues)) {
    const allMatches = [];
    for (const league of resp.leagues) {
      const matches = league.matches || league.events || league.fixtures || [];
      for (const match of matches) {
        // Injecter les infos de ligue dans chaque match
        if (!match.league && !match.tournament) {
          match.league = {
            id: league.id || league.leagueId,
            name: league.name || league.leagueName,
            logo: league.logo
          };
        }
        allMatches.push(match);
      }
    }
    return allMatches;
  }

  // Dernier recours: chercher un tableau dans les valeurs
  for (const key of Object.keys(resp)) {
    if (Array.isArray(resp[key]) && resp[key].length > 0) {
      const first = resp[key][0];
      if (first && (first.home || first.homeTeam || first.fixture)) {
        return resp[key];
      }
    }
  }

  return [];
}

/**
 * GET /api/football/fixtures
 * Récupère les matchs en direct
 */
async function getLiveFixtures(req, res) {
  try {
    const now = Date.now();

    // Vérifier le cache
    if (fixturesCache.data && (now - fixturesCache.timestamp) < fixturesCache.expiry) {
      console.log(`Cache hit Football - ${Math.round((fixturesCache.expiry - (now - fixturesCache.timestamp)) / 1000)}s restantes`);
      return res.json(fixturesCache.data);
    }

    const headers = getHeaders();
    if (!headers) {
      console.warn('RAPIDAPI_KEY non configuré pour le football');
      return res.json({ success: true, response: [], message: 'Service Football non configuré' });
    }

    console.log('[LIVE] Récupération matchs en direct via free-api-live-football-data...');

    const response = await fetch(`${API_BASE}/football-current-live`, {
      method: 'GET',
      headers: headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.warn(`API Football HTTP ${response.status}`);
      const emptyResponse = { success: true, response: [], message: `API indisponible (HTTP ${response.status})` };
      fixturesCache = { data: emptyResponse, timestamp: now, expiry: 5 * 60 * 1000 };
      return res.json(emptyResponse);
    }

    const apiData = await response.json();

    // Log la structure brute pour le debug initial
    console.log(`API response status: ${apiData.status}, keys: ${Object.keys(apiData).join(', ')}`);
    if (apiData.response) {
      console.log(`Response keys: ${Object.keys(apiData.response).join(', ')}`);
    }

    // Si l'API retourne un statut "failed" (pas de matchs en direct)
    if (apiData.status === 'failed' || apiData.error) {
      console.log('Pas de matchs en direct actuellement');
      const emptyResponse = { success: true, response: [] };
      fixturesCache = { data: emptyResponse, timestamp: now, expiry: 2 * 60 * 1000 };
      return res.json(emptyResponse);
    }

    // Extraire et transformer les matchs
    const rawMatches = extractMatches(apiData);
    console.log(`Matchs bruts extraits: ${rawMatches.length}`);

    // Log le premier match pour comprendre le format (seulement la première fois)
    if (rawMatches.length > 0) {
      const firstMatch = rawMatches[0];
      console.log(`Premier match - clés: ${Object.keys(firstMatch).join(', ')}`);
      if (firstMatch.home) console.log(`  home clés: ${Object.keys(firstMatch.home).join(', ')}`);
      if (firstMatch.away) console.log(`  away clés: ${Object.keys(firstMatch.away).join(', ')}`);
    }

    const transformedMatches = rawMatches.map((match, i) => transformMatch(match, i));

    const result = { success: true, response: transformedMatches };

    // Mettre en cache
    fixturesCache = { data: result, timestamp: now, expiry: 2 * 60 * 1000 };

    console.log(`${transformedMatches.length} matchs en direct transformés et mis en cache`);
    res.json(result);

  } catch (error) {
    console.error('Erreur API Football:', error.message);

    // Utiliser le cache expiré comme fallback
    if (fixturesCache.data) {
      console.log('Utilisation du cache expiré comme fallback');
      return res.json(fixturesCache.data);
    }

    res.json({ success: true, response: [], message: 'Service temporairement indisponible' });
  }
}

/**
 * GET /api/football/fixtures/date
 * Pas de endpoint "matchs du jour" dans la free API.
 * Retourne une réponse vide - le frontend affichera "aucun match".
 */
async function getFixturesByDate(req, res) {
  // La free API n'a pas d'endpoint pour les matchs par date
  // On réutilise les matchs live s'ils existent dans le cache
  if (fixturesCache.data && fixturesCache.data.response?.length > 0) {
    return res.json(fixturesCache.data);
  }
  res.json({ success: true, response: [], message: 'Matchs du jour non disponibles avec cette API' });
}

/**
 * GET /api/football/h2h
 * Non disponible avec la free API
 */
async function getHeadToHead(req, res) {
  res.json({ success: true, response: [], message: 'H2H non disponible' });
}

/**
 * GET /api/football/standings
 * Non disponible avec la free API
 */
async function getStandings(req, res) {
  res.json({ success: true, response: [], message: 'Classements non disponibles' });
}

/**
 * GET /api/football/team
 * Non disponible avec la free API
 */
async function getTeam(req, res) {
  res.json({ success: true, response: [], message: 'Info équipe non disponible' });
}

/**
 * GET /api/football/teams/search
 * Non disponible avec la free API
 */
async function searchTeams(req, res) {
  res.json({ success: true, response: [], message: 'Recherche non disponible' });
}

module.exports = {
  getLiveFixtures,
  getHeadToHead,
  getFixturesByDate,
  getStandings,
  getTeam,
  searchTeams
};
