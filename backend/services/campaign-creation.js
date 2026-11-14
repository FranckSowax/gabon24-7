/**
 * Création d'une campagne publicitaire « à la carte » (bannière, vidéo,
 * article sponsorisé) : implémentation UNIQUE, appelée par POST /api/campaigns.
 *
 * WHY: trois versions de cette création coexistaient ; la première déclarée
 * (achat par forfait) refusait les demandes des pages marketing. Tout ce que le
 * navigateur ne doit pas décider est fixé ici : le prix (grille serveur), le
 * statut (toujours « pending »), le propriétaire (compte du jeton) et l'état du
 * paiement.
 *
 * @example
 *   const result = await createCampaign({ supabase, userId: req.user.id, body: req.body });
 *   if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
 */

const { z } = require('zod');
const {
  CAMPAIGN_TYPES,
  CAMPAIGN_DURATIONS,
  normalizeCampaignType,
  computeCampaignPrice,
} = require('./campaign-pricing');

/** Campagnes simultanées autorisées par type (null = illimité). */
const CAMPAIGN_LIMITS = {
  'banner-home': 10,
  'banner-feed': 1,
  'video-home': 1,
  'article-trending': null,
};

// Paramètres d'affichage d'une bannière de fil : 1 bannière tous les 7 articles,
// 2 visuels (mobile + ordinateur).
const FEED_POSITION_FREQUENCY = 7;
const FEED_IMAGES_COUNT = 2;

const emptyToUndefined = (value) => (value === '' || value === null ? undefined : value);

const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

// Seules les adresses http(s) sont acceptées : ces valeurs finissent dans des
// liens et des balises image/vidéo affichés à tous les visiteurs
// (pas de `javascript:` ni d'image encodée de plusieurs Mo en base).
const optionalHttpUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(2000).refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, { message: 'Adresse invalide (http ou https attendu)' }).optional()
);

const createCampaignSchema = z.object({
  campaign_type: z.preprocess(
    normalizeCampaignType,
    z.enum(CAMPAIGN_TYPES, { error: 'Type de campagne invalide' })
  ),
  name: z.string({ error: 'Nom de campagne requis' }).trim().min(1, 'Nom de campagne requis').max(150),
  duration_days: z.coerce.number().int().refine((days) => CAMPAIGN_DURATIONS.includes(days), {
    message: `Durée non proposée (${CAMPAIGN_DURATIONS.join(', ')} jours)`,
  }),
  start_date: z.preprocess(
    emptyToUndefined,
    z.string().max(40).refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'Date de début invalide',
    }).optional()
  ),
  redirect_url: optionalHttpUrl,
  design_request: z.boolean().optional(),
  request_creation: z.boolean().optional(),
  design_request_notes: optionalText(2000),

  // Bannières
  banner_title: optionalText(200),
  banner_description: optionalText(1000),
  desktop_image_url: optionalHttpUrl,
  mobile_image_url: optionalHttpUrl,
  banner_image_url: optionalHttpUrl,

  // Vidéo
  video_url: optionalHttpUrl,
  video_title: optionalText(200),
  video_description: optionalText(1000),

  // Article sponsorisé
  article_title: optionalText(200),
  article_subtitle: optionalText(300),
  article_summary: optionalText(1000),
  article_content: optionalText(50000),
  article_author: optionalText(100),
  article_category: optionalText(50),
  article_image_url: optionalHttpUrl,
  company_name: optionalText(100),
  product_service: optionalText(200),
  target_audience: optionalText(500),
});

/** Supprime les clés sans valeur pour n'écrire que les colonnes utiles. */
function _compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

/** États de paiement considérés comme réglés. */
const PAID_STATUSES = ['completed', 'paid'];

// Durée pendant laquelle une campagne créée mais pas encore payée garde son
// créneau : le temps de finir le paiement. Au-delà, un panier abandonné ne
// bloque plus la vente du créneau à quelqu'un d'autre.
const RESERVATION_MINUTES = 30;

/**
 * Indique si une campagne occupe réellement un créneau publicitaire :
 * active, ou en attente et payée, ou en attente non payée mais créée il y a
 * moins de RESERVATION_MINUTES (paiement en cours).
 *
 * @example
 *   const taken = campaigns.filter((c) => occupiesSlot(c)).length;
 */
