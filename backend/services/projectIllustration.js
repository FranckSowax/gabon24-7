/**
 * Génération d'illustrations projet via OpenAI GPT Image 2 (gpt-image-2).
 * - Construit des PROMPTS JSON structurés (style 3D isométrique, thème BCEG,
 *   contexte Gabon, libellés FR) à partir des données du projet.
 * - Appelle l'API images, renvoie un Buffer PNG.
 *
 * 3 types : 'logo', 'flyer', 'infographic'.
 */

const IMAGE_MODEL = 'gpt-image-2';

// Palette BCEG (réutilisée dans tous les prompts)
const BCEG_PALETTE = {
  primary_green: '#697357',
  dark_green: '#4d553e',
  light_sage: '#8a9576',
  gold_accent: '#f59e0b',
  background_base: '#ffffff',
  background_tint: '#f1f4ee',
};

const NEGATIVE_COMMON =
  'no gibberish text, no misspelled French, no fake/invented logos, no watermark, ' +
  'no neon colors, no dark/gloomy background, no clashing palette outside BCEG greens and gold, ' +
  'no photorealistic human faces, no clutter';

function getOpenAI() {
  const OpenAI = require('openai');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY manquant');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120000, maxRetries: 2 });
}

/** Compacte les données projet utiles pour les prompts. */
function projectBrief(project = {}, docs = []) {
  const sections = (docs || [])
    .filter((d) => /business[-_]plan|action[-_]plan/i.test(d.document_type || ''))
    .sort((a, b) => (a.metadata?.section_number ?? 99) - (b.metadata?.section_number ?? 99))
    .map((d) => (d.title || d.metadata?.section_title || '').trim())
    .filter(Boolean)
    .slice(0, 12);

  return {
    nom: project.proposition_titre || project.project_name || project.article_title || 'Projet',
    secteur: project.secteur_selectionne || project.secteur || '',
    problematique: project.problematique_centrale || '',
    description: (project.proposition_description || '').slice(0, 800),
    cible: project.cible || project.marche_cible || '',
    modele_revenus: project.modele_revenus || '',
    elements_disponibles: sections,
  };
}

/** Prompt JSON pour un LOGO. */
function buildLogoPrompt(project, docs) {
  const b = projectBrief(project, docs);
  return {
    task: 'logo_generation',
    brief: `Logo d'entreprise moderne pour un projet au Gabon : "${b.nom}"${b.secteur ? `, secteur ${b.secteur}` : ''}.`,
    format: { aspect_ratio: '1:1', resolution: 'high', background: 'transparent or solid off-white #f1f4ee' },
    style: {
      type: 'modern flat vector logo, minimal, memorable, scalable',
      mood: 'professional, trustworthy, premium African business',
      ideas: 'subtle icon evoking the sector and Gabon; clean geometric mark + optional wordmark',
    },
    color_palette: BCEG_PALETTE,
    typography: { font: 'clean geometric sans-serif', wordmark_text_fr: b.nom, language: 'french' },
    context: 'Gabon, Central Africa; usable on a BCEG financing dossier',
    negative_prompt: NEGATIVE_COMMON + ', no mockups, no multiple variants, single centered logo only',
  };
}

/** Prompt JSON pour un FLYER / prospectus de présentation. */
function buildFlyerPrompt(project, docs) {
  const b = projectBrief(project, docs);
  return {
    task: 'flyer_generation',
    title: b.nom,
    concept: `Flyer de présentation A4 (portrait) du projet "${b.nom}"${b.secteur ? ` (${b.secteur})` : ''} au Gabon. ${b.description}`,
    format: { orientation: 'portrait', aspect_ratio: '4:5', resolution: 'high (print quality)', safe_margins: true },
    style: {
      type: 'soft 3D isometric marketing flyer',
      render: 'soft-clay 3D pictograms, gentle shadows, airy layout, generous whitespace',
      mood: 'premium, warm, trustworthy, optimistic African business',
    },
    color_palette: BCEG_PALETTE,
    background: { fill: 'white to very pale green (#f1f4ee) gradient', pattern: 'discreet geometric texture', accent: 'subtle Gabonese tropical foliage in corners' },
    sections: [
      { id: 'header', text_fr: b.nom, subtitle_fr: b.secteur || 'Projet entrepreneurial — Gabon' },
      { id: 'pitch', text_fr: (b.problematique || b.description || '').slice(0, 160) },
      { id: 'offer', icon_3d: 'product/service icon relevant to the sector', text_fr: 'Notre offre' },
      { id: 'benefits', icon_3d: '3 small benefit icons', text_fr: 'Bénéfices clés' },
      { id: 'cta', icon_3d: '3D phone / contact', text_fr: 'Contactez-nous' },
    ],
    typography: { font: 'clean modern geometric sans-serif', headings_color: BCEG_PALETTE.dark_green, language: 'all on-image text in FRENCH, short and crisp' },
    context: 'Gabon, FCFA currency if money shown',
    negative_prompt: NEGATIVE_COMMON,
  };
}

