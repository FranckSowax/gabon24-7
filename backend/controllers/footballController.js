/**
 * FOOTBALL CONTROLLER
 * Scores de football via free-api-live-football-data (RapidAPI / FotMob)
 *
 * API: https://rapidapi.com/Creativesdev/api/free-api-live-football-data
 * Endpoints testés et fonctionnels:
 *   - /football-current-live              : matchs en direct
 *   - /football-get-matches-by-date       : matchs par date (param: date=YYYYMMDD)
 *   - /football-get-all-leagues           : liste des ligues
 *   - /football-get-all-countries          : liste des pays
 *   - /football-get-league-detail          : détails ligue (param: leagueid)
 *   - /football-get-match-detail           : détails match (param: eventid)
 *   - /football-get-head-to-head           : face à face (param: teamid1, teamid2)
 */

const API_HOST = 'free-api-live-football-data.p.rapidapi.com';
const API_BASE = `https://${API_HOST}`;

// ============================================
// LIGUES AUTORISÉES (IDs FotMob)
// ============================================

const ALLOWED_LEAGUES = new Set([
  // Championnats
  47,    // Premier League (ENG)
  53,    // Ligue 1 (FRA)
  55,    // Serie A (ITA)
  87,    // LaLiga (ESP)
  // Coupes européennes
  42,    // Champions League
  73,    // Europa League
  74,    // UEFA Super Cup
  10216, // Conference League
  10611, // Champions League Qualification
  10613, // Europa League Qualification
  10615, // Conference League Qualification
  // Coupes nationales
  132,   // FA Cup (ENG)
  133,   // EFL Cup / Carabao Cup (ENG)
  134,   // Coupe de France (FRA)
  138,   // Copa del Rey (ESP)
  139,   // Super Cup (ESP)
  141,   // Coppa Italia (ITA)
  150,   // Coupe de la Ligue (FRA)
]);

// ============================================
// CACHES
// ============================================

const cache = {
  live:    { data: null, timestamp: 0, expiry: 2 * 60 * 1000 },   // 2 min
  today:   { data: null, timestamp: 0, expiry: 5 * 60 * 1000 },   // 5 min
  leagues: { data: null, timestamp: 0, expiry: 24 * 60 * 60 * 1000 } // 24h
};

function getCache(key) {
  const c = cache[key];
  if (c && c.data && (Date.now() - c.timestamp) < c.expiry) return c.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { ...cache[key], data, timestamp: Date.now() };
}

// ============================================
// API HELPER
// ============================================

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

  if (data.status === 'failed') {
    console.warn(`[Football API] status=failed pour ${path}:`, data.message);
    return { error: data.message || 'API request failed', status: 200 };
  }

  return { data, status: response.status };
}

// ============================================
// TRANSFORMATION
// ============================================

/**
 * Construit l'URL du logo FotMob pour une ligue
 */
function leagueLogo(leagueId) {
  return leagueId
    ? `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${leagueId}.png`
    : '';
}

/**
 * Transforme un match FotMob en format frontend unifié
 * Format attendu: { fixture, league, teams, goals }
 */
function transformMatch(match, leagueInfo = {}) {
  const homeScore = match.home?.score ?? null;
  const awayScore = match.away?.score ?? null;
  const status = match.status || {};

  let statusShort = 'NS';
  let statusLong = 'Programmé';
  let elapsed = null;

  if (status.finished) {
    statusShort = 'FT';
    statusLong = 'Terminé';
  } else if (status.started && !status.finished) {
    statusShort = 'LIVE';
    statusLong = 'En cours';
    // Calculer les minutes écoulées depuis le début
    if (status.utcTime) {
      const startTime = new Date(status.utcTime).getTime();
      const now = Date.now();
      elapsed = Math.floor((now - startTime) / 60000);
      if (elapsed > 90) elapsed = 90;
      if (elapsed < 0) elapsed = null;
    }
  } else if (status.cancelled) {
    statusShort = 'CANC';
    statusLong = 'Annulé';
  }

  // Détection mi-temps: ~45-50 min sans 2e mi-temps commencée
  if (statusShort === 'LIVE' && status.halfs) {
    if (status.halfs.firstHalfStarted && !status.halfs.secondHalfStarted) {
      if (elapsed && elapsed >= 45) {
        statusShort = 'HT';
        statusLong = 'Mi-temps';
      }
    }
  }

  const lid = match.leagueId || leagueInfo.id || 0;

  return {
    fixture: {
      id: match.id,
      date: status.utcTime || match.time || new Date().toISOString(),
      status: { short: statusShort, long: statusLong, elapsed },
      venue: { name: null }
    },
    league: {
      id: lid,
      name: leagueInfo.name || '',
      logo: leagueLogo(lid),
      round: match.tournamentStage ? `Journée ${match.tournamentStage}` : null
    },
    teams: {
      home: {
        id: match.home?.id || 0,
        name: match.home?.longName || match.home?.name || 'Domicile',
        logo: '',
        winner: homeScore !== null && awayScore !== null ? homeScore > awayScore : null
      },
      away: {
        id: match.away?.id || 0,
        name: match.away?.longName || match.away?.name || 'Extérieur',
        logo: '',
        winner: homeScore !== null && awayScore !== null ? awayScore > homeScore : null
      }
    },
    goals: { home: homeScore, away: awayScore }
  };
}

