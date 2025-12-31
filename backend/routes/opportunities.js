/**
 * 💡 ROUTES OPPORTUNITÉS IA - Powered by Google Gemini
 * Analyse et génération d'opportunités business intelligentes
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { checkOpenAIError, checkUsageThreshold } = require('../utils/quota-monitor');
const aiValidation = require('../middleware/ai-validation');
const geminiService = require('../services/gemini-service');

// Helpers
function truncate(text = '', max = 3500) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}
function stripHtml(html = '') {
  try { return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); } catch { return html || '' }
}
function extractJsonBlock(text = '') {
  // Try code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1];
  // Try to find first JSON object/array
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  const start = (startObj >= 0 && (startObj < startArr || startArr < 0)) ? startObj : startArr;
  if (start < 0) return '';
  // naive balance to end
  let stack = [];
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') {
      const last = stack.pop();
      if (!stack.length) {
        return text.slice(start, i + 1);
      }
    }
  }
  return text.slice(start);
}
function parseStructuredOrNull(text = '') {
  try { return JSON.parse(text); } catch {}
  const block = extractJsonBlock(text);
  if (block) {
    try { return JSON.parse(block); } catch {}
  }
  return null;
}

// Fallback structuré inspiré de l'ancienne fonction Netlify
function generateFallbackAnalysis(article = { title: '', summary: '', source: '' }) {
  const title = String(article.title || 'Actualité gabonaise');
  const t = (article.title || '').toLowerCase();
  const s = (article.summary || '').toLowerCase();
  const txt = `${t} ${s}`;
  let secteurs_opportunites = [];
  if (/école|étudiant|formation|éducation|université|cours/.test(txt)) {
    secteurs_opportunites = [
      { nom: 'Éducation et Formation', description: 'Cours, EdTech, formations professionnelles', score_potentiel: 8 },
      { nom: 'Matériel éducatif', description: 'Fournitures et équipements scolaires', score_potentiel: 7 }
    ];
  } else if (/transport|route|accident|circulation|véhicule|taxi/.test(txt)) {
    secteurs_opportunites = [
      { nom: 'Transport et Mobilité', description: 'Services de transport, logistique', score_potentiel: 7 },
      { nom: 'Maintenance automobile', description: 'Réparation et entretien de véhicules', score_potentiel: 8 }
    ];
  } else if (/technologie|digital|numérique|internet|mobile|app/.test(txt)) {
    secteurs_opportunites = [
      { nom: 'Technologie et Digital', description: 'Apps, services numériques, e-commerce', score_potentiel: 9 },
      { nom: 'Formation informatique', description: 'Compétences et certifications tech', score_potentiel: 7 }
    ];
  } else if (/santé|médical|hôpital|docteur|patient/.test(txt)) {
    secteurs_opportunites = [
      { nom: 'Santé et Bien-être', description: 'Cliniques, bien-être, pharmacie', score_potentiel: 8 },
      { nom: 'Parapharmacie', description: 'Produits de santé et bien-être', score_potentiel: 7 }
    ];
  } else {
    secteurs_opportunites = [
      { nom: 'Commerce de proximité', description: "Boutique et services de quartier", score_potentiel: 7 },
      { nom: 'Services aux entreprises', description: 'Solutions B2B pour PME locales', score_potentiel: 6 }
    ];
  }
  return {
    analyse_contextuelle: {
      problematique_centrale: article.summary || `Opportunités identifiées dans le contexte de: ${title}`,
      tendances_macro: ['Digitalisation', 'Urbanisation', 'Jeunesse'],
      analyse_swot: {
        forces: ['Demande locale', 'Potentiel de différenciation'],
        faiblesses: ['Accès financement', 'Infrastructure']
      }
    },
    secteurs_opportunites
  };
}

// Helper: Appel IA pour ANALYSE via Gemini 3 Pro avec JSON garanti
async function callAIAnalysis(prompt, options = {}) {
  try {
    console.log('🚀 Analyse IA via Gemini 3 Pro (Primary)...');
    
    // Utiliser Gemini Service
    const structured = await geminiService.generateJSON(prompt, {
      systemPrompt: 'Tu es un expert en analyse business au Gabon. Réponds UNIQUEMENT en JSON valide.',
      temperature: 0.7
    });

    console.log(`✅ Gemini: Analyse JSON reçue`);
    
    return {
      text: JSON.stringify(structured),
      structured,
      usage: { total_tokens: 0 } // Gemini ne retourne pas usage de la même façon, on ignore ou estime
    };

  } catch (error) {
    console.error('❌ Erreur Gemini (analyse):', error.message);
    
    // Log error pour monitoring si c'est une erreur de quota OpenAI (via fallback)
    if (error.message.includes('OpenAI')) {
      await checkOpenAIError(error, { 
        provider: 'gemini-fallback', 
        model: 'gpt-4o'
      });
    }
    
    throw error;
  }
}

// Helper: Appel IA pour PROPOSITIONS via Gemini 3 Pro avec JSON garanti
async function callAIPropositions(prompt, options = {}) {
  try {
    console.log('🚀 Propositions IA via Gemini 3 Pro (Primary)...');
    
    // Utiliser Gemini Service
    const structured = await geminiService.generateJSON(prompt, {
      systemPrompt: 'Tu es un expert en développement d\'affaires au Gabon. Réponds UNIQUEMENT en JSON valide.',
      temperature: 0.7
    });

    console.log(`✅ Gemini: Propositions JSON reçues`);
    
    return {
      text: JSON.stringify(structured),
      structured,
      usage: { total_tokens: 0 }
    };

  } catch (error) {
    console.error('❌ Erreur Gemini (propositions):', error.message);
    
    if (error.message.includes('OpenAI')) {
      await checkOpenAIError(error, { 
        provider: 'gemini-fallback', 
        model: 'gpt-4o'
      });
    }
    
    throw error;
  }
}

// POST /api/opportunities/analyze - Analyser une opportunité
router.post('/analyze', async (req, res) => {
  try {
    const {
      userId,
      opportunityText,
      article,
      context = '',
      usePerplexity = false
    } = req.body;

    // Accepter soit article soit opportunityText
    let textToAnalyze = opportunityText;
    let articleTitle = article?.title || '';
    let articleSummary = article?.summary || '';
    let articleSource = article?.source || null;
    let articleUrl = article?.url || null;
    let articleContent = article?.content || '';

    // Récupérer le contenu complet depuis la base si pas fourni mais URL présente
    if (!articleContent && articleUrl) {
      try {
        const { data: row, error } = await supabaseService.supabase
          .from('articles')
          .select('content, content_text, content_html')
          .eq('url', articleUrl)
          .maybeSingle();
        if (!error && row) {
          articleContent = row.content_text || stripHtml(row.content_html || '') || row.content || '';
        }
      } catch (e) {
        console.warn('⚠️ Récupération contenu article échouée:', e.message);
      }
    }

    if (!textToAnalyze && (articleTitle || articleSummary || articleContent)) {
      textToAnalyze = `TITRE: ${articleTitle}\n\nRESUME: ${articleSummary}\n\nCONTENU: ${truncate(articleContent, 3500)}`;
    }

    if (!textToAnalyze) {
      return res.status(400).json({ success: false, error: 'Article ou texte opportunité manquant' });
    }

    console.log('🔍 Analyse opportunité pour userId:', userId);

    // Validation IA : crédits internes + quota OpenAI
    const validation = await aiValidation.validateAIRequest('analyze-opportunity', userId);
    
    if (!validation.allowed) {
      const statusCode = validation.requiresLogin ? 401 : 
                        validation.requiresTopUp ? 402 : 
                        validation.isServiceIssue ? 503 : 400;
      
      return res.status(statusCode).json({
        success: false,
        error: validation.message,
        reason: validation.reason,
        requireLogin: validation.requiresLogin,
        needsTopUp: validation.requiresTopUp,
        isServiceIssue: validation.isServiceIssue,
        details: validation.details
      });
    }
    
    console.log(`✅ Validation OK - ${validation.requiredCredits} crédits requis, ${validation.userCredits} disponibles`);
    if (validation.openAIMessage) {
      console.log(`ℹ️  OpenAI Status: ${validation.openAIMessage}`);
    }

    // Vérifier le cache avant d'appeler OpenAI
    const analysisCache = require('../services/analysis-cache');
    // V2 pour invalider le cache précédent et forcer la régénération avec la nouvelle structure
    const CACHE_SERVICE_NAME = 'analyze-opportunity-v2';
    const cachedResult = await analysisCache.getCachedAnalysis(textToAnalyze, CACHE_SERVICE_NAME);
    
    // Validation stricte du cache : doit contenir la nouvelle structure complète
    if (cachedResult && 
        cachedResult.analyse_contextuelle && 
        cachedResult.analyse_contextuelle.problematique_centrale && 
        cachedResult.secteurs_opportunites && 
        cachedResult.secteurs_opportunites.length > 0) {
      console.log('✨ Analyse récupérée du cache (structure valide) - Coût économisé!');
      
      // Retourner le résultat du cache sans consommer de crédits ni budget OpenAI
      return res.json({
        success: true,
        ...cachedResult,
        fromCache: true,
        cacheSource: cachedResult._cacheSource,
        similarity: cachedResult._similarity
      });
    } else if (cachedResult) {
      console.log('⚠️ Cache trouvé mais structure obsolète/invalide - Régénération requise');
    }

    // Construire prompt d'analyse avec contrainte JSON stricte (titres, résumé, contenu)
    const prompt = `
Tu es un expert en analyse business au Gabon. Analyse l'article ci-dessous et retourne STRICTEMENT du JSON valide.

DONNEES:
${textToAnalyze}
${context ? `\nCONTEXTE: ${context}` : ''}

INSTRUCTIONS IMPORTANTES:
- Identifie EXACTEMENT 3 secteurs d'opportunités différents et complémentaires
- Chaque secteur doit avoir un score_potentiel entre 6 et 10
- Les secteurs doivent être adaptés au contexte gabonais

CONTRAINTE DE SORTIE (JSON UNIQUEMENT, SANS TEXTE HORS JSON):
{
  "analyse_contextuelle": {
    "problematique_centrale": string, // 1 phrase claire du problème/opportunité
    "tendances_macro": string[],
    "analyse_swot": {
      "forces": string[],
      "faiblesses": string[]
    }
  },
  "secteurs_opportunites": [
    { "nom": string, "description": string, "score_potentiel": number },
    { "nom": string, "description": string, "score_potentiel": number },
    { "nom": string, "description": string, "score_potentiel": number }
  ]
}
`;

    // Appel AI pour ANALYSE
    const aiResult = await callAIAnalysis(prompt);
    const { text, structured, usage } = aiResult;

    // Construire result structuré (mode démo: structured déjà prêt; mode réel: parser text)
    let parsed = structured || parseStructuredOrNull(text);

    // Validation stricte du résultat IA et correction si nécessaire
    if (parsed) {
      if (!parsed.analyse_contextuelle) parsed.analyse_contextuelle = {};
      if (!parsed.secteurs_opportunites) parsed.secteurs_opportunites = [];
      
      // S'assurer que problematique_centrale existe
      if (!parsed.analyse_contextuelle.problematique_centrale) {
        console.warn('⚠️ problematique_centrale manquante dans la réponse IA, ajout par défaut');
        parsed.analyse_contextuelle.problematique_centrale = articleSummary || articleTitle || "Analyse des opportunités d'affaires au Gabon";
      }

      // S'assurer que analyse_swot existe
      if (!parsed.analyse_contextuelle.analyse_swot) {
        parsed.analyse_contextuelle.analyse_swot = { forces: [], faiblesses: [] };
      }
    } else {
      console.warn('⚠️ Parsing IA échoué, utilisation du fallback');
      // parsed reste null, on utilisera generateFallbackAnalysis plus bas
    }

    // Construire ligne compatible avec schéma existant
    articleTitle = articleTitle || (textToAnalyze?.split('\n')?.[0] || '').slice(0, 150) || null;
    articleSummary = articleSummary || null;
    articleSource = articleSource || null;
    articleUrl = articleUrl || null;
    const analysisData = parsed ? parsed : { markdown: text };

    let savedId = null;
    try {
      const { data: saved, error: saveErr } = await supabaseService.supabase
        .from('opportunity_analyses')
        .insert([{
          user_id: userId || null,
          article_title: articleTitle,
          article_summary: articleSummary,
          article_source: articleSource,
          article_url: articleUrl,
          opportunity_title: articleTitle,
          opportunity_description: articleSummary || (typeof text === 'string' ? text.slice(0, 280) : null),
          analysis_data: analysisData,
          status: 'done',
          enrichment_level: null,
          is_premium: false,
          views_count: 0
        }])
        .select('id')
        .single();
      if (!saveErr) savedId = saved?.id || null;
      else console.warn('⚠️ Sauvegarde opportunity_analyses échouée:', saveErr.message);
    } catch (e) {
      console.warn('⚠️ Sauvegarde opportunity_analyses non disponible:', e.message);
    }

    console.log('✅ Analyse opportunité terminée, ID:', savedId);

    // Enregistrer le succès: déduction crédits + tracking OpenAI
    const quotaManager = require('../services/openai-quota-manager');
    const quotaRecord = quotaManager.recordSuccessfulRequest('analyze-opportunity');
    const deductionResult = await aiValidation.deductCredits(userId, 'analyze-opportunity');
    
    if (deductionResult.success) {
      console.log(`💰 ${deductionResult.deducted} crédits déduits - Solde restant: ${deductionResult.newBalance}`);
      console.log(`📊 Budget OpenAI: ${quotaRecord.percentageUsed}% utilisé (coût: $${quotaRecord.cost.toFixed(4)})`);
    }
    
    // Sauvegarder dans le cache pour réutilisation future (avec nouveau nom de service)
    await analysisCache.saveToCache(
      textToAnalyze,
      parsed || { markdown: text },
      CACHE_SERVICE_NAME,
      { userId, articleUrl, articleSource }
    );

    // Réponse toujours structurée si possible
    if (parsed) {
      return res.json({ success: true, analysisId: savedId, ...parsed, usage });
    }
    // Fallback structuré proche Netlify
    const fallback = generateFallbackAnalysis({ title: articleTitle || '', summary: articleSummary || '', source: articleSource || '' });
    return res.json({ success: true, analysisId: savedId, ...fallback, usage });

  } catch (error) {
    console.error('❌ Erreur analyze opportunity:', error);
    
    // Enregistrer l'erreur OpenAI pour monitoring
    const quotaManager = require('../services/openai-quota-manager');
    quotaManager.recordError('analyze-opportunity', error);
    
    // Déterminer le message d'erreur approprié
    let errorMessage = error.message || 'Erreur lors de l\'analyse';
    let statusCode = 500;
    
    if (error.message && error.message.includes('quota')) {
      errorMessage = 'Service IA temporairement indisponible (quota dépassé). Réessayez plus tard.';
      statusCode = 503;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      isQuotaError: error.message && error.message.includes('quota')
    });
  }
});

// OPTIONS /api/opportunities/generate-proposals - CORS preflight
router.options('/generate-proposals', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

// POST /api/opportunities/generate-proposals - Générer propositions de projets (Netlify compatible)
router.post('/generate-proposals', async (req, res) => {
  try {
    const {
      userId,
      secteur,
      budget,
      problematique,
      userContext,
      article
    } = req.body;

    console.log('🚀 Génération propositions pour secteur:', secteur, 'budget:', budget);

    // Vérifier et déduire les crédits (5 crédits pour génération propositions)
    const REQUIRED_CREDITS = 5;
    
    if (userId) {
      try {
        const supabaseService = require('../supabase-config');
        const { data: creditResult, error: creditError } = await supabaseService.supabase
          .rpc('consume_credits', {
            p_user_id: userId,
            p_amount: REQUIRED_CREDITS,
            p_service_name: 'generate_proposals',
            p_description: `Génération propositions - Secteur: ${secteur}`,
            p_reference_id: null,
            p_metadata: { secteur, budget }
          });

        if (creditError || !creditResult?.success) {
          console.error('❌ Erreur déduction crédits:', creditError || creditResult?.error);
          return res.status(400).json({
            success: false,
            error: creditResult?.error || 'Crédits insuffisants pour générer des propositions',
            credits_required: REQUIRED_CREDITS
          });
        }
        console.log(`💰 ${REQUIRED_CREDITS} crédits déduits - Solde: ${creditResult.total_balance}`);
      } catch (creditErr) {
        console.error('❌ Erreur système crédits:', creditErr);
        // Continuer sans bloquer si erreur système crédits
      }
    }

    if (!secteur || !budget || !problematique) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants: secteur, budget, problematique' });
    }

    // Adapter le prompt selon le budget (logique Netlify)
    const budgetInfo = budget ? `
**BUDGET DISPONIBLE :** ${budget}
IMPORTANT: Adaptez absolument toutes les idées à ce budget spécifique.
${budget.includes('50,000') || budget.includes('100,000') || budget.includes('200,000') ? 
  'BUDGET TRÈS SERRÉ - Proposez uniquement des idées nécessitant un investissement minimal (services, digital, compétences).' : 
  budget.includes('500,000') || budget.includes('1,000,000') ? 
  'BUDGET MODÉRÉ - Privilégiez les idées avec investissement équipement léger ou stock minimal.' :
  'BUDGET PLUS ÉLEVÉ - Vous pouvez inclure des idées nécessitant équipement ou local.'
}` : '';

    const articleInfo = article ? `
ARTICLE DE RÉFÉRENCE:
- Titre: ${article.title || ''}
- Source: ${article.source || ''}
- Résumé: ${article.summary || ''}
` : '';

    const userInfo = userContext ? `
PROFIL UTILISATEUR:
- Situation: ${userContext.situation || ''}
- Compétences: ${(userContext.competences || []).join(', ')}
- Disponibilité: ${userContext.disponibilite || ''}
- Objectif délai: ${userContext.objectif_delai || ''}
- Expérience entrepreneuriale: ${userContext.experience_entrepreneuriale || ''}
- Contraintes: ${userContext.contraintes || ''}
` : '';

    const prompt = `Tu es un expert en developpement d'affaires au Gabon.
${budgetInfo}
${articleInfo}
${userInfo}

CONTEXTE GÉNÉRAL:
- Secteur d'activite: ${secteur}
- Budget de demarrage: ${budget}
- Problematique identifiee: ${problematique}

MISSION: Genere exactement 3 propositions de projets business concrets et adaptés au profil utilisateur et à l'article de référence si fourni.

Reponds en JSON strict:
{
  "propositions": [
    {
      "titre": "Nom du projet",
      "description": "Description detaillee du projet (150-200 mots)",
      "premiers_investissements": [
        "Équipement ou ressource 1",
        "Équipement ou ressource 2",
        "Équipement ou ressource 3"
      ],
      "delai_lancement": "Delai de lancement estime",
      "avantages": [
        "Avantage 1",
        "Avantage 2",
        "Avantage 3"
      ],
      "defis": [
        "Defi 1",
        "Defi 2"
      ],
      "score_faisabilite": 85
    }
  ]
}

RÈGLES STRICTES:
- premiers_investissements DOIT être un ARRAY de strings (3-5 éléments)
- NE PAS inclure de prix, montants ou chiffres dans premiers_investissements
- Chaque élément doit être une description courte (ex: "Ordinateur portable", "Logiciel de gestion", "Formation initiale")

CONCENTREZ-VOUS SUR:
- Idées strictement réalisables avec le budget spécifié
- Adapter aux compétences, à la disponibilité et à l'expérience de l'utilisateur
- Si des contraintes sont présentes, proposer des alternatives compatibles
- Référencer implicitement le contexte de l'article (marché gabonais, acteurs, enjeux)
- Évitez toute prévision de rentabilité, revenus ou prix

IMPORTANT: Reponds UNIQUEMENT avec le JSON demande.`;

    const aiResult = await callAIPropositions(prompt);
    const { text, structured, usage } = aiResult;

    // Parser JSON
    let parsed = structured || parseStructuredOrNull(text);
    
    if (!parsed || !parsed.propositions) {
      // Fallback: essayer d'extraire les propositions
      const match = text.match(/\{[\s\S]*"propositions"[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e) {
          console.warn('⚠️ Parsing JSON échoué, retour erreur');
          return res.status(500).json({ success: false, error: 'Format de réponse AI invalide' });
        }
      } else {
        return res.status(500).json({ success: false, error: 'Aucune proposition générée' });
      }
    }

    console.log('✅ Propositions générées:', parsed.propositions?.length || 0);

    res.json({
      success: true,
      ...parsed,
      usage
    });

  } catch (error) {
    console.error('❌ Erreur generate-proposals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/opportunities/generate-by-budget - Générer idées par budget
router.post('/generate-by-budget', async (req, res) => {
  try {
    const {
      userId,
      budget,
      sector = 'tous',
      interests = []
    } = req.body;

    if (!budget) {
      return res.status(400).json({ success: false, error: 'Budget manquant' });
    }

    const prompt = `
Génère 5 idées d'opportunités business concrètes au Gabon avec un budget de ${budget} FCFA.

${sector !== 'tous' ? `Secteur: ${sector}` : ''}
${interests.length > 0 ? `Intérêts: ${interests.join(', ')}` : ''}

Pour chaque idée, fournis:
- Titre accrocheur
- Description (2-3 phrases)
- Investissement initial estimé
- Potentiel de rentabilité (court/moyen/long terme)
- Premiers pas concrets

Format: JSON array avec structure {title, description, investment, profitability, nextSteps}
`;

    const { text, usage } = await callAIPropositions(prompt);

    // Parser JSON
    let ideas = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        ideas = JSON.parse(match[0]);
      }
    } catch (e) {
      // Fallback: retourner texte brut
      ideas = [{ title: 'Résultat', description: text }];
    }

    // Sauvegarder (graceful si table absente)
    try {
      await supabaseService.supabase
        .from('opportunity_generations')
        .insert([{ user_id: userId || null, budget, sector, interests, ideas, status: 'done' }]);
    } catch (e) {
      console.warn('⚠️ Table opportunity_generations indisponible, retour sans persistence:', e.message);
    }

    res.json({
      success: true,
      generationId: null,
      ideas,
      usage
    });

  } catch (error) {
    console.error('❌ Erreur generate-by-budget:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/opportunities/enhance - Enrichir une opportunité
router.post('/enhance', async (req, res) => {
  try {
    let {
      userId,
      opportunityId,
      enhancementType,
      enrichmentLevel,
      opportunityText
    } = req.body;

    // Compat frontend: map enrichmentLevel -> enhancementType
    if (!enhancementType && enrichmentLevel) {
      const lvl = String(enrichmentLevel).toLowerCase();
      if (lvl === 'basic') enhancementType = 'market_analysis';
      else if (lvl === 'premium') enhancementType = 'financial_plan';
      else if (lvl === 'full' || lvl === 'advanced') enhancementType = 'action_plan';
    }
    if (!enhancementType) enhancementType = 'market_analysis';

    let opp = null;
    if (opportunityId) {
      const fetched = await supabaseService.supabase
        .from('opportunity_analyses')
        .select('*')
        .eq('id', opportunityId)
        .single();
      opp = fetched?.data || null;
    }
    const baseTextInput = opportunityText || opp?.opportunity_description || opp?.article_summary || opp?.opportunity_title || opp?.article_title || '';
    if (!baseTextInput) {
      return res.status(400).json({ success: false, error: 'Aucun texte source pour l\'enrichissement (opportunityText manquant et opportunité introuvable)' });
    }

    const prompts = {
      market_analysis: `Analyse le marché gabonais pour cette opportunité:\n\n${baseTextInput}\n\nFournis: taille du marché, concurrence, tendances, segments cibles.`,
      financial_plan: `Crée un plan financier simplifié pour:\n\n${baseTextInput}\n\nInclus: coûts démarrage, revenus projetés (3 ans), seuil rentabilité.`,
      action_plan: `Crée un plan d'action détaillé (6 mois) pour:\n\n${baseTextInput}\n\nÉtapes concrètes, deadlines, ressources nécessaires.`
    };

    const prompt = prompts[enhancementType] || prompts.market_analysis;
    const { text, usage } = await callAIAnalysis(prompt);

    // Écrire dans colonnes existantes
    if (opp && enhancementType === 'market_analysis') {
      await supabaseService.supabase
        .from('opportunity_analyses')
        .update({ market_research: { content: text, updated_at: new Date().toISOString() }, enrichment_status: 'partially_completed' })
        .eq('id', opportunityId);
    } else if (opp && enhancementType === 'financial_plan') {
      await supabaseService.supabase
        .from('opportunity_analyses')
        .update({ enrichment_data: { financial_plan: text, updated_at: new Date().toISOString() }, enrichment_status: 'partially_completed' })
        .eq('id', opportunityId);
    } else if (opp && enhancementType === 'action_plan') {
      await supabaseService.supabase
        .from('opportunity_analyses')
        .update({ enrichment_data: { action_plan: text, updated_at: new Date().toISOString() }, enrichment_status: 'completed' })
        .eq('id', opportunityId);
    } else if (opp) {
      await supabaseService.supabase
        .from('opportunity_analyses')
        .update({ enrichment_data: { note: text, updated_at: new Date().toISOString() } })
        .eq('id', opportunityId);
    }

    res.json({
      success: true,
      enhancementType,
      result: text,
      usage
    });

  } catch (error) {
    console.error('❌ Erreur enhance opportunity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/opportunities/business-ideas - Générer idées d'affaires
router.post('/business-ideas', async (req, res) => {
  try {
    const {
      userId,
      keywords = [],
      count = 5
    } = req.body;

    const keywordsText = keywords.length > 0 
      ? `Mots-clés/domaines: ${keywords.join(', ')}`
      : 'Domaines variés';

    const prompt = `
Génère ${count} idées d'affaires innovantes et réalistes pour le Gabon.
${keywordsText}

Pour chaque idée:
- Titre percutant
- Description concise (2 phrases)
- Pourquoi maintenant au Gabon?
- Quick win (action rapide)

Format: JSON array {title, description, why_now, quick_win}
`;

    const { text, usage } = await callAIPropositions(prompt);

    // Parser
    let ideas = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        ideas = JSON.parse(match[0]);
      }
    } catch (e) {
      ideas = [{ title: 'Résultat', description: text }];
    }

    res.json({
      success: true,
      ideas,
      usage
    });

  } catch (error) {
    console.error('❌ Erreur business-ideas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
