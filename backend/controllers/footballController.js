/**
 * 🎮 FOOTBALL CONTROLLER
 * Logique métier pour les scores de football en direct
 * Avec cache pour économiser les quotas API
 */

// Cache pour les matchs en direct (évite les appels API répétés)
let fixturesCache = {
  data: null,
  timestamp: 0,
  expiry: 2 * 60 * 1000 // 2 minutes de cache (les scores changent souvent)
};

// IDs des compétitions majeures à conserver
const ALLOWED_LEAGUE_IDS = [
  61,  // Ligue 1 (France)
  62,  // Ligue 2 (France)
  39,  // Premier League (Angleterre)
  140, // La Liga (Espagne)
  78,  // Bundesliga (Allemagne)
  253, // MLS (USA)
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  848, // UEFA Europa Conference League
  1,   // World Cup
  4,   // Euro Championship
  6,   // Africa Cup of Nations
  10   // Friendlies (International)
];

/**
 * Filtre les matchs pour ne garder que les compétitions majeures
 */
function filterMatches(matches) {
  if (!matches || !Array.isArray(matches)) return [];
  
  return matches.filter(match => {
    const leagueId = match.league?.id;
    const country = match.league?.country;

    // 1. Compétitions majeures par ID
    if (ALLOWED_LEAGUE_IDS.includes(leagueId)) return true;

    // 2. Sélections nationales
    if (country === 'World' || 
        match.teams?.home?.national === true || 
        match.teams?.away?.national === true) {
      return true;
    }

    return false;
  });
}

/**
 * Récupère les matchs en direct via API-Football
 * Avec cache de 2 minutes pour économiser les quotas
 */