/**
 * Regroupe des matchs plats par leagueId et enrichit avec les noms de ligues
 */
async function groupAndEnrich(matches) {
  // Filtrer uniquement les ligues autorisées
  const filtered = matches.filter(m => ALLOWED_LEAGUES.has(m.leagueId));
  console.log(`[Football] ${filtered.length}/${matches.length} matchs dans les ligues autorisées`);

  // Grouper par leagueId
  const byLeague = {};
  for (const m of filtered) {
    const lid = m.leagueId || 0;
    if (!byLeague[lid]) byLeague[lid] = [];
    byLeague[lid].push(m);
  }

  // Récupérer les noms de ligues depuis le cache ou l'API
  let leaguesMap = {};
  const cachedLeagues = getCache('leagues');
  if (cachedLeagues) {
    leaguesMap = cachedLeagues;
  } else {
    try {
      const result = await fetchFromApi('/football-get-all-leagues');
      if (result.data?.response?.leagues) {
        for (const l of result.data.response.leagues) {
          leaguesMap[l.id] = l.name;
        }
        setCache('leagues', leaguesMap);
      }
    } catch (e) {
      console.warn('[Football] Impossible de charger les noms de ligues:', e.message);
    }
  }

  // Transformer
  const transformed = [];
  for (const [lid, leagueMatches] of Object.entries(byLeague)) {
    const leagueInfo = { id: Number(lid), name: leaguesMap[Number(lid)] || `Ligue ${lid}` };
    for (const m of leagueMatches) {
      transformed.push(transformMatch(m, leagueInfo));
    }
  }

  return transformed;
}

// ============================================
// HANDLERS
// ============================================

/**
 * GET /api/football/fixtures
 * Matchs en direct (live) — puis fallback matchs du jour si aucun live
 */
async function getLiveFixtures(req, res) {
  try {
    // 1. Vérifier le cache live
    const cached = getCache('live');
    if (cached) {
      const remaining = Math.round((cache.live.expiry - (Date.now() - cache.live.timestamp)) / 1000);
      console.log(`[Football] Cache hit live - ${remaining}s restantes`);
      return res.json(cached);
    }

    // 2. Essayer les matchs en direct
    const result = await fetchFromApi('/football-current-live');

    if (result.error && result.status === 0) {
      return res.json({ success: true, response: [], message: 'RAPIDAPI_KEY non configuré' });
    }

    if (result.data?.response?.live && result.data.response.live.length > 0) {
      const transformed = await groupAndEnrich(result.data.response.live);
      const response = { success: true, response: transformed, live: true };
      setCache('live', response);
      console.log(`[Football] ${transformed.length} matchs en direct`);
      return res.json(response);
    }

    // 3. Pas de live → charger les matchs du jour
    console.log('[Football] Pas de matchs live, chargement matchs du jour...');
    const todayCached = getCache('today');
    if (todayCached) {
      return res.json(todayCached);
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todayResult = await fetchFromApi(`/football-get-matches-by-date?date=${today}`);

    if (todayResult.data?.response?.matches && todayResult.data.response.matches.length > 0) {
      const transformed = await groupAndEnrich(todayResult.data.response.matches);
      const response = { success: true, response: transformed, live: false };
      setCache('today', response);
      console.log(`[Football] ${transformed.length} matchs du jour chargés`);
      return res.json(response);
    }

    // 4. Aucun match
    const empty = { success: true, response: [], live: false };
    setCache('live', empty);
    res.json(empty);

  } catch (error) {
    console.error('[Football] Erreur getLiveFixtures:', error.message);
    // Fallback: retourner le cache expiré s'il existe
    if (cache.live.data) return res.json(cache.live.data);
    if (cache.today.data) return res.json(cache.today.data);
    res.json({ success: true, response: [], message: 'Service temporairement indisponible' });
  }
}

/**
 * GET /api/football/fixtures/date?date=YYYYMMDD
 * Matchs par date
 */
async function getFixturesByDate(req, res) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const result = await fetchFromApi(`/football-get-matches-by-date?date=${date}`);

    if (result.error) {
      return res.json({ success: true, response: [], message: result.error });
    }

    const matches = result.data?.response?.matches || [];
    const transformed = await groupAndEnrich(matches);

    res.json({ success: true, response: transformed });

  } catch (error) {
    console.error('[Football] Erreur getFixturesByDate:', error.message);
    res.json({ success: true, response: [], message: error.message });
  }
}

