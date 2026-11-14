/**
 * Garde « campagne payée » : une campagne publicitaire ne peut être approuvée,
 * validée, activée ou reprise que si son paiement est confirmé.
 *
 * WHY: toutes les campagnes passent par le panier, mais la campagne est créée
 * avant le paiement. Sans ce garde, un administrateur pouvait publier une
 * campagne dont le paiement n'avait jamais abouti (panier abandonné, échec).
 * Pour un règlement hors ligne (espèces, virement), l'administrateur marque
 * d'abord le paiement comme reçu (PUT /api/admin/campaigns/:id), puis valide.
 *
 * @example
 *   const guard = requirePaidCampaign(supabase);
 *   app.put('/api/campaigns/:id/validate', requireAdmin, guard);
 */

/** États de paiement considérés comme réglés. */
const PAID_STATUSES = ['completed', 'paid'];

/**
 * Indique si une campagne est réglée.
 * @param {{ payment_status?: string | null } | null | undefined} campaign
 */
function isCampaignPaid(campaign) {
  return Boolean(campaign) && PAID_STATUSES.includes(campaign.payment_status);
}

/**
 * Construit le middleware Express. Lit la campagne `req.params.id` et laisse
 * passer uniquement si elle est payée. En cas d'erreur de lecture, refuse :
 * on ne publie pas une campagne dont on n'a pas pu vérifier le paiement.
 */
function requirePaidCampaign(supabase) {
  return async function paidCampaignGuard(req, res, next) {
    try {
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('id, payment_status')
        .eq('id', req.params.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Vérification du paiement de la campagne impossible:', error.message);
        return res.status(503).json({
          success: false,
          error: 'Impossible de vérifier le paiement de la campagne. Réessayez.',
          code: 'PAYMENT_CHECK_UNAVAILABLE',
        });
      }
      if (!campaign) {
        return res.status(404).json({ success: false, error: 'Campagne non trouvée' });
      }
      if (!isCampaignPaid(campaign)) {
        return res.status(409).json({
          success: false,
          error: 'Cette campagne n\'est pas payée : elle ne peut pas être validée ni activée.',
          code: 'CAMPAIGN_NOT_PAID',
          payment_status: campaign.payment_status || null,
        });
      }
      return next();
    } catch (err) {
      console.error('❌ Vérification du paiement de la campagne impossible:', err.message);
      return res.status(503).json({
        success: false,
        error: 'Impossible de vérifier le paiement de la campagne. Réessayez.',
        code: 'PAYMENT_CHECK_UNAVAILABLE',
      });
    }
  };
}

module.exports = { requirePaidCampaign, isCampaignPaid, PAID_STATUSES };
