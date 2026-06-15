/**
 * ROUTES COUPE DU MONDE 2026
 * Proxy + normalisation des données live de worldcup26.ir
 *   GET https://worldcup26.ir/get/games   — 104 matchs
 *   GET https://worldcup26.ir/get/groups  — 12 groupes (classements)
 *
 * On passe par le backend pour : éviter le CORS, cacher (Redis), normaliser
 * (statut live/terminé/à venir, drapeaux, buteurs, dates ISO).
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const redisCache = require('../services/redis-cache.service');

const UPSTREAM = 'https://worldcup26.ir/get';
// worldcup26.ir répond lentement (10-15s) → on cache longtemps (HARD_TTL) et on
// sert en "stale-while-revalidate" : la réponse est renvoyée immédiatement depuis
// le cache, et rafraîchie en arrière-plan si elle dépasse la fenêtre de fraîcheur.
const HARD_TTL = 3600;          // secondes — durée de vie de la clé Redis (filet)
const GAMES_FRESH_MS = 45000;   // 45s — au-delà, refresh en arrière-plan
const GROUPS_FRESH_MS = 300000; // 5min
const UPSTREAM_TIMEOUT = 30000; // 30s — l'upstream est lent

// Drapeau emoji par nom de pays (anglais, tel que renvoyé par l'API).
const FLAGS = {
  Qatar: '🇶🇦', Ecuador: '🇪🇨', Senegal: '🇸🇳', Netherlands: '🇳🇱', England: '🏴',
  Iran: '🇮🇷', USA: '🇺🇸', 'United States': '🇺🇸', Wales: '🏴', Argentina: '🇦🇷',
  'Saudi Arabia': '🇸🇦', Mexico: '🇲🇽', Poland: '🇵🇱', France: '🇫🇷', Australia: '🇦🇺',
  Denmark: '🇩🇰', Tunisia: '🇹🇳', Spain: '🇪🇸', 'Costa Rica': '🇨🇷', Germany: '🇩🇪',
  Japan: '🇯🇵', Belgium: '🇧🇪', Canada: '🇨🇦', Morocco: '🇲🇦', Croatia: '🇭🇷',
  Brazil: '🇧🇷', Serbia: '🇷🇸', Switzerland: '🇨🇭', Cameroon: '🇨🇲', Portugal: '🇵🇹',
  Ghana: '🇬🇭', Uruguay: '🇺🇾', 'South Korea': '🇰🇷', Korea: '🇰🇷', Turkey: '🇹🇷',
  Türkiye: '🇹🇷', Italy: '🇮🇹', 'South Africa': '🇿🇦', Egypt: '🇪🇬', Algeria: '🇩🇿',
  Nigeria: '🇳🇬', 'Ivory Coast': '🇨🇮', "Cote d'Ivoire": '🇨🇮', Colombia: '🇨🇴',
  Chile: '🇨🇱', Peru: '🇵🇪', Paraguay: '🇵🇾', Bolivia: '🇧🇴', Venezuela: '🇻🇪',
  Austria: '🇦🇹', Norway: '🇳🇴', Sweden: '🇸🇪', Scotland: '🏴', Ireland: '🇮🇪',
  Ukraine: '🇺🇦', Greece: '🇬🇷', 'Czech Republic': '🇨🇿', Czechia: '🇨🇿', Hungary: '🇭🇺',
  Romania: '🇷🇴', Russia: '🇷🇺', 'New Zealand': '🇳🇿', Jordan: '🇯🇴', Uzbekistan: '🇺🇿',
  Iraq: '🇮🇶', UAE: '🇦🇪', Qatar2: '🇶🇦', Panama: '🇵🇦', Jamaica: '🇯🇲', Honduras: '🇭🇳',
  'DR Congo': '🇨🇩', 'Democratic Republic of the Congo': '🇨🇩', Mali: '🇲🇱', 'Burkina Faso': '🇧🇫',
  Gabon: '🇬🇦', 'Cape Verde': '🇨🇻', Angola: '🇦🇴', Zambia: '🇿🇲', Kenya: '🇰🇪', Tanzania: '🇹🇿',
  India: '🇮🇳', China: '🇨🇳', 'Bosnia and Herzegovina': '🇧🇦', Curaçao: '🇨🇼', 'Curacao': '🇨🇼',
  Haiti: '🇭🇹', Suriname: '🇸🇷', Guatemala: '🇬🇹', 'El Salvador': '🇸🇻', 'New Caledonia': '🇳🇨',
};

function flagFor(name) {
  if (!name) return '⚽';
  return FLAGS[name] || FLAGS[name.trim()] || '⚽';
}

// Parse "{\"Nestory Irankunda 27'\",\"C. Metcalfe 75'\"}" → ["Nestory Irankunda 27'", ...]
function parseScorers(raw) {
  if (!raw || raw === 'null' || raw === 'NULL') return [];
  try {
    let s = String(raw).trim();
    if (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1);
    if (!s) return [];
    return s
      .split(/","|,(?=")/)
      .map((x) => x.replace(/^"+|"+$/g, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// "06/13/2026 21:00" → { iso, dayKey }
function parseDate(local) {
  if (!local) return { iso: null, dayKey: null };
  const m = String(local).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return { iso: null, dayKey: null };
  const [, mm, dd, yyyy, hh, mi] = m;
  return { iso: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`, dayKey: `${yyyy}-${mm}-${dd}` };
}

function num(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function statusOf(g) {
  const finished = String(g.finished).toUpperCase() === 'TRUE' || g.time_elapsed === 'finished';
  if (finished) return 'finished';
  if (!g.time_elapsed || g.time_elapsed === 'notstarted') return 'upcoming';
  return 'live';
}

function normalizeGame(g) {
  const { iso, dayKey } = parseDate(g.local_date);
  const status = statusOf(g);
  const showScore = status !== 'upcoming';
  return {
    id: g.id,
    group: g.group || null,
    type: g.type || 'group',
    matchday: g.matchday || null,
    kickoff: iso,
    dayKey,
    status,
    minute: status === 'live' ? g.time_elapsed : null,
    home: { id: g.home_team_id, name: g.home_team_name_en, flag: flagFor(g.home_team_name_en) },
    away: { id: g.away_team_id, name: g.away_team_name_en, flag: flagFor(g.away_team_name_en) },
    homeScore: showScore ? num(g.home_score) : null,
    awayScore: showScore ? num(g.away_score) : null,
    homeScorers: parseScorers(g.home_scorers),
    awayScorers: parseScorers(g.away_scorers),
  };
}

async function fetchUpstream(pathSuffix) {
  const { data } = await axios.get(`${UPSTREAM}/${pathSuffix}`, {
    timeout: UPSTREAM_TIMEOUT,
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (compatible; GabonInsight/1.0; +https://gaboninsight.com)',
    },
  });
  return data;
}

// ---------- Construction des payloads normalisés ----------
async function buildGamesPayload() {
  const raw = await fetchUpstream('games');
  const games = Array.isArray(raw?.games) ? raw.games.map(normalizeGame) : [];
  const liveCount = games.filter((g) => g.status === 'live').length;
  return { success: true, count: games.length, liveCount, games, updatedAt: new Date().toISOString() };
}

async function buildGroupsPayload() {
  // Mapping team_id → nom (depuis games)
  const teamMap = {};
  try {
    const rawGames = await fetchUpstream('games');
    (rawGames?.games || []).forEach((g) => {
      if (g.home_team_id) teamMap[g.home_team_id] = g.home_team_name_en;
      if (g.away_team_id) teamMap[g.away_team_id] = g.away_team_name_en;
    });
  } catch (_) {}

  const raw = await fetchUpstream('groups');
  const groups = (Array.isArray(raw?.groups) ? raw.groups : []).map((grp) => ({
    name: grp.name,
    teams: (grp.teams || [])
      .map((t) => ({
        teamId: t.team_id,
        name: teamMap[t.team_id] || `Équipe ${t.team_id}`,
        flag: flagFor(teamMap[t.team_id]),
        mp: num(t.mp) ?? 0,
        w: num(t.w) ?? 0,
        d: num(t.d) ?? 0,
        l: num(t.l) ?? 0,
        gf: num(t.gf) ?? 0,
        ga: num(t.ga) ?? 0,
        gd: num(t.gd) ?? 0,
        pts: num(t.pts) ?? 0,
      }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf),
  }));
  return { success: true, count: groups.length, groups, updatedAt: new Date().toISOString() };
}

// ---------- Stale-while-revalidate générique ----------
const refreshing = {}; // dédup des refresh concurrents par clé

async function refreshCache(cacheKey, builder) {
  if (refreshing[cacheKey]) return; // un refresh est déjà en cours
  refreshing[cacheKey] = true;
  try {
    const payload = await builder();
    if (redisCache.isAvailable()) await redisCache.set(cacheKey, payload, HARD_TTL);
    return payload;
  } finally {
    refreshing[cacheKey] = false;
  }
}

function ageMs(payload) {
  try {
    return Date.now() - new Date(payload.updatedAt).getTime();
  } catch {
    return Infinity;
  }
}

/**
 * Sert le cache immédiatement (même périmé) et rafraîchit en arrière-plan si vieux.
 * Si aucun cache : effectue le fetch lent (bloquant) une fois pour amorcer.
 */
