const { createClient } = require('@supabase/supabase-js');

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
        extraRules.push("- Tu peux inclure 0–2 courtes citations directes, attribuées sobrement, uniquement si elles sont présentes et pertinentes.");
      }
      return [
        'Agis comme un rédacteur en chef gabonais expérimenté. Écris en français clair, rigoureux et conforme aux usages de la presse gabonaise (neutralité par défaut, attribution sobre des sources).',
        `Objectif: À partir de la sélection fournie, produire UN SEUL résumé journalistique en 2 à 4 paragraphes, ≤${maxWords} mots au total. Respecte strictement le contexte et/ou le ton s’ils sont indiqués.`,
        'Contraintes & règles:',
        "- N'utilise QUE les informations présentes. Aucune spéculation.",
        "- Croise les informations; en cas de divergences, signale-les sobrement (\"selon [source]\", \"[source] avance que...\").",
        "- Pas de listes à puces, pas d’emoji, pas de métadiscours.",
        "- Noms, chiffres et dates cohérents; attribution discrète quand pertinent.",
        ...extraRules,
        'Sortie attendue: texte continu prêt à publier, en 2–4 paragraphes, sans titre ni labels.',
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
        'Sortie attendue (sections titrées, 1–2 paragraphes chacune):',
        ...chosenSections.map((s, idx) => {
          if (s === 'Faits') return `${idx + 1}) Faits — consensus, résultats robustes, chiffres clés (attributions discrètes)`;
          if (s === 'Bibliographie') return `${idx + 1}) Bibliographie — 3 à 6 références tirées UNIQUEMENT des documents fournis; format ${bStyle}.`;
          return `${idx + 1}) ${s}`;
        })
      ];
      return [
        'Agis comme un chercheur senior (HDR) expert en synthèses rapides. Style: académique clair, neutre et rigoureux.',
        'Objectif: Produire UNE Synthèse de recherche structurée (≤600 mots) uniquement à partir des documents fournis.',
        'Contraintes & règles:',
        '- Uniquement les informations fournies. Zéro spéculation.',
        '- Triangulation et attribution précises (ex.: (Source, AAAA) ou selon [institution], AAAA).',
        '- Mentionne les limites méthodologiques et les zones d’accord/désaccord.',
        '- Longueur totale, bibliographie incluse: ≤600 mots. Pas de méta-commentaires.',
        ...sectionsLines,
        '',
        base
      ].join('\n');
    }
    case 'fiche_actualites': {
      const bulletsDepth = (fiche.bulletsDepth === 'Détaillée') ? '6–10' : '4–6';
      const includeTimeline = fiche.includeTimeline !== false; // true by défaut
      const highlightActors = !!fiche.highlightActors;
      const sections = [
        'Contexte',
        `Faits (${bulletsDepth} puces)`,
        ...(includeTimeline ? ['Chronologie (3–10 étapes datées AAAA-MM-JJ : événement — source)'] : []),
        'Acteurs (4–10 puces: acteur — rôle/position)',
        'Impacts (1–2 courts paragraphes)',
        'À suivre (3–6 puces: prochaines étapes/points de vigilance).'
      ];
      const extra = highlightActors ? [
        "- Dans la section 'Acteurs', mets les acteurs en avant (ex.: nom en gras) lorsque pertinent."
      ] : [];
      return [
        'Agis comme un rédacteur web de fiches d’actualités. Style: concis, lisible, factuel.',
        "Objectif: À partir des articles fournis, produire UNE fiche structurée et prête à l’emploi.",
        'Contraintes & règles:',
        "- Utilise UNIQUEMENT les informations présentes; attribution sobre (selon [source], [date]).",
        '- Harmonise noms/dates/chiffres; signale les désaccords sans trancher.',
        "- Style web: phrases courtes; pas d’emoji, pas de métadiscours.",
        ...extra,
        "Sortie attendue (sections dans l’ordre):",
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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const PPLX_API_KEY = process.env.PPLX_API_KEY || process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const {
      userId,
      serviceType = 'resume_journalistique',
      articleIds = [],
      context = '',
      tone = '',
      options = {},
      usePerplexity = false
    } = JSON.parse(event.body || '{}');

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Aucun article sélectionné' }) };
    }

    const service = SERVICE_PRICING[serviceType] || SERVICE_PRICING.resume_journalistique;
    const extraCredits = usePerplexity ? 1 : 0; // surcoût éventuel (x10 plus bas)
    const requiredCredits = (service.credits + extraCredits) * 10;

    // Préparer récupération des articles
    const { data: articles, error: artErr } = await supabase
      .from('articles')
      .select('id,title,summary,content,source,published_at,url')
      .in('id', articleIds);

    if (artErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: artErr.message }) };
    }
    if (!articles || articles.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Articles introuvables' }) };
    }

    // Concaténer un texte source propre et limité
    const joined = articles.map(a => {
      const date = a.published_at ? new Date(a.published_at).toISOString().split('T')[0] : '';
      return `- ${a.title} (${a.source || 'Source inconnue'}${date ? ', ' + date : ''})\nRésumé: ${a.summary || ''}\nContenu: ${(a.content || '').slice(0, 4000)}\nLien: ${a.url || ''}`;
    }).join('\n\n');
    const articlesText = joined.slice(0, 12000); // garde-fou

    // Optionnel: suggestions similaires via Perplexity (fallback supabase)
    let related = [];
    if (usePerplexity) {
      // Essayer Perplexity si une clé est configurée
      if (PPLX_API_KEY) {
        try {
          const summaryContext = articles
            .slice(0, 5)
            .map(a => `- ${a.title} (${a.source || 'Source inconnue'}) \n${(a.summary || a.content || '').slice(0, 300)}`)
            .join('\n');

          const pResp = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PPLX_API_KEY}`,
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
          // ignore: fallback supabase en dessous
        }
      }

      // Fallback Supabase si Perplexity non configuré ou sans résultat
      if (!related || related.length === 0) {
        try {
          const mainSource = articles[0]?.source || null;
          if (mainSource) {
            const { data: rel } = await supabase
              .from('articles')
              .select('id,title,source,url')
              .eq('source', mainSource)
              .order('created_at', { ascending: false })
              .limit(5);
            related = rel || [];
          }
        } catch {}
      }
    }

    // Vérifier crédits via credit-manager
    let hasCredits = true;
    let balance = null;
    if (userId) {
      const origin = event.headers.host ? `https://${event.headers.host}` : '';
      try {
        const resp = await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_balance', userId, requiredCredits })
        });
        const chk = await resp.json();
        hasCredits = chk.hasCredits !== false;
        balance = chk.balance ?? null;
      } catch (e) {
        // si échec, on tente quand même (mode tolérant)
        hasCredits = true;
      }
    }

    if (!hasCredits) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, needsTopUp: true, requiredCredits, balance }) };
    }

    // Appel OpenAI
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'OPENAI_API_KEY manquant' }) };
    }

    const prompt = buildPrompt(serviceType, articlesText, context, tone, options);

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: data?.error?.message || 'OpenAI error' }) };
    }

    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, model: 'gpt-4o-mini' };

    // Enregistrer la requête/résultat
    const { data: saved, error: saveErr } = await supabase
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

    // Consommer les crédits
    if (userId) {
      const origin = event.headers.host ? `https://${event.headers.host}` : '';
      try {
        await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'consume_credits',
            userId,
            serviceName: `actu_plus:${serviceType}`,
            amount: requiredCredits,
            referenceId,
            openaiUsage: {
              model: 'gpt-4o-mini',
              prompt_tokens: usage.prompt_tokens || 0,
              completion_tokens: usage.completion_tokens || 0,
              total_tokens: usage.total_tokens || 0
            }
          })
        });
      } catch (e) {
        // ne bloque pas la réponse utilisateur
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        referenceId,
        service: { key: serviceType, label: service.label, credits: requiredCredits },
        usage,
        result: { text, related }
      })
    };
  } catch (error) {
    console.error('actu-plus error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal server error' }) };
  }
};
