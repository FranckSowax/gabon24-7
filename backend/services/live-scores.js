/**
 * Scores de football en direct pour le module de la barre latérale.
 *
 * Source : les tableaux de scores publics d'ESPN (gratuits, sans clé). Ils
 * couvrent les championnats suivis (Angleterre, France, Espagne, Italie,
 * États-Unis, Arabie saoudite) et les matchs internationaux.
 *
 * WHY: cette source n'est pas un service contractuel : elle peut changer ou
 * tomber sans préavis. Le navigateur ne l'appelle donc jamais directement ; le
 * serveur la lit, garde le résultat en mémoire et, si elle ne répond plus,
 * continue de servir le dernier résultat connu (marqué `stale`).
 *
 * Elle n'accepte qu'une date par appel : on lit hier, aujourd'hui et demain.
 * Hier et demain bougent peu et sont gardés plus longtemps.
 *
 * @example
 *   const { getLiveScores } = require('./services/live-scores');
 *   const { matches, liveCount, stale } = await getLiveScores();
 */

const axios = require('axios');

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const REQUEST_TIMEOUT_MS = 8000;
// La source refuse les rafales : peu de lectures à la fois, et un second essai.
const MAX_PARALLEL_REQUESTS = 6;

// Ordre = ordre d'affichage.
const COMPETITIONS = [
  { key: 'fifa.world', name: 'Coupe du monde', international: true },
  { key: 'caf.nations', name: 'CAN', international: true },
  { key: 'caf.nations_qual', name: 'Éliminatoires CAN', international: true },
  { key: 'fifa.worldq.caf', name: 'Éliminatoires Mondial · Afrique', international: true },
  { key: 'fifa.worldq.uefa', name: 'Éliminatoires Mondial · Europe', international: true },
  { key: 'uefa.nations', name: 'Ligue des nations', international: true },
  { key: 'uefa.euro', name: 'Euro', international: true },
  { key: 'fifa.friendly', name: 'Matchs amicaux internationaux', international: true },
  { key: 'eng.1', name: 'Premier League', country: 'Angleterre' },
  { key: 'fra.1', name: 'Ligue 1', country: 'France' },
  { key: 'esp.1', name: 'Liga', country: 'Espagne' },
  { key: 'ita.1', name: 'Serie A', country: 'Italie' },
  { key: 'usa.1', name: 'MLS', country: 'États-Unis' },
  { key: 'ksa.1', name: 'Saudi Pro League', country: 'Arabie saoudite' },
];

// Durées de fraîcheur du cache (millisecondes).
const TODAY_LIVE_TTL_MS = 30 * 1000;
const TODAY_IDLE_TTL_MS = 2 * 60 * 1000;
const OTHER_DAY_TTL_MS = 15 * 60 * 1000;
const STALE_MAX_MS = 6 * 60 * 60 * 1000;

const ABANDONED = /POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED|DELAYED/;