/**
 * GET /api/football/live-count
 * Nombre de matchs en direct
 */
async function getLiveCount(req, res) {
  try {
    const result = await fetchFromApi('/football-current-live');

    if (result.error) {
      return res.json({ success: true, count: 0, message: result.error });
    }

    const live = result.data?.response?.live || [];
    res.json({ success: true, count: live.length });

  } catch (error) {
    console.error('[Football] Erreur getLiveCount:', error.message);
    res.json({ success: true, count: 0, message: error.message });
  }
}

/**
 * GET /api/football/event/:eventId
 * Détails d'un match
 */
async function getEventDetail(req, res) {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId requis' });
    }

    const result = await fetchFromApi(`/football-get-match-detail?eventid=${eventId}`);

    if (result.error) {
      return res.json({ success: false, data: null, message: result.error });
    }

    res.json({ success: true, data: result.data?.response || result.data });

  } catch (error) {
    console.error('[Football] Erreur getEventDetail:', error.message);
    res.json({ success: false, data: null, message: error.message });
  }
}

/**
 * GET /api/football/leagues
 * Liste de toutes les ligues
 */
async function getLeagues(req, res) {
  try {
    const cached = getCache('leagues');
    if (cached) {
      const leagues = Object.entries(cached).map(([id, name]) => ({ id: Number(id), name }));
      return res.json({ success: true, response: leagues });
    }

    const result = await fetchFromApi('/football-get-all-leagues');

    if (result.error) {
      return res.json({ success: true, response: [], message: result.error });
    }

    const leagues = result.data?.response?.leagues || [];

    // Mettre en cache le mapping id -> name
    const map = {};
    for (const l of leagues) map[l.id] = l.name;
    setCache('leagues', map);

    res.json({ success: true, response: leagues });

  } catch (error) {
    console.error('[Football] Erreur getLeagues:', error.message);
    res.json({ success: true, response: [], message: error.message });
  }
}

/**
 * GET /api/football/league/:leagueId
 * Détails d'une ligue
 */
async function getLeagueDetail(req, res) {
  try {
    const { leagueId } = req.params;
    if (!leagueId) {
      return res.status(400).json({ success: false, error: 'leagueId requis' });
    }

    const result = await fetchFromApi(`/football-get-league-detail?leagueid=${leagueId}`);

    if (result.error) {
      return res.json({ success: false, data: null, message: result.error });
    }

    res.json({ success: true, data: result.data?.response || result.data });

  } catch (error) {
    console.error('[Football] Erreur getLeagueDetail:', error.message);
    res.json({ success: false, data: null, message: error.message });
  }
}

/**
 * GET /api/football/h2h?team1=ID&team2=ID
 * Face à face entre deux équipes
 */
async function getHeadToHead(req, res) {
  try {
    const { team1, team2 } = req.query;
    if (!team1 || !team2) {
      return res.status(400).json({ success: false, error: 'team1 et team2 requis' });
    }

    const result = await fetchFromApi(`/football-get-head-to-head?teamid1=${team1}&teamid2=${team2}`);

    if (result.error) {
      return res.json({ success: true, response: [], message: result.error });
    }

    res.json({ success: true, data: result.data?.response || result.data });

  } catch (error) {
    console.error('[Football] Erreur getHeadToHead:', error.message);
    res.json({ success: true, response: [], message: error.message });
  }
}

module.exports = {
  getLiveFixtures,
  getLiveCount,
  getFixturesByDate,
  getEventDetail,
  getLeagues,
  getLeagueDetail,
  getHeadToHead
};