async function getLiveFixtures(req, res) {
  try {
    // Vérifier le cache d'abord
    const now = Date.now();
    if (fixturesCache.data && (now - fixturesCache.timestamp) < fixturesCache.expiry) {
      console.log(`📋 Cache hit Football - ${Math.round((fixturesCache.expiry - (now - fixturesCache.timestamp)) / 1000)}s restantes`);
      return res.json(fixturesCache.data);
    }

    console.log(`⚽ [LIVE] Récupération matchs en direct...`);

    // Clé API depuis variables d'environnement (plusieurs options)
    const apiKey = process.env.FOOTBALL_API_KEY || process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_FOOTBALL_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ Aucune clé API Football trouvée (FOOTBALL_API_KEY, RAPIDAPI_KEY)');
      // Retourner des données vides plutôt qu'une erreur
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré - aucun match disponible'
      });
    }

    // Déterminer quelle API utiliser selon le format de la clé
    let apiUrl, headers;
    
    if (apiKey.startsWith('sk_') || apiKey.length === 32) {
      // API-Football.com (clé directe)
      apiUrl = 'https://v3.football.api-sports.io/fixtures?live=all';
      headers = {
        'x-apisports-key': apiKey
      };
      console.log('🔑 Utilisation API-Football.com');
    } else {
      // RapidAPI
      const apiHost = 'api-football-v1.p.rapidapi.com';
      apiUrl = `https://${apiHost}/v3/fixtures?live=all`;
      headers = {
        'x-rapidapi-host': apiHost,
        'x-rapidapi-key': apiKey
      };
      console.log('🔑 Utilisation RapidAPI');
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers,
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`API Football error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filtrer les matchs
    if (data.response) {
      data.response = filterMatches(data.response);
    }
    
    // Mettre en cache
    fixturesCache = {
      data: data,
      timestamp: now,
      expiry: 2 * 60 * 1000
    };
    
    console.log(`✅ ${data.response?.length || 0} matchs en direct récupérés et mis en cache`);

    res.json(data);

  } catch (error) {
    console.error('❌ Erreur API Football:', error.message);
    
    // Si le cache existe (même expiré), l'utiliser en fallback
    if (fixturesCache.data) {
      console.log('⚠️ Utilisation du cache expiré comme fallback');
      return res.json(fixturesCache.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des scores',
      message: error.message
    });
  }
}

/**
 * Cache pour les confrontations directes (h2h)
 */
let h2hCache = {};
const H2H_CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Cache pour les fixtures par date
 */
let fixturesByDateCache = {};
const FIXTURES_DATE_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Cache pour les classements
 */
let standingsCache = {};
const STANDINGS_CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes

/**
 * Helper pour construire les headers API
 */
function getApiConfig() {
  const apiKey = process.env.FOOTBALL_API_KEY || process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_FOOTBALL_KEY;

  if (!apiKey) {
    return null;
  }

  if (apiKey.startsWith('sk_') || apiKey.length === 32) {
    // API-Football.com (clé directe)
    return {
      baseUrl: 'https://v3.football.api-sports.io',
      headers: { 'x-apisports-key': apiKey }
    };
  } else {
    // RapidAPI
    return {
      baseUrl: 'https://api-football-v1.p.rapidapi.com/v3',
      headers: {
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    };
  }
}

/**
 * Récupère les confrontations directes entre deux équipes (Head-to-Head)
 * GET /api/football/h2h?team1=33&team2=34
 */
async function getHeadToHead(req, res) {
  try {
    const { team1, team2, last = 10 } = req.query;

    if (!team1 || !team2) {
      return res.status(400).json({
        success: false,
        error: 'team1 et team2 sont requis'
      });
    }

    const cacheKey = `${team1}-${team2}`;
    const now = Date.now();

    // Vérifier le cache
    if (h2hCache[cacheKey] && (now - h2hCache[cacheKey].timestamp) < H2H_CACHE_EXPIRY) {
      console.log(`📋 Cache hit H2H: ${cacheKey}`);
      return res.json(h2hCache[cacheKey].data);
    }

    console.log(`⚽ [H2H] Récupération confrontations ${team1} vs ${team2}...`);

    const config = getApiConfig();
    if (!config) {
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré'
      });
    }

    const response = await fetch(`${config.baseUrl}/fixtures/headtohead?h2h=${team1}-${team2}&last=${last}`, {
      method: 'GET',
      headers: config.headers
    });

    if (!response.ok) {
      throw new Error(`API Football error: ${response.status}`);
    }

    const data = await response.json();

    // Mettre en cache
    h2hCache[cacheKey] = {
      data: data,
      timestamp: now
    };

    console.log(`✅ ${data.response?.length || 0} confrontations récupérées`);
    res.json(data);

  } catch (error) {
    console.error('❌ Erreur H2H:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des confrontations',
      message: error.message
    });
  }
}

/**
 * Récupère les fixtures par date
 * GET /api/football/fixtures/date?date=2025-01-01
 */
async function getFixturesByDate(req, res) {
  try {
    const { date, league, season } = req.query;

    // Date par défaut: aujourd'hui
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `${targetDate}-${league || 'all'}-${season || 'current'}`;
    const now = Date.now();

    // Vérifier le cache
    if (fixturesByDateCache[cacheKey] && (now - fixturesByDateCache[cacheKey].timestamp) < FIXTURES_DATE_CACHE_EXPIRY) {
      console.log(`📋 Cache hit fixtures date: ${cacheKey}`);
      return res.json(fixturesByDateCache[cacheKey].data);
    }

    console.log(`⚽ [Fixtures] Récupération matchs du ${targetDate}...`);

    const config = getApiConfig();
    if (!config) {
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré'
      });
    }

    // Construire l'URL avec les paramètres optionnels
    let url = `${config.baseUrl}/fixtures?date=${targetDate}`;
    if (league) url += `&league=${league}`;
    if (season) url += `&season=${season}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: config.headers
    });

    if (!response.ok) {
      throw new Error(`API Football error: ${response.status}`);
    }

    const data = await response.json();

    // Filtrer les matchs pour ne garder que les compétitions majeures
    if (data.response && !league) {
      data.response = filterMatches(data.response);
    }

    // Mettre en cache
    fixturesByDateCache[cacheKey] = {
      data: data,
      timestamp: now
    };

    console.log(`✅ ${data.response?.length || 0} matchs récupérés pour ${targetDate}`);
    res.json(data);

  } catch (error) {
    console.error('❌ Erreur fixtures par date:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des matchs',
      message: error.message
    });
  }
}

