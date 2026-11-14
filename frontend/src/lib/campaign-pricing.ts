/**
 * Grille tarifaire des campagnes publicitaires (FCFA), côté interface.
 *
 * COPIE de backend/services/campaign-pricing.js, qui fait foi : le serveur
 * recalcule toujours le prix et refuse le paiement si le total affiché ne
 * correspond pas. Toute modification doit être faite aux deux endroits.
 *
 * @example
 *   getCampaignPrice('video-home', 14, true) // 855 000 + 300 000 = 1 155 000
 */

export type PricedCampaignType = 'banner-home' | 'banner-feed' | 'video-home' | 'article-trending'

interface CampaignPricing {
  durations: Record<number, number>
  /** Supplément quand l'équipe crée le visuel, la vidéo ou l'article */
  creation: number
}

export const CAMPAIGN_PRICING: Record<PricedCampaignType, CampaignPricing> = {
  'banner-home': { durations: { 7: 50000, 14: 90000, 21: 130000, 30: 160000 }, creation: 50000 },
  'banner-feed': { durations: { 7: 85000, 14: 162000, 21: 229500, 30: 306000 }, creation: 0 },
  'video-home': { durations: { 7: 450000, 14: 855000, 21: 1215000, 30: 1620000 }, creation: 300000 },
  'article-trending': { durations: { 7: 250000, 14: 475000, 21: 675000, 30: 900000 }, creation: 150000 },
}

/**
 * Prix d'une campagne selon son type, sa durée et l'option de création.
 * Une durée hors grille retombe sur le tarif d'une semaine ; le serveur, lui,
 * la refusera.
 */
export function getCampaignPrice(type: PricedCampaignType, durationDays: number, creation = false): number {
  const pricing = CAMPAIGN_PRICING[type]
  const base = pricing.durations[durationDays] ?? pricing.durations[7]
  return base + (creation ? pricing.creation : 0)
}
