/**
 * Création d'une campagne publicitaire PAR FORFAIT (table ad_packages) avec
 * ses diapositives promotionnelles. Appelée par POST /api/campaigns quand la
 * demande ne contient pas de `campaign_type`.
 *
 * WHY: le site envoyait les diapositives sous le nom `slides`, le serveur
 * attendait `slides_data` : tout achat par forfait était refusé. L'ancien code
 * recopiait aussi chaque diapositive telle que reçue dans la base ; un client
 * pouvait donc y glisser n'importe quelle colonne (statut, compteurs de vues).
 * Ici seuls les champs prévus sont repris, et le prix vient du forfait en base.
 *
 * @example
 *   const result = await createPackageCampaign({ supabase, userId: req.user.id, body: req.body });
 *   if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
 */

const { z } = require('zod');

const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);

// Seules les adresses http(s) sont acceptées : elles finissent dans des liens
// et des images affichés à tous les visiteurs.
const optionalHttpUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(2000).refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, { error: 'Adresse invalide (http ou https attendu)' }).optional()
);

const slideSchema = z.object({
  title: z.string({ error: 'Titre de la diapositive requis' }).trim().min(1, 'Titre de la diapositive requis').max(200),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  image_url: optionalHttpUrl,
  link_url: optionalHttpUrl,
  cta_text: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
});

const packageCampaignSchema = z.object({
  company_name: z.string({ error: 'Nom de l\'entreprise requis' }).trim().min(1, 'Nom de l\'entreprise requis').max(150),
  contact_email: z.string({ error: 'E-mail de contact requis' }).trim().max(200).email('E-mail de contact invalide'),
  contact_phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  package_id: z.union([z.string().trim().min(1).max(64), z.number().int().positive()], {
    error: 'Forfait requis',
  }),
  start_date: z.string({ error: 'Date de début requise' }).max(40).refine(
    (value) => !Number.isNaN(Date.parse(value)),
    { error: 'Date de début invalide' }
  ),
  slides: z.array(slideSchema, { error: 'Au moins une diapositive est requise' })
    .min(1, 'Au moins une diapositive est requise')
    .max(20, 'Trop de diapositives'),
});

/**
 * Valide la demande, lit le forfait, crée la campagne puis ses diapositives.
 * `total_amount`, `payment_status`, `user_id` et tout autre champ envoyé par
 * le navigateur sont ignorés.
 *
 * @returns {Promise<{ok: true, campaign: object, slides: object[]}
 *   | {ok: false, status: number, error: string, details?: object}>}
 */
async function createPackageCampaign({ supabase, userId, body }) {
  if (!userId) {
    return { ok: false, status: 401, error: 'Authentification requise' };
  }

  const raw = body || {};
  const parsed = packageCampaignSchema.safeParse({
    company_name: raw.company_name,
    contact_email: raw.contact_email,
    contact_phone: raw.contact_phone,
    package_id: raw.package_id,
    start_date: raw.start_date,
    // Le site envoie `slides` ; l'ancien nom `slides_data` reste accepté.
    slides: Array.isArray(raw.slides) ? raw.slides : raw.slides_data,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: issue ? issue.message : 'Données manquantes pour créer la campagne',
      details: { field: issue ? issue.path.join('.') : undefined },
    };
  }
  const input = parsed.data;

  const { data: packageInfo, error: packageError } = await supabase
    .from('ad_packages')
    .select('*')
    .eq('id', input.package_id)
    .single();

  if (packageError || !packageInfo) {
    return { ok: false, status: 400, error: 'Forfait publicitaire introuvable' };
  }
  if (packageInfo.is_active === false) {
    return { ok: false, status: 400, error: 'Ce forfait n\'est plus proposé' };
  }

  const price = Number(packageInfo.price_fcfa);
  const durationDays = Number(packageInfo.duration_days);
  if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(durationDays) || durationDays <= 0) {
    console.error('❌ Forfait mal configuré:', packageInfo.id);
    return { ok: false, status: 500, error: 'Forfait mal configuré. Contactez le support.' };
  }

  const maxSlides = Number(packageInfo.max_slides);
  if (Number.isInteger(maxSlides) && maxSlides > 0 && input.slides.length > maxSlides) {
    return {
      ok: false,
      status: 400,
      error: `Ce forfait autorise ${maxSlides} diapositive(s) au maximum`,
      details: { max_slides: maxSlides },
    };
  }

  const startDate = new Date(input.start_date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: userId,
      company_name: input.company_name,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone || null,
      package_id: packageInfo.id,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      total_amount: price,
      payment_status: 'pending',
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    console.error('❌ Erreur création campagne forfait:', campaignError ? campaignError.message : 'aucune ligne');
    return { ok: false, status: 500, error: 'Erreur lors de la création de la campagne' };
  }

  const slideRows = input.slides.map((slide, index) => ({
    campaign_id: campaign.id,
    title: slide.title,
    description: slide.description || null,
    image_url: slide.image_url || null,
    link_url: slide.link_url || null,
    cta_text: slide.cta_text || 'En savoir plus',
    display_order: index,
  }));

  const { data: slides, error: slidesError } = await supabase
    .from('promotional_slides')
    .insert(slideRows)
    .select();

  if (slidesError) {
    // La campagne existe mais sans visuels : on le dit, plutôt que de laisser
    // croire à une commande complète. Rien n'a été payé à ce stade.
    console.error(`❌ Diapositives non enregistrées pour la campagne ${campaign.id}:`, slidesError.message);
    return {
      ok: false,
      status: 500,
      error: 'La campagne a été créée mais ses diapositives n\'ont pas pu être enregistrées. Contactez le support.',
      details: { campaign_id: campaign.id },
    };
  }

  return { ok: true, campaign, slides: slides || [] };
}

module.exports = { createPackageCampaign, packageCampaignSchema };
