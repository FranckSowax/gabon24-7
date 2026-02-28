/**
 * FOOTBALL CONTROLLER
 * Scores de football en direct via free-football-api-data (RapidAPI)
 *
 * API: https://rapidapi.com/Developer12/api/free-football-api-data
 * Endpoints:
 *   - /football-current-live          : matchs en direct
 *   - /football-event-status          : nombre de matchs live / statut événement
 *   - /football-categories-live-unique-tournaments : matchs live par pays
 *   - /football-get-league-live-match : matchs live par ligue
 *   - /football-event-detail          : détails d'un événement
 *
 * Le backend transforme la réponse en format compatible
 * avec le frontend (format API-Football v3) pour éviter de modifier le widget.
 */

const API_HOST = 'free-football-api-data.p.rapidapi.com';
const API_BASE = `https://${API_HOST}`;

// Cache pour les matchs en direct (2 minutes)
let fixturesCache = {
  data: null,
  timestamp: 0,
  expiry: 2 * 60 * 1000
};

/**
 * Helper: Fetch depuis la nouvelle API avec headers + timeout + gestion d'erreurs
 */
async function fetchFromApi(path) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return { error: 'RAPIDAPI_KEY non configuré', status: 0 };
  }

  const url = `${API_BASE}${path}`;
  console.log(`[Football API] GET ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': API_HOST,
      'x-rapidapi-key': apiKey
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    console.warn(`[Football API] HTTP ${response.status} pour ${path}`);
    return { error: `HTTP ${response.status}`, status: response.status };
  }

  const data = await response.json();
  return { data, status: response.status };
}

/**
 * Transforme un match de l'API (FotMob-style) en format API-Football v3
 * Le frontend attend: { fixture, league, teams, goals }
 */
function transformMatch(match, index) {
  // Format A: Objet avec home/away comme sous-objets (FotMob-style)
  if (match.home && match.away) {
    const homeScore = match.home.score ?? match.homeScore ?? match.scores?.home ?? null;
    const awayScore = match.away.score ?? match.awayScore ?? match.scores?.away ?? null;

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

    elapsed = match.time?.minutes || match.minute || match.elapsed || match.min || null;
    if (typeof elapsed === 'string') elapsed = parseInt(elapsed, 10) || null;

    if (match.statusText) {
      statusLong = match.statusText;
      if (match.statusText.includes('HT') || match.statusText === 'Half Time') {
        statusShort = 'HT';
        statusLong = 'Mi-temps';
      }
    }

    const league = match.league || match.tournament || match.competition || {};
    const leagueId = league.id || league.leagueId || 0;
    const leagueName = league.name || league.leagueName || 'Compétition';
    const leagueLogo = league.logo || (leagueId ? `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${leagueId}.png` : '');

    return {
      fixture: {
        id: match.id || match.matchId || index,
        date: match.date || match.utcTime || match.startTime || new Date().toISOString(),
        status: { short: statusShort, long: statusLong, elapsed },
        venue: { name: match.venue?.name || match.stadium || null }
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
      goals: { home: homeScore, away: awayScore }
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

  // Format inconnu
  console.warn('⚠️ Format match inconnu, clés:', Object.keys(match));
  return {
    fixture: {
      id: match.id || index,
      date: new Date().toISOString(),
      status: { short: 'LIVE', long: 'En cours', elapsed: null },
      venue: { name: null }
    },
    league: { id: 0, name: 'Match en direct', logo: '', round: null },
    teams: {
      home: { id: 0, name: 'Équipe A', logo: '', winner: null },
      away: { id: 0, name: 'Équipe B', logo: '', winner: null }
    },
    goals: { home: null, away: null }
  };
}

/**
 * Extrait la liste des matchs depuis la réponse de l'API
 */
function extractMatches(apiResponse) {
  if (!apiResponse) return [];

  const resp = apiResponse.response || apiResponse;

  if (resp.live && Array.isArray(resp.live)) return resp.live;
  if (resp.matches && Array.isArray(resp.matches)) return resp.matches;
  if (resp.data && Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp)) return resp;

  // Groupé par ligue
  if (resp.leagues && Array.isArray(resp.leagues)) {
    const allMatches = [];
    for (const league of resp.leagues) {
      const matches = league.matches || league.events || league.fixtures || [];
      for (const match of matches) {
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

// ============================================
// HANDLERS
// ============================================

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

    const result = await fetchFromApi('/football-current-live');

    if (result.error && result.status === 0) {
      return res.json({ success: true, response: [], message: 'Service Football non configuré' });
    }

    if (result.error) {
      const emptyResponse = { success: true, response: [], message: `API indisponible (${result.error})` };
      fixturesCache = { data: emptyResponse, timestamp: now, expiry: 5 * 60 * 1000 };
      return res.json(emptyResponse);
    }

    const apiData = result.data;
    console.log(`API response keys: ${Object.keys(apiData).join(', ')}`);

    if (apiData.status === 'failed' || apiData.error) {
      console.log('Pas de matchs en direct actuellement');
      const emptyResponse = { success: true, response: [] };
      fixturesCache = { data: emptyResponse, timestamp: now, expiry: 2 * 60 * 1000 };
      return res.json(emptyResponse);
    }

    const rawMatches = extractMatches(apiData);
    console.log(`Matchs bruts extraits: ${rawMatches.length}`);

    const transformedMatches = rawMatches.map((match, i) => transformMatch(match, i));
    const response = { success: true, response: transformedMatches };

    fixturesCache = { data: response, timestamp: now, expiry: 2 * 60 * 1000 };
    console.log(`${transformedMatches.length} matchs en direct transformés et mis en cache`);
    res.json(response);

  } catch (error) {
    console.error('Erreur API Football:', error.message);
    if (fixturesCache.data) {
      console.log('Utilisation du cache expiré comme fallback');
      return res.json(fixturesCache.data);
    }
    res.json({ success: true, response: [], message: 'Service temporairement indisponible' });
  }
}

/**
 * GET /api/football/live-count
 * Nombre de matchs en direct (via football-event-status sans eventid)
 */
async function getLiveCount(req, res) {
  try {
    const result = await fetchFromApi('/football-event-status');

    if (result.error) {
      return res.json({ success: false, count: 0, message: result.error });
    }

    const data = result.data;
    // L'API retourne les infos générales sur les événements live
    const count = data.liveCount || data.count || (data.response ? Object.keys(data.response).length : 0);

    res.json({ success: true, count, data: data.response || data });

  } catch (error) {
    console.error('Erreur getLiveCount:', error.message);
    res.json({ success: false, count: 0, message: error.message });
  }
}

/**
 * GET /api/football/live/country/:countryId
 * Matchs en direct par pays (tournois uniques)
 */
async function getLiveByCountry(req, res) {
  try {
    const { countryId } = req.params;
    if (!countryId) {
      return res.status(400).json({ success: false, error: 'countryId requis' });
    }

    const result = await fetchFromApi(`/football-categories-live-unique-tournaments?countryid=${countryId}`);

    if (result.error) {
      return res.json({ success: false, response: [], message: result.error });
    }

    const apiData = result.data;
    const rawMatches = extractMatches(apiData);
    const transformedMatches = rawMatches.map((match, i) => transformMatch(match, i));

    res.json({ success: true, response: transformedMatches });

  } catch (error) {
    console.error('Erreur getLiveByCountry:', error.message);
    res.json({ success: true, response: [], message: error.message });
  }
}

/**
 * GET /api/football/live/league/:leagueId
 * Matchs en direct par ligue
 */
async function getLiveByLeague(req, res) {
  try {
    const { leagueId } = req.params;
    if (!leagueId) {
      return res.status(400).json({ success: false, error: 'leagueId requis' });
    }

    const result = await fetchFromApi(`/football-get-league-live-match?countryid=${leagueId}`);

    if (result.error) {
      return res.json({ success: false, response: [], message: result.error });
    }

    const apiData = result.data;
    const rawMatches = extractMatches(apiData);
    const transformedMatches = rawMatches.map((match, i) => transformMatch(match, i));

    res.json({ success: true, response: transformedMatches });

  } catch (error) {
    console.error('Erreur getLiveByLeague:', error.message);
    res.json({ success: true, response: [], message: error.message });
  }
}

/**
 * GET /api/football/event/:eventId
 * Détails complets d'un événement/match
 */
async function getEventDetail(req, res) {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId requis' });
    }

    const result = await fetchFromApi(`/football-event-detail?eventid=${eventId}`);

    if (result.error) {
      return res.json({ success: false, data: null, message: result.error });
    }

    res.json({ success: true, data: result.data?.response || result.data });

  } catch (error) {
    console.error('Erreur getEventDetail:', error.message);
    res.json({ success: false, data: null, message: error.message });
  }
}

/**
 * GET /api/football/event/:eventId/status
 * Statut d'un événement spécifique
 */
async function getEventStatus(req, res) {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId requis' });
    }

    const result = await fetchFromApi(`/football-event-status?eventid=${eventId}`);

    if (result.error) {
      return res.json({ success: false, data: null, message: result.error });
    }

    res.json({ success: true, data: result.data?.response || result.data });

  } catch (error) {
    console.error('Erreur getEventStatus:', error.message);
    res.json({ success: false, data: null, message: error.message });
  }
}

/**
 * Stubs pour les anciens endpoints (non disponibles avec cette API)
 */
async function getFixturesByDate(req, res) {
  if (fixturesCache.data && fixturesCache.data.response?.length > 0) {
    return res.json(fixturesCache.data);
  }
  res.json({ success: true, response: [], message: 'Matchs du jour non disponibles avec cette API' });
}

async function getHeadToHead(req, res) {
  res.json({ success: true, response: [], message: 'H2H non disponible' });
}

async function getStandings(req, res) {
  res.json({ success: true, response: [], message: 'Classements non disponibles' });
}

async function getTeam(req, res) {
  res.json({ success: true, response: [], message: 'Info équipe non disponible' });
}

async function searchTeams(req, res) {
  res.json({ success: true, response: [], message: 'Recherche non disponible' });
}

module.exports = {
  getLiveFixtures,
  getLiveCount,
  getLiveByCountry,
  getLiveByLeague,
  getEventDetail,
  getEventStatus,
  getHeadToHead,
  getFixturesByDate,
  getStandings,
  getTeam,
  searchTeams
};
