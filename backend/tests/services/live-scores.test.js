/**
 * Scores de football en direct : mise en forme des matchs, cache et
 * comportement quand la source ne répond plus. La source est simulée.
 */

const express = require('express');
const request = require('supertest');
const { createLiveScores, normalizeEvent, sortMatches, COMPETITIONS } = require('../../services/live-scores');

const PREMIER_LEAGUE = COMPETITIONS.find((competition) => competition.key === 'eng.1');
const FRIENDLY = COMPETITIONS.find((competition) => competition.key === 'fifa.friendly');

function makeEvent(overrides = {}) {
  const { state = 'in', name = 'STATUS_SECOND_HALF', clock = "67'", shortDetail = '', id = '1', date = '2026-11-15T15:00Z',
    home = { id: '10', displayName: 'Arsenal FC', shortDisplayName: 'Arsenal', abbreviation: 'ARS', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' },
    away = { id: '20', displayName: 'Chelsea FC', shortDisplayName: 'Chelsea', abbreviation: 'CHE', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png' },
    homeScore = '2', awayScore = '1', details = [], homeShootout, awayShootout } = overrides;
  return {
    id,
    date,
    status: { displayClock: clock, type: { state, name, shortDetail } },
    competitions: [{
      competitors: [
        { homeAway: 'away', score: awayScore, shootoutScore: awayShootout, team: away },
        { homeAway: 'home', score: homeScore, shootoutScore: homeShootout, team: home },
      ],
      details,
    }],
  };
}

describe('mise en forme d\'un match', () => {
  it('reprend équipes, score et minute d\'un match en cours', () => {
    const match = normalizeEvent(makeEvent(), PREMIER_LEAGUE);
    expect(match).toMatchObject({
      id: '1',
      status: 'live',
      label: "67'",
      kickoff: '2026-11-15T15:00:00.000Z',
      homeScore: 2,
      awayScore: 1,
      competition: { key: 'eng.1', name: 'Premier League', international: false },
    });
    expect(match.home).toEqual({ name: 'Arsenal', code: 'ARS', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' });
    expect(match.away.name).toBe('Chelsea');
  });

  it('affiche « Mi-temps » à la pause', () => {
    expect(normalizeEvent(makeEvent({ name: 'STATUS_HALFTIME', clock: "45'" }), PREMIER_LEAGUE).label).toBe('Mi-temps');
  });

  it('n\'affiche aucun score avant le coup d\'envoi', () => {
    const match = normalizeEvent(makeEvent({ state: 'pre', name: 'STATUS_SCHEDULED', homeScore: '0', awayScore: '0' }), PREMIER_LEAGUE);
    expect(match.status).toBe('upcoming');
    expect(match.homeScore).toBeNull();
    expect(match.awayScore).toBeNull();
  });

  it('distingue fin normale, prolongation et tirs au but', () => {
    const finished = (extra) => normalizeEvent(makeEvent({ state: 'post', ...extra }), PREMIER_LEAGUE);
    expect(finished({ name: 'STATUS_FULL_TIME' }).label).toBe('Terminé');
    expect(finished({ name: 'STATUS_FINAL_AET', shortDetail: 'AET' }).label).toBe('Après prol.');
    const pens = finished({ name: 'STATUS_FINAL_PEN', homeScore: '1', awayScore: '1', homeShootout: '4', awayShootout: '3' });
    expect(pens.label).toBe('Tirs au but');
    expect([pens.homePenalties, pens.awayPenalties]).toEqual([4, 3]);
  });

  it('écarte les matchs reportés, annulés ou abandonnés', () => {
    ['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED'].forEach((name) => {
      expect(normalizeEvent(makeEvent({ state: 'post', name }), PREMIER_LEAGUE)).toBeNull();
    });
  });

  it('écarte un match incomplet ou sans date valide', () => {
    expect(normalizeEvent(null, PREMIER_LEAGUE)).toBeNull();
    expect(normalizeEvent(makeEvent({ date: 'pas une date' }), PREMIER_LEAGUE)).toBeNull();
    const noAway = makeEvent();
    noAway.competitions[0].competitors = noAway.competitions[0].competitors.filter((item) => item.homeAway === 'home');
    expect(normalizeEvent(noAway, PREMIER_LEAGUE)).toBeNull();
  });

  it('attribue les buteurs à la bonne équipe, sans les tirs au but', () => {
    const details = [
      { scoringPlay: true, team: { id: '10' }, clock: { displayValue: "12'" }, athletesInvolved: [{ shortName: 'B. Saka' }] },
      { scoringPlay: true, penaltyKick: true, team: { id: '20' }, clock: { displayValue: "40'" }, athletesInvolved: [{ shortName: 'C. Palmer' }] },
      { scoringPlay: true, ownGoal: true, team: { id: '10' }, clock: { displayValue: "70'" }, athletesInvolved: [{ shortName: 'L. Colwill' }] },
      { scoringPlay: false, yellowCard: true, team: { id: '10' }, clock: { displayValue: "5'" }, athletesInvolved: [{ shortName: 'D. Rice' }] },
      { scoringPlay: true, shootout: true, team: { id: '10' }, clock: { displayValue: "120'" }, athletesInvolved: [{ shortName: 'M. Ødegaard' }] },
    ];
    const match = normalizeEvent(makeEvent({ details }), PREMIER_LEAGUE);
    expect(match.homeScorers).toEqual(["B. Saka 12'", "L. Colwill 70' (csc)"]);
    expect(match.awayScorers).toEqual(["C. Palmer 40' (pen.)"]);
  });

  it('traduit les sélections nationales, pas les clubs', () => {
    const teams = {
      home: { id: '1', displayName: 'Germany', shortDisplayName: 'Germany', abbreviation: 'GER' },
      away: { id: '2', displayName: 'Ivory Coast', shortDisplayName: 'Ivory Coast', abbreviation: 'CIV' },
    };
    const international = normalizeEvent(makeEvent(teams), FRIENDLY);
    expect([international.home.name, international.away.name]).toEqual(['Allemagne', 'Côte d\'Ivoire']);
    expect(normalizeEvent(makeEvent(teams), PREMIER_LEAGUE).home.name).toBe('Germany');
  });

  it('traduit aussi les pays absents de la liste manuelle, et laisse un nom inconnu tel quel', () => {
    const nameOf = (displayName) => normalizeEvent(makeEvent({ home: { id: '1', displayName } }), FRIENDLY).home.name;
    expect(nameOf('Cyprus')).toBe('Chypre');
    expect(nameOf('Latvia')).toBe('Lettonie');
    expect(nameOf('Scotland')).toBe('Écosse');
    expect(nameOf('Congo DR')).toBe('RD Congo');
    expect(nameOf('Sélection inconnue')).toBe('Sélection inconnue');
  });

  it('refuse un logo qui ne vient pas de la source en https', () => {
    const logoOf = (logo) => normalizeEvent(makeEvent({ home: { id: '10', displayName: 'Arsenal', logo } }), PREMIER_LEAGUE).home.logo;
    expect(logoOf('http://a.espncdn.com/logo.png')).toBeNull();
    expect(logoOf('https://evil.example/logo.png')).toBeNull();
    expect(logoOf('https://espncdn.com.evil.example/logo.png')).toBeNull();
    expect(logoOf('javascript:alert(1)')).toBeNull();
    expect(logoOf(undefined)).toBeNull();
  });

  it('ignore un score aberrant', () => {
    const match = normalizeEvent(makeEvent({ homeScore: 'abc', awayScore: '-3' }), PREMIER_LEAGUE);
    expect([match.homeScore, match.awayScore]).toEqual([null, null]);
  });
});

describe('ordre d\'affichage', () => {
  it('place les matchs internationaux avant les championnats, et le direct en premier', () => {
    const match = (id, competition, status, kickoff) => ({ id, competition: { key: competition }, status, kickoff });
    const sorted = sortMatches([
      match('a', 'ksa.1', 'live', '2026-11-15T18:00:00.000Z'),
      match('b', 'eng.1', 'finished', '2026-11-15T12:00:00.000Z'),
      match('c', 'eng.1', 'live', '2026-11-15T15:00:00.000Z'),
      match('d', 'fifa.friendly', 'upcoming', '2026-11-15T20:00:00.000Z'),
      match('e', 'eng.1', 'upcoming', '2026-11-15T17:00:00.000Z'),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['d', 'c', 'e', 'b', 'a']);
  });
});

describe('lecture de la source et cache', () => {
  const START = Date.parse('2026-11-15T12:00:00Z');

  function setup({ events = () => [], fail = () => false } = {}) {
    const clock = { value: START };
    const calls = [];
    const getJson = jest.fn(async (url) => {
      calls.push(url);
      const [, key, day] = /soccer\/([^/]+)\/scoreboard\?dates=(\d{8})$/.exec(url);
      if (fail(key, day)) throw new Error('boom');
      return { events: events(key, day) };
    });
    const service = createLiveScores({ getJson, now: () => clock.value });
    return { service, clock, calls, getJson };
  }

  it('interroge chaque compétition pour hier, aujourd\'hui et demain', async () => {
    const { service, calls } = setup();
    const payload = await service.getLiveScores();
    expect(calls).toHaveLength(COMPETITIONS.length * 3);
    expect(calls).toContain('https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard?dates=20261114');
    expect(calls).toContain('https://site.api.espn.com/apis/site/v2/sports/soccer/ksa.1/scoreboard?dates=20261116');
    expect(payload).toMatchObject({ matches: [], liveCount: 0, partial: false, stale: false });
  });

  it('couvre les six championnats demandés et des compétitions internationales', () => {
    const keys = COMPETITIONS.map((competition) => competition.key);
    expect(keys).toEqual(expect.arrayContaining(['eng.1', 'fra.1', 'esp.1', 'ita.1', 'usa.1', 'ksa.1']));
    expect(COMPETITIONS.filter((competition) => competition.international).length).toBeGreaterThanOrEqual(5);
  });

  it('ne lit jamais plus de six adresses à la fois', async () => {
    let running = 0;
    let peak = 0;
    const getJson = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setImmediate(resolve));
      running -= 1;
      return { events: [] };
    };
    await createLiveScores({ getJson, now: () => START }).getLiveScores();
    expect(peak).toBeLessThanOrEqual(6);
    expect(peak).toBeGreaterThan(1);
  });

  it('compte les matchs en direct et ne garde qu\'un exemplaire d\'un match vu deux jours de suite', async () => {
    const { service } = setup({ events: (key) => (key === 'eng.1' ? [makeEvent({ id: '77' })] : []) });
    const payload = await service.getLiveScores();
    expect(payload.matches).toHaveLength(1);
    expect(payload.liveCount).toBe(1);
  });

  it('sert le cache sans relire la source, puis relit une fois le délai passé', async () => {
    const { service, clock, getJson } = setup();
    await service.getLiveScores();
    const first = getJson.mock.calls.length;

    clock.value += 60 * 1000;
    await service.getLiveScores();
    expect(getJson.mock.calls.length).toBe(first);

    clock.value += 2 * 60 * 1000;
    await service.getLiveScores();
    // Seul « aujourd'hui » est relu : hier et demain restent en cache plus longtemps.
    expect(getJson.mock.calls.length).toBe(first + COMPETITIONS.length);
  });

  it('rafraîchit toutes les 30 secondes pendant un match', async () => {
    const { service, clock, getJson } = setup({ events: (key, day) => (key === 'eng.1' && day === '20261115' ? [makeEvent()] : []) });
    await service.getLiveScores();
    const first = getJson.mock.calls.length;
    clock.value += 20 * 1000;
    await service.getLiveScores();
    expect(getJson.mock.calls.length).toBe(first);
    clock.value += 15 * 1000;
    await service.getLiveScores();
    expect(getJson.mock.calls.length).toBe(first + COMPETITIONS.length);
  });

  it('ne lance qu\'une lecture quand plusieurs visiteurs arrivent ensemble', async () => {
    const { service, getJson } = setup();
    await Promise.all([service.getLiveScores(), service.getLiveScores(), service.getLiveScores()]);
    expect(getJson.mock.calls.length).toBe(COMPETITIONS.length * 3);
  });

  it('réessaie une fois une lecture qui échoue', async () => {
    const failedOnce = new Set();
    const { service } = setup({
      events: (key, day) => (key === 'fra.1' && day === '20261115' ? [makeEvent({ id: '5' })] : []),
      fail: (key, day) => {
        const id = `${key}|${day}`;
        if (key !== 'fra.1' || failedOnce.has(id)) return false;
        failedOnce.add(id);
        return true;
      },
    });
    const payload = await service.getLiveScores();
    expect(payload.partial).toBe(false);
    expect(payload.matches.map((match) => match.id)).toEqual(['5']);
  });

  it('continue avec les autres compétitions quand l\'une est en panne', async () => {
    const { service } = setup({
      events: (key, day) => (key === 'ita.1' && day === '20261115' ? [makeEvent({ id: '9' })] : []),
      fail: (key) => key === 'esp.1',
    });
    const payload = await service.getLiveScores();
    expect(payload.partial).toBe(true);
    expect(payload.matches.map((match) => match.id)).toEqual(['9']);
  });

  it('sert le dernier résultat connu, marqué en retard, quand la source tombe', async () => {
    let down = false;
    const { service, clock } = setup({
      events: (key, day) => (key === 'eng.1' && day === '20261115' ? [makeEvent({ id: '3' })] : []),
      fail: () => down,
    });
    await service.getLiveScores();
    down = true;
    clock.value += 20 * 60 * 1000;
    const payload = await service.getLiveScores();
    expect(payload.matches.map((match) => match.id)).toEqual(['3']);
    expect(payload.stale).toBe(true);
  });

  it('n\'affiche plus des scores vieux de plus de six heures', async () => {
    let down = false;
    const { service, clock } = setup({
      events: (key, day) => (key === 'eng.1' && day === '20261115' ? [makeEvent({ id: '3' })] : []),
      fail: () => down,
    });
    await service.getLiveScores();
    down = true;
    clock.value += 7 * 60 * 60 * 1000;
    await expect(service.getLiveScores()).rejects.toThrow('Source des scores injoignable');
  });

  it('échoue quand la source est en panne et qu\'il n\'y a rien en mémoire', async () => {
    const { service } = setup({ fail: () => true });
    await expect(service.getLiveScores()).rejects.toThrow('Source des scores injoignable');
  });
});

describe('GET /api/live-scores', () => {
  afterEach(() => { jest.resetModules(); jest.dontMock('../../services/live-scores'); });

  function buildApp(getLiveScores) {
    jest.resetModules();
    jest.doMock('../../services/live-scores', () => ({ getLiveScores, COMPETITIONS }));
    const app = express();
    app.use('/api/live-scores', require('../../routes/live-scores'));
    return app;
  }

  it('renvoie les matchs et la liste des compétitions', async () => {
    const match = normalizeEvent(makeEvent(), PREMIER_LEAGUE);
    const app = buildApp(async () => ({ matches: [match], liveCount: 1, updatedAt: 'x', partial: false, stale: false }));
    const res = await request(app).get('/api/live-scores');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, liveCount: 1, stale: false });
    expect(res.body.matches[0].home.name).toBe('Arsenal');
    expect(res.body.competitions).toHaveLength(COMPETITIONS.length);
  });

  it('répond 503 sans détail technique ni mise en cache quand la source est en panne', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = buildApp(async () => { throw new Error('connect ECONNREFUSED 10.0.0.1'); });
    const res = await request(app).get('/api/live-scores');
    consoleError.mockRestore();
    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ success: false, error: 'Scores momentanément indisponibles', matches: [], liveCount: 0 });
  });
});