// Sélections nationales : cas que la table générale des pays ne couvre pas
// (nations sans code de pays, appellations propres à la source).
const COUNTRY_FR = {
  Algeria: 'Algérie', Angola: 'Angola', Argentina: 'Argentine', Australia: 'Australie', Austria: 'Autriche',
  Belgium: 'Belgique', Benin: 'Bénin', Brazil: 'Brésil', 'Burkina Faso': 'Burkina Faso', Cameroon: 'Cameroun',
  Canada: 'Canada', 'Cape Verde': 'Cap-Vert', 'Cape Verde Islands': 'Cap-Vert', 'Central African Republic': 'Centrafrique',
  Chad: 'Tchad', Chile: 'Chili', Colombia: 'Colombie', Comoros: 'Comores', Congo: 'Congo', 'Congo DR': 'RD Congo',
  'DR Congo': 'RD Congo', Croatia: 'Croatie', Czechia: 'Tchéquie', Denmark: 'Danemark', Egypt: 'Égypte',
  England: 'Angleterre', 'Equatorial Guinea': 'Guinée équatoriale', Ethiopia: 'Éthiopie', France: 'France',
  Gabon: 'Gabon', Gambia: 'Gambie', Germany: 'Allemagne', Ghana: 'Ghana', Greece: 'Grèce', Guinea: 'Guinée',
  'Guinea-Bissau': 'Guinée-Bissau', Hungary: 'Hongrie', Iran: 'Iran', Ireland: 'Irlande', Italy: 'Italie',
  'Ivory Coast': 'Côte d\'Ivoire', Japan: 'Japon', Kenya: 'Kenya', Madagascar: 'Madagascar', Mali: 'Mali',
  Mauritania: 'Mauritanie', Mexico: 'Mexique', Morocco: 'Maroc', Mozambique: 'Mozambique', Namibia: 'Namibie',
  Netherlands: 'Pays-Bas', Niger: 'Niger', Nigeria: 'Nigeria', Norway: 'Norvège', Poland: 'Pologne',
  Portugal: 'Portugal', Qatar: 'Qatar', Romania: 'Roumanie', Rwanda: 'Rwanda', 'Saudi Arabia': 'Arabie saoudite',
  Scotland: 'Écosse', Senegal: 'Sénégal', Serbia: 'Serbie', 'South Africa': 'Afrique du Sud',
  'South Korea': 'Corée du Sud', Spain: 'Espagne', Sudan: 'Soudan', Sweden: 'Suède', Switzerland: 'Suisse',
  Tanzania: 'Tanzanie', Togo: 'Togo', Tunisia: 'Tunisie', Turkey: 'Turquie', Türkiye: 'Turquie', Uganda: 'Ouganda',
  Ukraine: 'Ukraine', 'United States': 'États-Unis', USA: 'États-Unis', Uruguay: 'Uruguay', Wales: 'Pays de Galles',
  Zambia: 'Zambie', Zimbabwe: 'Zimbabwe',
  'Bosnia-Herzegovina': 'Bosnie-Herzégovine', 'Bosnia-Herz': 'Bosnie-Herzégovine',
  'Bosnia and Herzegovina': 'Bosnie-Herzégovine', 'Northern Ireland': 'Irlande du Nord', 'N Ireland': 'Irlande du Nord',
  'Republic of Ireland': 'Irlande', 'Rep Ireland': 'Irlande', 'Kyrgyz Republic': 'Kirghizistan', 'Kyrgyz Rep.': 'Kirghizistan',
  Kyrgyzstan: 'Kirghizistan', 'Chinese Taipei': 'Taipei chinois', Taipei: 'Taipei chinois',
};

// Table générale anglais → français, construite à partir des noms de pays
// fournis par Node (tous les codes de pays à deux lettres).
function _buildCountryNames() {
  const names = new Map();
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'region' });
    const french = new Intl.DisplayNames(['fr'], { type: 'region' });
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const first of letters) {
      for (const second of letters) {
        const code = first + second;
        const englishName = english.of(code);
        if (englishName && englishName !== code) names.set(englishName.toLowerCase(), french.of(code));
      }
    }
  } catch {
    // Node sans données de langue : seule la liste manuelle s'applique.
  }
  return names;
}
const COUNTRY_NAMES = _buildCountryNames();

function _countryFr(name) {
  return COUNTRY_FR[name] || COUNTRY_NAMES.get(name.toLowerCase()) || null;
}

function _text(value, max = 80) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Seuls les logos servis par ESPN en https sont repris.
function _safeLogo(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /(^|\.)espncdn\.com$/.test(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}

function _score(value) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number >= 0 && number < 100 ? number : null;
}

function _team(competitor, international) {
  const team = (competitor && competitor.team) || {};
  const name = _text(team.shortDisplayName) || _text(team.displayName) || _text(team.name) || 'Équipe';
  const fullName = _text(team.displayName) || name;
  return {
    name: international ? (_countryFr(fullName) || _countryFr(name) || name) : name,
    code: _text(team.abbreviation, 5),
    logo: _safeLogo(team.logo),
  };
}