function occupiesSlot(campaign, now = new Date()) {
  if (!campaign) return false;
  if (campaign.status === 'active') return true;
  if (campaign.status !== 'pending') return false;
  if (PAID_STATUSES.includes(campaign.payment_status)) return true;
  const createdAt = Date.parse(campaign.created_at);
  // Date de création illisible : on réserve par prudence plutôt que de survendre.
  if (Number.isNaN(createdAt)) return true;
  return now.getTime() - createdAt < RESERVATION_MINUTES * 60 * 1000;
}

/**
 * Compte les campagnes du même type qui occupent déjà la période demandée.
 * Renvoie { ok: false } si la lecture échoue : on ne vend pas un créneau sans
 * avoir pu vérifier qu'il est libre.
 */
async function _findOverlapping(supabase, campaignType, start, end) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, status, payment_status, created_at')
    .eq('campaign_type', campaignType)
    .in('status', ['active', 'pending'])
    .lte('start_date', end.toISOString())
    .gte('end_date', start.toISOString());

  if (error) return { ok: false };
  return { ok: true, count: (data || []).filter((campaign) => occupiesSlot(campaign)).length };
}

/**
 * Publie ou dépublie l'article lié à une campagne « article sponsorisé ».
 * Sans effet pour les autres campagnes (aucun article lié). Ne lève jamais :
 * un échec est journalisé et signalé par `false`, il n'annule pas la décision
 * de l'administrateur sur la campagne.
 *
 * @example
 *   await setSponsoredArticlePublished(supabase, campaign.id, true); // à la validation
 */
