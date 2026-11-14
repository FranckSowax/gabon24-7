/**
 * Grille tarifaire des campagnes : le prix est calculé par le serveur.
 * Valeurs validées le 2026-11-14 (prix des listes déroulantes à l'achat).
 */

const {
  computeCampaignPrice,
  normalizeCampaignType,
  CAMPAIGN_TYPES,
  CAMPAIGN_DURATIONS,
} = require('../../services/campaign-pricing');

describe('computeCampaignPrice', () => {
  it.each([
    ['banner-home', 7, 50000], ['banner-home', 14, 90000], ['banner-home', 21, 130000], ['banner-home', 30, 160000],
    ['banner-feed', 7, 85000], ['banner-feed', 14, 162000], ['banner-feed', 21, 229500], ['banner-feed', 30, 306000],
    ['video-home', 7, 450000], ['video-home', 14, 855000], ['video-home', 21, 1215000], ['video-home', 30, 1620000],
    ['article-trending', 7, 250000], ['article-trending', 14, 475000], ['article-trending', 21, 675000], ['article-trending', 30, 900000],
  ])('%s sur %i jours = %i FCFA', (campaign_type, duration_days, price) => {
    expect(computeCampaignPrice({ campaign_type, duration_days })).toEqual({ ok: true, price, base: price, creation: 0 });
  });

  it.each([
    ['banner-home', 50000],
    ['banner-feed', 0],
    ['video-home', 300000],
    ['article-trending', 150000],
  ])('option de création pour %s : +%i FCFA', (campaign_type, creation) => {
    const without = computeCampaignPrice({ campaign_type, duration_days: 7 });
    const withCreation = computeCampaignPrice({ campaign_type, duration_days: 7, design_request: true });

    expect(withCreation.price - without.price).toBe(creation);
  });

  it('n\'applique l\'option de création que sur un vrai booléen', () => {
    const base = computeCampaignPrice({ campaign_type: 'video-home', duration_days: 7 }).price;

    for (const value of ['true', 1, 'false', null, undefined]) {
      expect(computeCampaignPrice({ campaign_type: 'video-home', duration_days: 7, design_request: value }).price).toBe(base);
    }
  });

  it('accepte l\'ancienne écriture avec soulignés et une durée en texte', () => {
    expect(computeCampaignPrice({ campaign_type: 'banner_home', duration_days: '14' }).price).toBe(90000);
    expect(normalizeCampaignType('Video_Home')).toBe('video-home');
  });

  it.each([
    ['type inconnu', { campaign_type: 'gratuit', duration_days: 7 }],
    ['type hérité d\'Object', { campaign_type: 'constructor', duration_days: 7 }],
    ['type absent', { duration_days: 7 }],
    ['durée hors grille', { campaign_type: 'banner-home', duration_days: 1 }],
    ['durée nulle', { campaign_type: 'banner-home', duration_days: 0 }],
    ['durée négative', { campaign_type: 'banner-home', duration_days: -7 }],
    ['durée non numérique', { campaign_type: 'banner-home', duration_days: 'toString' }],
    ['durée absente', { campaign_type: 'banner-home' }],
    ['campagne absente', undefined],
  ])('refuse : %s', (label, campaign) => {
    const result = computeCampaignPrice(campaign);

    expect(result.ok).toBe(false);
    expect(result.price).toBeUndefined();
  });

  it('expose les types et durées proposés', () => {
    expect(CAMPAIGN_TYPES).toEqual(['banner-home', 'banner-feed', 'video-home', 'article-trending']);
    expect(CAMPAIGN_DURATIONS).toEqual([7, 14, 21, 30]);
  });
});