/**
 * Récupère le classement d'une ligue
 * GET /api/football/standings?league=61&season=2024
 */
async function getStandings(req, res) {
  try {
    const { league, season } = req.query;

    if (!league) {
      return res.status(400).json({
        success: false,
        error: 'league est requis'
      });
    }

    // Saison par défaut: année actuelle ou année précédente selon le mois
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const defaultSeason = currentMonth < 7 ? currentYear - 1 : currentYear; // Avant août = saison précédente
    const targetSeason = season || defaultSeason;

    const cacheKey = `${league}-${targetSeason}`;
    const now = Date.now();

    // Vérifier le cache
    if (standingsCache[cacheKey] && (now - standingsCache[cacheKey].timestamp) < STANDINGS_CACHE_EXPIRY) {
      console.log(`📋 Cache hit standings: ${cacheKey}`);
      return res.json(standingsCache[cacheKey].data);
    }

    console.log(`⚽ [Standings] Récupération classement ligue ${league} saison ${targetSeason}...`);

    const config = getApiConfig();
    if (!config) {
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré'
      });
    }

    const response = await fetch(`${config.baseUrl}/standings?league=${league}&season=${targetSeason}`, {
      method: 'GET',
      headers: config.headers
    });

    if (!response.ok) {
      throw new Error(`API Football error: ${response.status}`);
    }

    const data = await response.json();

    // Mettre en cache
    standingsCache[cacheKey] = {
      data: data,
      timestamp: now
    };

    console.log(`✅ Classement récupéré pour ligue ${league}`);
    res.json(data);

  } catch (error) {
    console.error('❌ Erreur standings:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du classement',
      message: error.message
    });
  }
}

/**
 * Récupère les informations d'une équipe
 * GET /api/football/team?id=33
 */
async function getTeam(req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'id est requis'
      });
    }

    console.log(`⚽ [Team] Récupération équipe ${id}...`);

    const config = getApiConfig();
    if (!config) {
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré'
      });
    }

    const response = await fetch(`${config.baseUrl}/teams?id=${id}`, {
      method: 'GET',
      headers: config.headers
    });

    if (!response.ok) {
      throw new Error(`API Football error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Équipe ${id} récupérée`);
    res.json(data);

  } catch (error) {
    console.error('❌ Erreur team:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'équipe',
      message: error.message
    });
  }
}

/**
 * Recherche d'équipes par nom
 * GET /api/football/teams/search?name=paris
 */
async function searchTeams(req, res) {
  try {
    const { name } = req.query;

    if (!name || name.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'name doit contenir au moins 3 caractères'
      });
    }

    console.log(`⚽ [Search] Recherche équipes "${name}"...`);

    const config = getApiConfig();
    if (!config) {
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré'
      });
    }

    const response = await fetch(`${config.baseUrl}/teams?search=${encodeURIComponent(name)}`, {
      method: 'GET',
      headers: config.headers
    });

    if (!response.ok) {
      throw new Error(`API Football error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ ${data.response?.length || 0} équipes trouvées pour "${name}"`);
    res.json(data);

  } catch (error) {
    console.error('❌ Erreur search teams:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche',
      message: error.message
    });
  }
}

module.exports = {
  getLiveFixtures,
  getHeadToHead,
  getFixturesByDate,
  getStandings,
  getTeam,
  searchTeams,
  filterMatches,
  ALLOWED_LEAGUE_IDS
};