async function setSponsoredArticlePublished(supabase, campaignId, published) {
  try {
    const { error } = await supabase
      .from('articles')
      .update({ is_published: published === true, updated_at: new Date().toISOString() })
      .eq('external_id', `sponsored-${campaignId}`);
    if (error) {
      console.error(`❌ Article sponsorisé de la campagne ${campaignId} non mis à jour:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`❌ Article sponsorisé de la campagne ${campaignId} non mis à jour:`, err.message);
    return false;
  }
}

/**
 * Crée l'article associé à une campagne « article sponsorisé ». Il reste non
 * publié tant que la campagne n'est pas validée. Un échec ici n'annule pas la
 * campagne : il est journalisé et l'équipe peut recréer l'article.
 */
async function _createSponsoredArticle(supabase, campaign, input, startDate) {
  let feedId = null;
  const { data: existingFeed } = await supabase
    .from('rss_feeds')
    .select('id')
    .eq('name', 'Gabon Insight')
    .maybeSingle();

  if (existingFeed) {
    feedId = existingFeed.id;
  } else {
    const { data: newFeed, error: feedError } = await supabase
      .from('rss_feeds')
      .insert([{
        name: 'Gabon Insight',
        url: 'https://gabon-insight.netlify.app/sponsored',
        description: 'Articles sponsorisés et contenus partenaires',
        category: 'Sponsorisé',
        language: 'fr',
        country: 'GA',
        status: 'active',
        is_premium: true,
        priority: 1,
      }])
      .select('id')
      .single();
    if (feedError) {
      console.error('❌ Erreur création flux Gabon Insight:', feedError.message);
    } else {
      feedId = newFeed.id;
    }
  }

  const summary = input.article_summary || input.article_subtitle;
  const content = input.article_content || '';
  const now = new Date().toISOString();

  const { data: article, error: articleError } = await supabase
    .from('articles')
    .insert([{
      feed_id: feedId,
      external_id: `sponsored-${campaign.id}`,
      title: input.article_title,
      summary: summary || 'Article sponsorisé',
      summary_ai: summary || null,
      content,
      url: input.redirect_url || null,
      author: input.article_author || 'Équipe Gabon Insight',
      published_at: startDate.toISOString(),
      language: 'fr',
      category: input.article_category || 'business',
      keywords: [input.company_name, input.product_service, 'sponsorisé', 'publicité', input.target_audience]
        .filter(Boolean),
      sentiment: 'positif',
      sentiment_confidence: 0.85,
      read_time_minutes: Math.max(1, Math.ceil((content.length || 500) / 1000 * 5)),
      image_urls: input.article_image_url ? [input.article_image_url] : [],
      is_trending: true,
      // Pas de compteurs renseignés ici : l'article démarre à zéro, comme tout
      // autre. L'ancienne version lui attribuait 5 000 à 8 000 vues et des
      // dizaines de partages inventés, affichés aux lecteurs et à l'annonceur.
      is_published: false,
      is_premium: false,
      created_at: now,
      updated_at: now,
    }])
    .select()
    .single();

  if (articleError) {
    console.error('❌ Erreur création article sponsorisé:', articleError.message);
    return null;
  }
  return article;
}

/**
 * Valide la demande, calcule le prix, vérifie le créneau et enregistre la
 * campagne. `budget`, `status`, `user_id`, `payment_status`, `views` ou
 * `clicks` envoyés par le navigateur sont ignorés.
 *
 * @returns {Promise<{ok: true, campaign: object, sponsoredArticle: object|null, price: number}
 *   | {ok: false, status: number, error: string, details?: object}>}
 */
async function createCampaign({ supabase, userId, body }) {
  if (!userId) {
    return { ok: false, status: 401, error: 'Authentification requise' };
  }

  const parsed = createCampaignSchema.safeParse(body || {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: issue ? issue.message : 'Données de campagne invalides',
      details: { field: issue ? issue.path.join('.') : undefined },
    };
  }
  const input = parsed.data;
  const designRequest = input.design_request === true || input.request_creation === true;

  const pricing = computeCampaignPrice({
    campaign_type: input.campaign_type,
    duration_days: input.duration_days,
    design_request: designRequest,
  });
  if (!pricing.ok) {
    return { ok: false, status: 400, error: pricing.error };
  }

  const startDate = input.start_date ? new Date(input.start_date) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + input.duration_days);

  const limit = CAMPAIGN_LIMITS[input.campaign_type];
  if (limit !== null) {
    const overlap = await _findOverlapping(supabase, input.campaign_type, startDate, endDate);
    if (!overlap.ok) {
      return { ok: false, status: 500, error: 'Erreur lors de la vérification de disponibilité' };
    }
    if (overlap.count >= limit) {
      return {
        ok: false,
        status: 409,
        error: `Créneau complet : ${overlap.count}/${limit} campagne(s) sur cette période. Choisissez une autre date.`,
        details: { limit, current_count: overlap.count },
      };
    }
  }

  const now = new Date().toISOString();
  const isArticle = input.campaign_type === 'article-trending';
  const isFeed = input.campaign_type === 'banner-feed';
  const isVideo = input.campaign_type === 'video-home';

  const campaignData = _compact({
    user_id: userId,
    campaign_type: input.campaign_type,
    name: input.name,
    redirect_url: input.redirect_url,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    duration_days: input.duration_days,
    design_request: designRequest,
    design_request_notes: input.design_request_notes || null,
    budget: pricing.price,
    status: 'pending',
    payment_status: 'pending',
    views: 0,
    clicks: 0,
    banner_title: isArticle ? (input.article_title || input.name) : (input.banner_title || ''),
    banner_description: isArticle
      ? (input.article_summary || input.article_subtitle || '')
      : (input.banner_description || ''),
    desktop_image_url: isArticle ? undefined : input.desktop_image_url,
    mobile_image_url: isArticle ? undefined : input.mobile_image_url,
    banner_image_url: isFeed ? (input.banner_image_url || input.desktop_image_url) : undefined,
    feed_position_frequency: isFeed ? FEED_POSITION_FREQUENCY : undefined,
    feed_images_count: isFeed ? FEED_IMAGES_COUNT : undefined,
    video_url: isVideo ? input.video_url : undefined,
    video_title: isVideo ? input.video_title : undefined,
    video_description: isVideo ? input.video_description : undefined,
    created_at: now,
    updated_at: now,
  });

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert([campaignData])
    .select()
    .single();

  if (error || !campaign) {
    console.error('❌ Erreur insertion campagne:', error ? error.message : 'aucune ligne renvoyée');
    return { ok: false, status: 500, error: 'Erreur lors de la création de la campagne' };
  }

  let sponsoredArticle = null;
  if (isArticle && input.article_title) {
    try {
      sponsoredArticle = await _createSponsoredArticle(supabase, campaign, input, startDate);
    } catch (articleError) {
      console.error('❌ Erreur création article sponsorisé:', articleError.message);
    }
  }

  return { ok: true, campaign, sponsoredArticle, price: pricing.price };
}

module.exports = {
  createCampaign,
  createCampaignSchema,
  CAMPAIGN_LIMITS,
  RESERVATION_MINUTES,
  occupiesSlot,
  setSponsoredArticlePublished,
};
