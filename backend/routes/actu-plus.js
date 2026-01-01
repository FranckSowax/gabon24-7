/**
 * 📰 ROUTES ACTU++ - Migration depuis Netlify
 * Service de résumés journalistiques intelligents
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');

// Helper: Extraire les mots-clés importants (copié depuis related-articles.js)
function extractKeywords(title, description, category) {
  const text = `${title || ''} ${description || ''} ${category || ''}`.toLowerCase();

  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
    'et', 'ou', 'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'plus',
    'ce', 'cette', 'ces', 'mon', 'ton', 'son', 'notre', 'votre', 'leur',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'est', 'sont', 'sera', 'être', 'avoir', 'fait', 'faire',
    'article', 'articles', 'gabon', 'gabonais', 'gabonaise'
  ]);

  const words = text
    .replace(/[^\w\sàâäéèêëïîôùûüÿç]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word));

  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  if (category) {
    sortedWords.unshift(category.toLowerCase());
  }

  return [...new Set(sortedWords)];
}

// Helper: Calculer score de pertinence pour articles liés
function calculateRelevanceScore(article, keywords, sourceArticles) {
  let score = 0;

  const articleText = `
    ${article.title || ''}
    ${article.summary || ''}
    ${article.summary_ai || ''}
    ${(article.keywords || []).join(' ')}
  `.toLowerCase();

  // Score élevé pour les mots-clés dans le titre
  keywords.forEach(keyword => {
    if (article.title && article.title.toLowerCase().includes(keyword)) {
      score += 10;
    }
  });

  // Score pour les mots-clés dans le contenu
  keywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = articleText.match(regex);
    if (matches) {
      score += matches.length * 3;
    }
  });

  // Bonus si l'article a des keywords qui matchent
  if (article.keywords && Array.isArray(article.keywords)) {
    keywords.forEach(keyword => {
      if (article.keywords.some(k => k.toLowerCase().includes(keyword))) {
        score += 6;
      }
    });
  }

  // Bonus pour catégorie similaire
  const sourceCategories = sourceArticles.map(a => a.category).filter(Boolean);
  if (article.category && sourceCategories.includes(article.category)) {
    score += 8;
  }

  // Bonus pour sentiment positif ou neutre
  if (article.sentiment_score > 0.3) {
    score += 3;
  } else if (article.sentiment_score > -0.3) {
    score += 1;
  }

  // Bonus pour articles importants
  if (article.importance >= 4) {
    score += 5;
  } else if (article.importance >= 3) {
    score += 3;
  }

  // Bonus pour articles récents
  const daysSincePublished = (Date.now() - new Date(article.published_at)) / (1000 * 60 * 60 * 24);
  if (daysSincePublished <= 7) {
    score += 5;
  } else if (daysSincePublished <= 30) {
    score += 3;
  }

  return score;
}

// Helper: Rechercher des articles similaires avec colonnes enrichies
async function findRelatedArticles(sourceArticles, excludeIds, limit = 5) {
  // Extraire mots-clés des articles sources
  const combinedText = sourceArticles
    .map(a => `${a.title || ''} ${a.summary || ''}`)
    .join(' ');
  const categories = [...new Set(sourceArticles.map(a => a.category).filter(Boolean))];
  const keywords = extractKeywords(combinedText, '', categories[0] || '');

  if (keywords.length === 0) {
    // Fallback: articles récents
    const { data: recent } = await supabaseService.supabase
      .from('articles')
      .select('id,title,source,url,category,keywords,summary_ai,importance,sentiment_score,published_at')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);
    return recent || [];
  }

  let allArticles = [];

  // Recherche par titre (top 3 mots-clés)
  for (const keyword of keywords.slice(0, 3)) {
    const { data: titleMatches } = await supabaseService.supabase
      .from('articles')
      .select('id,title,source,url,category,keywords,summary_ai,importance,sentiment_score,published_at')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .eq('is_published', true)
      .ilike('title', `%${keyword}%`)
      .order('published_at', { ascending: false })
      .limit(15);
    if (titleMatches) allArticles.push(...titleMatches);
  }

  // Recherche par keywords array
  for (const keyword of keywords.slice(0, 3)) {
    const { data: keywordMatches } = await supabaseService.supabase
      .from('articles')
      .select('id,title,source,url,category,keywords,summary_ai,importance,sentiment_score,published_at')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .eq('is_published', true)
      .contains('keywords', [keyword])
      .order('published_at', { ascending: false })
      .limit(10);
    if (keywordMatches) allArticles.push(...keywordMatches);
  }

  // Recherche par summary_ai
  for (const keyword of keywords.slice(0, 2)) {
    const { data: summaryMatches } = await supabaseService.supabase
      .from('articles')
      .select('id,title,source,url,category,keywords,summary_ai,importance,sentiment_score,published_at')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .eq('is_published', true)
      .ilike('summary_ai', `%${keyword}%`)
      .order('published_at', { ascending: false })
      .limit(10);
    if (summaryMatches) allArticles.push(...summaryMatches);
  }

  // Recherche par catégorie similaire
  if (categories.length > 0) {
    const { data: categoryMatches } = await supabaseService.supabase
      .from('articles')
      .select('id,title,source,url,category,keywords,summary_ai,importance,sentiment_score,published_at')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .eq('is_published', true)
      .in('category', categories)
      .order('importance', { ascending: false })
      .limit(10);
    if (categoryMatches) allArticles.push(...categoryMatches);
  }

  // Dédupliquer par ID
  const uniqueArticles = Array.from(
    new Map(allArticles.map(article => [article.id, article])).values()
  );

  // Scorer et trier
  const scoredArticles = uniqueArticles.map(article => ({
    ...article,
    relevanceScore: calculateRelevanceScore(article, keywords, sourceArticles)
  }));

  return scoredArticles
    .filter(a => a.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

// Helper: build prompts by service type
function buildPrompt(serviceType, articlesText, context = '', tone = '', options = {}) {
  const { toneList = [], resume = {}, synthese = {}, fiche = {} } = options || {};
  const toneCombo = Array.isArray(toneList) && toneList.length
    ? (tone ? `${tone}; ${toneList.join(', ')}` : toneList.join(', '))
    : tone;
  const toneLine = toneCombo ? `\nTon/Style souhaité: ${toneCombo}` : '';
  const ctxLine = context ? `\nContexte supplémentaire: ${context}` : '';
  const base = `Contenu source (multi-articles):\n${articlesText}${ctxLine}${toneLine}`;

  switch (serviceType) {
    case 'resume_journalistique': {
      const maxWords = parseInt(resume.length, 10) || 300;
      const extraRules = [];
      if (resume.includeQuotes) {
        extraRules.push("- Tu peux inclure 0-2 courtes citations directes, attribuées sobrement, uniquement si elles sont présentes et pertinentes.");
      }
      return [
        'Agis comme un rédacteur en chef gabonais expérimenté. Écris en français clair, rigoureux et conforme aux usages de la presse gabonaise (neutralité par défaut, attribution sobre des sources).',
        `Objectif: À partir de la sélection fournie, produire UN SEUL résumé journalistique en 2 à 4 paragraphes, max ${maxWords} mots au total. Respecte strictement le contexte et/ou le ton s ils sont indiqués.`,
        'Contraintes et règles:',
        "- N utilise QUE les informations présentes. Aucune spéculation.",
        "- Croise les informations; en cas de divergences, signale-les sobrement (selon source, source avance que).",
        "- Pas de listes à puces, pas emoji, pas de métadiscours.",
        "- Noms, chiffres et dates cohérents; attribution discrète quand pertinent.",
        ...extraRules,
        'Sortie attendue: texte continu prêt à publier, en 2-4 paragraphes, sans titre ni labels.',
        '',
        base
      ].join('\n');
    }
    case 'synthese_recherche': {
      const chosenSections = Array.isArray(synthese.sections) && synthese.sections.length
        ? synthese.sections
        : ['Contexte', 'Faits', 'Divergences', 'Enjeux', 'Bibliographie'];
      const bStyle = synthese.biblioStyle || 'APA';
      const sectionsLines = [
        'Sortie attendue (sections titrées, 1-2 paragraphes chacune):',
        ...chosenSections.map((s, idx) => {
          if (s === 'Faits') return `${idx + 1}) Faits - consensus, résultats robustes, chiffres clés (attributions discrètes)`;
          if (s === 'Bibliographie') return `${idx + 1}) Bibliographie - 3 à 6 références tirées UNIQUEMENT des documents fournis; format ${bStyle}.`;
          return `${idx + 1}) ${s}`;
        })
      ];
      return [
        'Agis comme un chercheur senior (HDR) expert en synthèses rapides. Style: académique clair, neutre et rigoureux.',
        'Objectif: Produire UNE Synthèse de recherche structurée (max 600 mots) uniquement à partir des documents fournis.',
        'Contraintes et règles:',
        '- Uniquement les informations fournies. Zéro spéculation.',
        '- Triangulation et attribution précises (ex.: Source AAAA ou selon institution AAAA).',
        '- Mentionne les limites méthodologiques et les zones accord/désaccord.',
        '- Longueur totale bibliographie incluse: max 600 mots. Pas de méta-commentaires.',
        ...sectionsLines,
        '',
        base
      ].join('\n');
    }
    case 'fiche_actualites': {
      const bulletsDepth = (fiche.bulletsDepth === 'Détaillée') ? '6-10' : '4-6';
      const includeTimeline = fiche.includeTimeline !== false;
      const highlightActors = !!fiche.highlightActors;
      const sections = [
        'Contexte',
        `Faits (${bulletsDepth} puces)`,
        ...(includeTimeline ? ['Chronologie (3-10 étapes datées AAAA-MM-JJ : événement - source)'] : []),
        'Acteurs (4-10 puces: acteur - rôle/position)',
        'Impacts (1-2 courts paragraphes)',
        'À suivre (3-6 puces: prochaines étapes/points de vigilance).'
      ];
      const extra = highlightActors ? [
        "- Dans la section Acteurs, mets les acteurs en avant (ex.: nom en gras) lorsque pertinent."
      ] : [];
      return [
        'Agis comme un rédacteur web de fiches d actualités. Style: concis, lisible, factuel.',
        "Objectif: À partir des articles fournis, produire UNE fiche structurée et prête à l'emploi.",
        'Contraintes & règles:',
        "- Utilise UNIQUEMENT les informations présentes; attribution sobre (selon [source], [date]).",
        '- Harmonise noms/dates/chiffres; signale les désaccords sans trancher.',
        "- Style web: phrases courtes; pas d'emoji, pas de métadiscours.",
        ...extra,
        "Sortie attendue (sections dans l'ordre):",
        ...sections,
        '',
        base
      ].join('\n');
    }
    default:
      return `${base}\n\nTâche: Rédige un résumé clair et structuré (200-300 mots) en français. Format: Markdown.`;
  }
}

const SERVICE_PRICING = {
  resume_journalistique: { label: 'Résumé journalistique', credits: 2 },
  synthese_recherche: { label: 'Synthèse de recherche', credits: 3 },
  fiche_actualites: { label: "Fiche d'actualités", credits: 3 }
};

// POST /api/actu-plus - Générer un résumé intelligent
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      serviceType = 'resume_journalistique',
      articleIds = [],
      context = '',
      tone = '',
      options = {},
      usePerplexity = false
    } = req.body;

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun article sélectionné' });
    }

    const service = SERVICE_PRICING[serviceType] || SERVICE_PRICING.resume_journalistique;
    const extraCredits = usePerplexity ? 1 : 0;
    const requiredCredits = (service.credits + extraCredits) * 10;

    // Récupérer les articles (avec category pour la recherche d'articles liés)
    const { data: articles, error: artErr } = await supabaseService.supabase
      .from('articles')
      .select('id,title,summary,content,source,published_at,url,category,keywords')
      .in('id', articleIds);

    if (artErr) {
      return res.status(500).json({ success: false, error: artErr.message });
    }
    if (!articles || articles.length === 0) {
      return res.status(400).json({ success: false, error: 'Articles introuvables' });
    }

    // Concaténer texte source
    const joined = articles.map(a => {
      const date = a.published_at ? new Date(a.published_at).toISOString().split('T')[0] : '';
      return `- ${a.title} (${a.source || 'Source inconnue'}${date ? ', ' + date : ''})\nRésumé: ${a.summary || ''}\nContenu: ${(a.content || '').slice(0, 4000)}\nLien: ${a.url || ''}`;
    }).join('\n\n');
    const articlesText = joined.slice(0, 12000);

    // Articles similaires (optionnel via Perplexity)
    let related = [];
    if (usePerplexity && process.env.PPLX_API_KEY) {
      try {
        const summaryContext = articles
          .slice(0, 5)
          .map(a => `- ${a.title} (${a.source || 'Source inconnue'}) \n${(a.summary || a.content || '').slice(0, 300)}`)
          .join('\n');

        const pResp = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.PPLX_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'sonar-small-online',
            messages: [
              { role: 'system', content: 'Vous êtes un assistant de recherche web. Répondez uniquement avec un JSON valide.' },
              { role: 'user', content: `À partir de ces articles gabonais, propose 5 articles web récents et pertinents (français) étroitement liés. Retourne STRICTEMENT un tableau JSON d'objets {title, url, source}.\n\nArticles:\n${summaryContext}` }
            ],
            temperature: 0.2,
            max_tokens: 600
          })
        });

        if (pResp.ok) {
          const pJson = await pResp.json();
          const content = pJson.choices?.[0]?.message?.content || '';
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            const arr = JSON.parse(match[0]);
            if (Array.isArray(arr)) {
              related = arr
                .filter(it => it && (it.url || it.link))
                .slice(0, 5)
                .map(it => {
                  const url = it.url || it.link;
                  let source = it.source || '';
                  try { if (!source && url) source = new URL(url).hostname.replace('www.', ''); } catch {}
                  return { id: url, title: it.title || url, source, url };
                });
            }
          }
        }
      } catch (e) {
        console.error('Perplexity error:', e);
      }
    }

    // Fallback Supabase avec recherche intelligente si pas de Perplexity
    if (related.length === 0) {
      try {
        console.log('🔍 Recherche articles liés avec colonnes enrichies...');
        related = await findRelatedArticles(articles, articleIds, 5);
        console.log(`✅ ${related.length} articles liés trouvés`);
      } catch (e) {
        console.error('❌ Erreur recherche articles liés:', e);
        // Fallback minimal si erreur
        const mainSource = articles[0]?.source || null;
        if (mainSource) {
          const { data: rel } = await supabaseService.supabase
            .from('articles')
            .select('id,title,source,url')
            .eq('source', mainSource)
            .order('created_at', { ascending: false })
            .limit(5);
          related = rel || [];
        }
      }
    }

    // Vérifier crédits (TODO: implémenter credit-manager en Express)
    let hasCredits = true;
    let balance = null;

    if (!hasCredits) {
      return res.json({ success: false, needsTopUp: true, requiredCredits, balance });
    }

    // Appel OpenAI
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'OPENAI_API_KEY manquant' });
    }

    const prompt = buildPrompt(serviceType, articlesText, context, tone, options);

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es un assistant IA expert en journalisme et synthèse.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 800
      })
    });

    const data = await openaiResp.json();
    if (!openaiResp.ok) {
      return res.status(500).json({ success: false, error: data?.error?.message || 'OpenAI error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Enregistrer la requête
    const { data: saved } = await supabaseService.supabase
      .from('actu_plus_requests')
      .insert({
        user_id: userId || null,
        service_type: serviceType,
        article_ids: articleIds,
        input_context: context || null,
        tone: tone || null,
        use_perplexity: !!usePerplexity,
        status: 'done',
        result: { text, related, options },
        credits_charged: requiredCredits
      })
      .select('id')
      .single();

    const referenceId = saved?.id;

    // TODO: Consommer crédits via credit-manager Express

    res.json({
      success: true,
      referenceId,
      service: { key: serviceType, label: service.label, credits: requiredCredits },
      usage,
      result: { text, related }
    });

  } catch (error) {
    console.error('❌ Erreur actu-plus:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/actu-plus/save - Enregistrer le livrable
router.post('/save', async (req, res) => {
  try {
    const { userId, title, content, referenceId, service } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ success: false, error: 'Données manquantes' });
    }

    console.log('💾 Sauvegarde livrable Actu++:', title);

    // Créer un projet sauvegardé pour ce livrable
    const { data, error } = await supabaseService.supabase
      .from('saved_projects')
      .insert({
        user_id: userId,
        // Champs factices pour respecter le schéma saved_projects
        article_title: title || 'Livrable Actu++',
        article_summary: content.substring(0, 200) + '...',
        article_url: '',
        problematique_centrale: 'Veille et Analyse Actualités',
        secteur_principal: 'Médias & Veille',
        secteur_selectionne: 'Médias',
        budget_selectionne: 'N/A',
        proposition_titre: title || 'Livrable Actu++',
        proposition_description: content,
        proposition_investissement: '0',
        proposition_rentabilite: 'N/A',
        proposition_revenus_mensuels: '0',
        proposition_actions_immediates: [],
        proposition_avantages_concurrentiels: [],
        proposition_score_faisabilite: 100,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur sauvegarde Actu++:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log('✅ Livrable sauvegardé comme projet:', data.id);
    res.json({ success: true, projectId: data.id });

  } catch (error) {
    console.error('❌ Erreur endpoint save:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
