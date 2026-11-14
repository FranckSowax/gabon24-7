/**
 * Grille tarifaire des campagnes publicitaires (FCFA).
 *
 * Source de vérité UNIQUE du prix d'une campagne. Le prix n'est jamais lu dans
 * la requête du navigateur : il est calculé ici à partir du type, de la durée
 * et de l'option de création.
 *
 * WHY: le montant payé était la somme des `budget` envoyés par le navigateur ;
 * en modifiant cette valeur on payait 1 FCFA une campagne à 450 000 FCFA.
 *
 * Grille validée le 2026-11-14 : ce sont les prix des listes déroulantes
 * affichées au client au moment de choisir sa durée. La même grille est
 * recopiée côté interface dans frontend/src/lib/campaign-pricing.ts : toute
 * modification doit être faite aux deux endroits.
 *
 * @example
 *   const { computeCampaignPrice } = require('./campaign-pricing');
 *   computeCampaignPrice({ campaign_type: 'banner-home', duration_days: 14, design_request: true });
 *   // => { ok: true, price: 140000, base: 90000, creation: 50000 }
 */

const CAMPAIGN_PRICING = Object.freeze({
  'banner-home': Object.freeze({
    durations: Object.freeze({ 7: 50000, 14: 90000, 21: 130000, 30: 160000 }),
    creation: 50000, // création du design par l'équipe
  }),
  'banner-feed': Object.freeze({
    durations: Object.freeze({ 7: 85000, 14: 162000, 21: 229500, 30: 306000 }),
    creation: 0, // demande de design sans supplément
  }),
  'video-home': Object.freeze({
    durations: Object.freeze({ 7: 450000, 14: 855000, 21: 1215000, 30: 1620000 }),
    creation: 300000, // création de la vidéo par l'équipe
  }),
  'article-trending': Object.freeze({
    durations: Object.freeze({ 7: 250000, 14: 475000, 21: 675000, 30: 900000 }),
    creation: 150000, // rédaction de l'article par l'équipe
  }),
});

const CAMPAIGN_TYPES = Object.freeze(Object.keys(CAMPAIGN_PRICING));
const CAMPAIGN_DURATIONS = Object.freeze([7, 14, 21, 30]);

/** Ramène `banner_home` (ancienne écriture) à `banner-home` (écriture en base). */
function normalizeCampaignType(type) {
  return typeof type === 'string' ? type.trim().toLowerCase().replace(/_/g, '-') : type;
}

/**
 * Calcule le prix d'une campagne.
 * @param {object} campaign
 * @param {string} campaign.campaign_type
 * @param {number} campaign.duration_days 7, 14, 21 ou 30
 * @param {boolean} [campaign.design_request] création du visuel / de la vidéo / de l'article
 * @returns {{ok: true, price: number, base: number, creation: number} | {ok: false, error: string}}
 */
function computeCampaignPrice(campaign) {
  const type = normalizeCampaignType(campaign && campaign.campaign_type);
  const pricing = Object.prototype.hasOwnProperty.call(CAMPAIGN_PRICING, type) ? CAMPAIGN_PRICING[type] : null;
  if (!pricing) return { ok: false, error: 'Type de campagne invalide' };

  const duration = Number(campaign.duration_days);
  const base = Object.prototype.hasOwnProperty.call(pricing.durations, duration) ? pricing.durations[duration] : null;
  if (base === null) {
    return { ok: false, error: `Durée non proposée (choix possibles : ${CAMPAIGN_DURATIONS.join(', ')} jours)` };
  }

  const creation = campaign.design_request === true ? pricing.creation : 0;
  return { ok: true, price: base + creation, base, creation };
}

module.exports = {
  CAMPAIGN_PRICING,
  CAMPAIGN_TYPES,
  CAMPAIGN_DURATIONS,
  normalizeCampaignType,
  computeCampaignPrice,
};