/** Prompt JSON pour l'INFOGRAPHIE "votre business en 1 image". */
function buildInfographicPrompt(project, docs) {
  const b = projectBrief(project, docs);
  return {
    task: 'infographic_generation',
    concept: `Infographie qui fait comprendre en un coup d'œil le business "${b.nom}" au Gabon`
      + `${b.secteur ? ` (secteur ${b.secteur})` : ''}. Problématique: ${b.problematique || '—'}. `
      + `Présenter: le concept, les objectifs, les chiffres clés (FCFA), le fonctionnement (étapes), la cible et le modèle de revenus.`,
    project_data: b,
    format: { orientation: 'portrait', aspect_ratio: '4:5', resolution: 'high (print/presentation quality)', safe_margins: true },
    style: {
      type: 'soft 3D isometric infographic, Pixar/Walt-Disney-like friendly 3D characters',
      render: 'Cinema4D / soft-clay, matte materials, soft global illumination, soft drop shadows, crisp modern 3D pictograms',
      characters: 'stylized friendly 3D Gabonese entrepreneurs (mixed gender), Disney/Pixar charm, NOT photorealistic',
      mood: 'premium, warm, trustworthy, optimistic African business',
      detail_level: 'clean and airy, generous whitespace, not cluttered',
    },
    color_palette: BCEG_PALETTE,
    background: { fill: 'white to very pale green (#f1f4ee) gradient', pattern: 'discreet low-contrast geometric texture', accent: 'minimal stylized Gabonese tropical foliage in corners, very subtle' },
    composition: {
      structure: 'central title + 4 to 6 thematic blocks with 3D icons, mini charts and a character scene; clear visual hierarchy',
      blocks: ['Concept (1 phrase)', 'Objectifs', 'Chiffres clés (FCFA, en or)', 'Fonctionnement (étapes numérotées)', 'Cible & marché', 'Modèle de revenus'],
      flow: 'top-to-bottom reading, numbered steps with glossy 3D arrows',
    },
    money_rule: 'use gold/amber (#f59e0b) only for money (FCFA), highlights and validation marks',
    typography: { font: 'clean modern geometric sans-serif', headings_color: BCEG_PALETTE.dark_green, body_color: BCEG_PALETTE.dark_green, language: 'ALL on-image text in FRENCH, short and crisp', legibility: 'high contrast text on light cards' },
    context: 'Gabon, Central Africa; currency FCFA; suitable for a BCEG financing dossier',
    negative_prompt: NEGATIVE_COMMON + ', no text overflow, no illegible fonts',
  };
}

const BUILDERS = { logo: buildLogoPrompt, flyer: buildFlyerPrompt, infographic: buildInfographicPrompt };
const SIZES = { logo: '1024x1024', flyer: '1024x1536', infographic: '1024x1536' };

/** Construit le prompt JSON pour un type donné. */
function buildPrompt(kind, project, docs) {
  const fn = BUILDERS[kind];
  if (!fn) throw new Error(`Type d'illustration invalide: ${kind}`);
  return fn(project, docs);
}

/**
 * Génère l'image via gpt-image-2 et renvoie { buffer, promptJson, size }.
 */
async function generateIllustration(kind, project, docs) {
  const promptJson = buildPrompt(kind, project, docs);
  const size = SIZES[kind] || '1024x1024';

  // Le prompt texte = instruction + spécification JSON (gpt-image gère bien le JSON structuré)
  const promptText =
    `Génère une image selon CETTE SPÉCIFICATION JSON. Respecte strictement le style, ` +
    `la palette BCEG, le contexte Gabon, et écris TOUT le texte de l'image en FRANÇAIS, ` +
    `sans fautes.\n\n${JSON.stringify(promptJson, null, 2)}`;

  const client = getOpenAI();
  const resp = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: promptText,
    size,
    n: 1,
  });

  const b64 = resp?.data?.[0]?.b64_json;
  if (!b64) throw new Error('Réponse image vide (gpt-image-2)');
  return { buffer: Buffer.from(b64, 'base64'), promptJson, size };
}

module.exports = { buildPrompt, generateIllustration, IMAGE_MODEL, SIZES };
