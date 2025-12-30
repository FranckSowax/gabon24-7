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

module.exports = {
  getLiveFixtures,
  filterMatches,
  ALLOWED_LEAGUE_IDS
};