function _status(event) {
  const status = event.status || {};
  const type = status.type || {};
  const name = _text(type.name);
  if (ABANDONED.test(name)) return null;

  if (type.state === 'in') {
    const clock = _text(status.displayClock, 12);
    return { status: 'live', label: name === 'STATUS_HALFTIME' ? 'Mi-temps' : clock || 'En direct' };
  }
  if (type.state === 'post') {
    if (/PEN/.test(name)) return { status: 'finished', label: 'Tirs au but' };
    if (/EXTRA|AET/.test(name) || /AET/.test(_text(type.shortDetail))) return { status: 'finished', label: 'Après prol.' };
    return { status: 'finished', label: 'Terminé' };
  }
  if (type.state === 'pre') return { status: 'upcoming', label: '' };
  return null;
}

function _scorers(details, teamId) {
  if (!Array.isArray(details)) return [];
  return details
    .filter((detail) => detail && detail.scoringPlay && !detail.shootout && detail.team && String(detail.team.id) === String(teamId))
    .map((detail) => {
      const athlete = (detail.athletesInvolved || [])[0] || {};
      const who = _text(athlete.shortName, 40) || _text(athlete.displayName, 40);
      const minute = _text(detail.clock && detail.clock.displayValue, 10);
      const note = detail.ownGoal ? ' (csc)' : detail.penaltyKick ? ' (pen.)' : '';
      return who ? `${who} ${minute}${note}`.trim() : '';
    })
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Transforme un match tel que renvoyé par la source en match du module.
 * Renvoie null pour un match inexploitable (reporté, annulé, incomplet).
 */
function normalizeEvent(event, competition) {
  if (!event || !event.id) return null;
  const kickoff = new Date(event.date);
  if (Number.isNaN(kickoff.getTime())) return null;

  const state = _status(event);
  if (!state) return null;

  const fixture = (event.competitions || [])[0] || {};
  const competitors = fixture.competitors || [];
  const home = competitors.find((item) => item.homeAway === 'home');
  const away = competitors.find((item) => item.homeAway === 'away');
  if (!home || !away) return null;

  const played = state.status !== 'upcoming';
  const homeTeamId = home.team && home.team.id;
  const awayTeamId = away.team && away.team.id;

  return {
    id: String(event.id),
    competition: { key: competition.key, name: competition.name, international: Boolean(competition.international) },
    kickoff: kickoff.toISOString(),
    status: state.status,
    label: state.label,
    home: _team(home, competition.international),
    away: _team(away, competition.international),
    homeScore: played ? _score(home.score) : null,
    awayScore: played ? _score(away.score) : null,
    homePenalties: played ? _score(home.shootoutScore) : null,
    awayPenalties: played ? _score(away.shootoutScore) : null,
    homeScorers: played ? _scorers(fixture.details, homeTeamId) : [],
    awayScorers: played ? _scorers(fixture.details, awayTeamId) : [],
  };
}

const STATUS_ORDER = { live: 0, upcoming: 1, finished: 2 };

/** Trie : compétitions dans l'ordre prévu, puis en direct, à venir, terminés. */
function sortMatches(matches) {
  const rank = new Map(COMPETITIONS.map((competition, index) => [competition.key, index]));
  return [...matches].sort((a, b) => (
    (rank.get(a.competition.key) - rank.get(b.competition.key))
    || (STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    || a.kickoff.localeCompare(b.kickoff)
  ));
}

function _dayKey(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// Lance les tâches par petits groupes ; même forme de résultat que Promise.allSettled.
async function _runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      try {
        results[index] = { status: 'fulfilled', value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function _defaultGetJson(url) {
  const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS, headers: { Accept: 'application/json' } });
  return response.data;
}

/**
 * Crée un lecteur de scores avec son propre cache (les tests en créent un par cas).
 *
 * @param {{getJson?: (url: string) => Promise<object>, now?: () => number}} [options]
 */
function createLiveScores({ getJson = _defaultGetJson, now = () => Date.now() } = {}) {
  const dayCache = new Map(); // "clé|jour" → { at, matches }
  let lastGood = null;        // { at, payload }
  let inFlight = null;

  async function loadDay(competition, day, ttl) {
    const cacheKey = `${competition.key}|${day}`;
    const cached = dayCache.get(cacheKey);
    if (cached && now() - cached.at < ttl) return { matches: cached.matches, fresh: true };
    try {
      const url = `${BASE_URL}/${competition.key}/scoreboard?dates=${day}`;
      const data = await getJson(url).catch(() => getJson(url));
      const matches = (Array.isArray(data && data.events) ? data.events : [])
        .map((event) => normalizeEvent(event, competition))
        .filter(Boolean);
      dayCache.set(cacheKey, { at: now(), matches });
      return { matches, fresh: true };
    } catch (error) {
      // Une compétition en panne ne doit pas vider le module : on garde ce qu'on
      // avait, tant que ce n'est pas trop vieux, en le signalant comme en retard.
      if (cached && now() - cached.at < STALE_MAX_MS) return { matches: cached.matches, fresh: false };
      throw error;
    }
  }

  async function refresh() {
    const today = new Date(now());
    const offsets = [-1, 0, 1];
    const hadLive = Boolean(lastGood && lastGood.payload.liveCount > 0);
    const todayTtl = hadLive ? TODAY_LIVE_TTL_MS : TODAY_IDLE_TTL_MS;

    const tasks = [];
    for (const competition of COMPETITIONS) {
      for (const offset of offsets) {
        const day = _dayKey(new Date(today.getTime() + offset * 24 * 60 * 60 * 1000));
        tasks.push(() => loadDay(competition, day, offset === 0 ? todayTtl : OTHER_DAY_TTL_MS));
      }
    }
    const results = await _runLimited(tasks, MAX_PARALLEL_REQUESTS);
    const succeeded = results.filter((result) => result.status === 'fulfilled');
    if (succeeded.length === 0) throw new Error('Source des scores injoignable');

    const byId = new Map();
    succeeded.forEach((result) => result.value.matches.forEach((match) => byId.set(match.id, match)));
    const freshCount = succeeded.filter((result) => result.value.fresh).length;
    const matches = sortMatches([...byId.values()]);

    const payload = {
      matches,
      liveCount: matches.filter((match) => match.status === 'live').length,
      updatedAt: new Date(now()).toISOString(),
      partial: freshCount < results.length,
      // Plus aucune lecture ne passe : tout ce qui est affiché vient de la mémoire.
      stale: freshCount === 0,
    };
    lastGood = { at: now(), payload };
    return payload;
  }

  /**
   * Renvoie les matchs d'hier, d'aujourd'hui et de demain. Si la source ne
   * répond pas, renvoie le dernier résultat connu avec `stale: true` ; s'il n'y
   * en a pas (ou s'il a plus de six heures), l'erreur remonte.
   */
  async function getLiveScores() {
    if (lastGood) {
      const ttl = lastGood.payload.liveCount > 0 ? TODAY_LIVE_TTL_MS : TODAY_IDLE_TTL_MS;
      if (now() - lastGood.at < ttl) return lastGood.payload;
    }
    // Plusieurs visiteurs au même instant : une seule lecture de la source.
    if (!inFlight) {
      inFlight = refresh().finally(() => { inFlight = null; });
    }
    try {
      return await inFlight;
    } catch (error) {
      if (lastGood && now() - lastGood.at < STALE_MAX_MS) return { ...lastGood.payload, stale: true };
      throw error;
    }
  }

  return { getLiveScores };
}

const defaultInstance = createLiveScores();

module.exports = {
  getLiveScores: defaultInstance.getLiveScores,
  createLiveScores,
  normalizeEvent,
  sortMatches,
  COMPETITIONS,
};