async function serveSWR(res, cacheKey, builder, freshMs, errMsg) {
  const cached = redisCache.isAvailable() ? await redisCache.get(cacheKey) : null;

  if (cached) {
    if (ageMs(cached) > freshMs) {
      // périmé → refresh en arrière-plan (fire-and-forget), on répond tout de suite
      refreshCache(cacheKey, builder).catch((e) => console.warn('⚠️ worldcup refresh bg:', e.message));
    }
    return res.json({ ...cached, cached: true, stale: ageMs(cached) > freshMs });
  }

  // pas de cache : amorçage bloquant (lent ~10-15s)
  try {
    const payload = await refreshCache(cacheKey, builder);
    return res.json(payload || { success: true });
  } catch (err) {
    console.error('❌ worldcup amorçage:', err.message);
    return res.status(502).json({ success: false, error: errMsg });
  }
}

// GET /api/worldcup/games — tous les matchs normalisés
router.get('/games', (req, res) =>
  serveSWR(res, 'worldcup:games:v1', buildGamesPayload, GAMES_FRESH_MS, 'Source Coupe du Monde indisponible')
);

// GET /api/worldcup/groups — classements des 12 groupes
router.get('/groups', (req, res) =>
  serveSWR(res, 'worldcup:groups:v1', buildGroupsPayload, GROUPS_FRESH_MS, 'Classements Coupe du Monde indisponibles')
);

// Préchauffage au démarrage (non bloquant) pour que le 1er visiteur ait déjà le cache.
setTimeout(() => {
  refreshCache('worldcup:games:v1', buildGamesPayload).catch((e) =>
    console.warn('⚠️ worldcup warm games:', e.message)
  );
  refreshCache('worldcup:groups:v1', buildGroupsPayload).catch((e) =>
    console.warn('⚠️ worldcup warm groups:', e.message)
  );
}, 3000);

module.exports = router;
