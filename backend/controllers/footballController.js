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
  // France
  61,  // Ligue 1
  62,  // Ligue 2

  // Top 5 Européens
  39,  // Premier League (Angleterre)
  40,  // Championship (Angleterre D2)
  140, // La Liga (Espagne)
  141, // La Liga 2 (Espagne D2)
  78,  // Bundesliga (Allemagne)
  79,  // 2. Bundesliga (Allemagne D2)
  135, // Serie A (Italie)
  136, // Serie B (Italie D2)
  88,  // Eredivisie (Pays-Bas)
  94,  // Primeira Liga (Portugal)

  // Autres championnats majeurs
  144, // Jupiler Pro League (Belgique)
  203, // Super Lig (Turquie)
  253, // MLS (USA)
  262, // Liga MX (Mexique)
  71,  // Brasileirão Série A (Brésil)
  128, // Liga Profesional (Argentine)
  307, // Saudi Pro League (Arabie Saoudite)

  // Afrique
  233, // Championnat du Gabon (FEGAFOOT)
  188, // Botola Pro (Maroc)
  200, // Premier League (Égypte)

  // Compétitions internationales
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  848, // UEFA Europa Conference League
  1,   // World Cup
  4,   // Euro Championship
  6,   // Africa Cup of Nations
  9,   // Copa America
  10,  // Friendlies (International)
  17,  // African Cup of Nations Qualifiers
  29,  // World Cup Qualifiers - Africa
  32,  // World Cup Qualifiers - Europe

  // Coupes nationales
  45,  // FA Cup (Angleterre)
  48,  // League Cup (Angleterre)
  66,  // Coupe de France
  81,  // DFB Pokal (Allemagne)
  137, // Coppa Italia
  143  // Copa del Rey (Espagne)
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

    // Clé API RapidAPI uniquement (FOOTBALL_API_KEY est pour l'API directe, pas RapidAPI)
    const apiKey = process.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ Aucune clé API Football trouvée (FOOTBALL_API_KEY, RAPIDAPI_KEY)');
      // Retourner des données vides plutôt qu'une erreur
      return res.json({
        success: true,
        response: [],
        message: 'Service Football non configuré - aucun match disponible'
      });
    }

    // Toujours utiliser RapidAPI (clé fournie est une clé RapidAPI)
    const apiHost = 'api-football-v1.p.rapidapi.com';
    const apiUrl = `https://${apiHost}/v3/fixtures?live=all`;
    const headers = {
      'x-rapidapi-host': apiHost,
      'x-rapidapi-key': apiKey
    };
    // Log clé pour debug (premiers et derniers caractères seulement)
    const keyPreview = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 6)}` : 'UNDEFINED';
    console.log(`🔑 Utilisation RapidAPI (clé: ${keyPreview}, longueur: ${apiKey?.length || 0})`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers,
      timeout: 10000
    });

    if (!response.ok) {
      const statusCode = response.status;
      console.warn(`⚠️ API Football HTTP ${statusCode} - retour données vides`);
      // Retourner données vides au lieu de crasher en 500
      const emptyResponse = { success: true, response: [], message: `API Football indisponible (HTTP ${statusCode})` };
      // Mettre en cache court pour éviter de spammer l'API en erreur
      fixturesCache = { data: emptyResponse, timestamp: now, expiry: 5 * 60 * 1000 };
      return res.json(emptyResponse);
    }

    const data = await response.json();

    // Log pour debug - combien de matchs avant filtre
    const totalBeforeFilter = data.response?.length || 0;
    console.log(`📊 Matchs reçus de l'API: ${totalBeforeFilter}`);

    // Filtrer les matchs (seulement si on en a beaucoup, sinon afficher tout)
    if (data.response && data.response.length > 0) {
      // Si on a plus de 20 matchs, filtrer pour ne garder que les ligues majeures
      // Sinon, afficher tous les matchs disponibles
      if (data.response.length > 20) {
        const beforeFilter = data.response.length;
        data.response = filterMatches(data.response);
        console.log(`🔍 Après filtre: ${data.response.length}/${beforeFilter} matchs`);
      } else {
        console.log(`✅ Affichage de tous les ${data.response.length} matchs (< 20)`);
      }

      // Si le filtre a tout exclu et qu'on avait des matchs, afficher sans filtre
      if (data.response.length === 0 && totalBeforeFilter > 0) {
        console.log(`⚠️ Filtre trop restrictif, récupération des données brutes`);
        // Refaire la requête pour avoir les données non filtrées
        const refetch = await fetch(apiUrl, { method: 'GET', headers: headers });
        const rawData = await refetch.json();
        data.response = rawData.response || [];
      }
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
 * Helper pour construire les headers API (RapidAPI)
 */
function getApiConfig() {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    return null;
  }

  // Toujours utiliser RapidAPI
  return {
    baseUrl: 'https://api-football-v1.p.rapidapi.com/v3',
    headers: {
      'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
      'x-rapidapi-key': apiKey
    }
  };
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
