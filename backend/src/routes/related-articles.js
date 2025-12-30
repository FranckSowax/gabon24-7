const express = require('express');
const supabaseService = require('../../supabase-config');
const router = express.Router();

const { supabase } = supabaseService;

// Rechercher des articles connexes basés sur le projet
router.post('/search', async (req, res) => {
  try {
    const { projectTitle, projectDescription, secteur, limit = 5 } = req.body;

    if (!projectTitle && !projectDescription) {
      return res.status(400).json({
        success: false,
        error: 'Titre ou description du projet requis'
      });
    }

    console.log('🔍 Recherche d\'articles connexes...');
    console.log('   Projet:', projectTitle);
    console.log('   Secteur:', secteur);

    // Extraire les mots-clés importants
    const keywords = extractKeywords(projectTitle, projectDescription, secteur);
    console.log('   Mots-clés:', keywords.join(', '));

    // Si pas de mots-clés, retourner articles récents du secteur
    if (keywords.length === 0) {
      console.log('⚠️  Aucun mot-clé extrait, retour articles récents');
      const { data: recentArticles, error: recentError } = await supabase
        .from('articles')
        .select(`
          id, title, summary, content, url, image_urls, source,
          published_at, category, sentiment, ai_summary, keywords,
          reading_time_minutes, view_count
        `)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (recentError) {
        console.error('❌ Erreur articles récents:', recentError);
        return res.status(500).json({ success: false, error: 'Erreur recherche' });
      }

      return res.json({
        success: true,
        articles: (recentArticles || []).map(a => ({ ...a, relevanceScore: 1 })),
        keywords: [],
        total: recentArticles?.length || 0
      });
    }

    // Recherche dans Supabase avec filtres sur title et keywords
    console.log('🔍 Recherche avec filtres:', keywords[0]);
    
    let allArticles = [];
    
    // Recherche par titre (ilike pour recherche insensible à la casse)
    for (const keyword of keywords.slice(0, 3)) { // Top 3 mots-clés
      const { data: titleMatches } = await supabase
        .from('articles')
        .select(`
          id, title, summary, content, url, image_urls, source,
          published_at, category, sentiment, ai_summary, keywords,
          reading_time_minutes, view_count
        `)
        .eq('is_published', true)
        .ilike('title', `%${keyword}%`)
        .order('published_at', { ascending: false })
        .limit(20);

      if (titleMatches) allArticles.push(...titleMatches);

      // Recherche par keywords si disponible
      const { data: keywordMatches } = await supabase
        .from('articles')
        .select(`
          id, title, summary, content, url, image_urls, source,
          published_at, category, sentiment, ai_summary, keywords,
          reading_time_minutes, view_count
        `)
        .eq('is_published', true)
        .contains('keywords', [keyword])
        .order('published_at', { ascending: false })
        .limit(10);

      if (keywordMatches) allArticles.push(...keywordMatches);
    }

    // Dédupliquer par ID
    const uniqueArticles = Array.from(
      new Map(allArticles.map(article => [article.id, article])).values()
    );

    console.log(`📊 ${uniqueArticles.length} articles uniques trouvés`);

    if (uniqueArticles.length === 0) {
      return res.json({
        success: true,
        articles: [],
        keywords,
        message: 'Aucun article correspondant'
      });
    }

    // Scorer et trier les articles par pertinence
    const scoredArticles = uniqueArticles.map(article => {
      const score = calculateRelevanceScore(article, keywords, projectTitle, projectDescription);
      return { ...article, relevanceScore: score };
    });

    // Trier par score et prendre les meilleurs
    const relevantArticles = scoredArticles
      .filter(a => a.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    console.log(`✅ ${relevantArticles.length} articles pertinents trouvés`);

    res.json({
      success: true,
      articles: relevantArticles,
      keywords,
      total: relevantArticles.length
    });

  } catch (error) {
    console.error('❌ Erreur endpoint related-articles:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Rechercher des articles par problématique (max 3 articles)
router.post('/search-by-problematique', async (req, res) => {
  try {
    const { problematique, secteur, projectTitle } = req.body;

    if (!problematique) {
      return res.status(400).json({
        success: false,
        error: 'Problématique requise'
      });
    }

    console.log('🔍 Recherche articles par problématique...');
    console.log('   Problématique:', problematique.substring(0, 100) + '...');
    console.log('   Secteur:', secteur);

    // Extraire les mots-clés de la problématique
    const keywords = extractKeywords(problematique, projectTitle, secteur);
    console.log('   Mots-clés extraits:', keywords.slice(0, 5).join(', '));

    if (keywords.length === 0) {
      return res.json({
        success: true,
        articles: [],
        message: 'Aucun mot-clé pertinent trouvé'
      });
    }

    let allArticles = [];

    // Recherche par titre avec les 3 meilleurs mots-clés
    for (const keyword of keywords.slice(0, 3)) {
      const { data: titleMatches } = await supabase
        .from('articles')
        .select(`
          id, title, summary, content, url, image_urls, source,
          published_at, category, sentiment, ai_summary, keywords,
          reading_time_minutes, view_count
        `)
        .eq('is_published', true)
        .ilike('title', `%${keyword}%`)
        .order('published_at', { ascending: false })
        .limit(15);

      if (titleMatches) allArticles.push(...titleMatches);
    }

    // Recherche dans le contenu/summary avec les mots-clés
    for (const keyword of keywords.slice(0, 3)) {
      const { data: contentMatches } = await supabase
        .from('articles')
        .select(`
          id, title, summary, content, url, image_urls, source,
          published_at, category, sentiment, ai_summary, keywords,
          reading_time_minutes, view_count
        `)
        .eq('is_published', true)
        .or(`summary.ilike.%${keyword}%,ai_summary.ilike.%${keyword}%`)
        .order('published_at', { ascending: false })
        .limit(10);

      if (contentMatches) allArticles.push(...contentMatches);
    }

    // Recherche par keywords array si disponible
    for (const keyword of keywords.slice(0, 3)) {
      const { data: keywordMatches } = await supabase
        .from('articles')
        .select(`
          id, title, summary, content, url, image_urls, source,
          published_at, category, sentiment, ai_summary, keywords,
          reading_time_minutes, view_count
        `)
        .eq('is_published', true)
        .contains('keywords', [keyword])
        .order('published_at', { ascending: false })
        .limit(10);

      if (keywordMatches) allArticles.push(...keywordMatches);
    }

    // Dédupliquer par ID
    const uniqueArticles = Array.from(
      new Map(allArticles.map(article => [article.id, article])).values()
    );

    console.log(`📊 ${uniqueArticles.length} articles uniques trouvés`);

    if (uniqueArticles.length === 0) {
      return res.json({
        success: true,
        articles: [],
        keywords,
        message: 'Aucun article connexe trouvé pour cette problématique'
      });
    }

    // Scorer avec la problématique
    const scoredArticles = uniqueArticles.map(article => {
      const score = calculateRelevanceScoreWithProblematique(
        article, 
        keywords, 
        problematique,
        projectTitle
      );
      return { ...article, relevanceScore: score };
    });

    // Trier par score et prendre les 3 meilleurs
    const topArticles = scoredArticles
      .filter(a => a.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    console.log(`✅ ${topArticles.length} articles pertinents sélectionnés`);
    console.log('   Scores:', topArticles.map(a => a.relevanceScore).join(', '));

    res.json({
      success: true,
      articles: topArticles,
      keywords: keywords.slice(0, 5),
      total: topArticles.length
    });

  } catch (error) {
    console.error('❌ Erreur search-by-problematique:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur'
    });
  }
});

// Ajouter un article au contexte du projet
router.post('/add-to-context', async (req, res) => {
  try {
    const { projectId, articleId, articleData } = req.body;

    if (!projectId || !articleId) {
      return res.status(400).json({
        success: false,
        error: 'projectId et articleId requis'
      });
    }

    console.log(`📎 Ajout article ${articleId} au contexte projet ${projectId}`);

    // Récupérer le projet actuel
    const { data: project, error: projectError } = await supabase
      .from('saved_projects')
      .select('cumulative_context, related_articles')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('❌ Erreur récupération projet:', projectError);
      return res.status(500).json({
        success: false,
        error: 'Projet non trouvé'
      });
    }

    // Préparer le nouveau contexte article
    const articleContext = {
      id: articleId,
      title: articleData.title,
      summary: articleData.summary || articleData.ai_summary,
      url: articleData.url,
      source: articleData.source,
      added_at: new Date().toISOString(),
      relevanceScore: articleData.relevanceScore
    };

    // Mettre à jour related_articles
    const relatedArticles = project.related_articles || [];
    
    // Vérifier si l'article n'est pas déjà ajouté
    if (relatedArticles.some(a => a.id === articleId)) {
      return res.json({
        success: true,
        message: 'Article déjà dans le contexte',
        alreadyAdded: true
      });
    }

    relatedArticles.push(articleContext);

    // Enrichir le contexte cumulatif
    const enrichedContext = `${project.cumulative_context || ''}\n\n### Article connexe: ${articleData.title}\nSource: ${articleData.source}\nRésumé: ${articleData.summary || articleData.ai_summary || 'N/A'}\n`;

    // Mettre à jour le projet
    const { error: updateError } = await supabase
      .from('saved_projects')
      .update({
        related_articles: relatedArticles,
        cumulative_context: enrichedContext.substring(0, 10000) // Limiter la taille
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('❌ Erreur mise à jour projet:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erreur mise à jour'
      });
    }

    console.log('✅ Article ajouté au contexte');

    res.json({
      success: true,
      message: 'Article ajouté au contexte du projet',
      relatedArticles: relatedArticles.length
    });

  } catch (error) {
    console.error('❌ Erreur add-to-context:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur'
    });
  }
});

// Fonction pour extraire les mots-clés importants
function extractKeywords(title, description, secteur) {
  const text = `${title || ''} ${description || ''} ${secteur || ''}`.toLowerCase();
  
  // Mots vides à ignorer
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
    'et', 'ou', 'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'plus',
    'ce', 'cette', 'ces', 'mon', 'ton', 'son', 'notre', 'votre', 'leur',
    'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
    'est', 'sont', 'sera', 'être', 'avoir', 'fait', 'faire'
  ]);

  // Extraire les mots (3 lettres minimum)
  const words = text
    .replace(/[^\w\sàâäéèêëïîôùûüÿç]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word));

  // Compter les occurrences
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Trier par fréquence et prendre les 10 meilleurs
  const sortedWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // Ajouter le secteur comme mot-clé important
  if (secteur) {
    sortedWords.unshift(secteur.toLowerCase());
  }

  return [...new Set(sortedWords)]; // Dédupliquer
}

// Fonction pour calculer le score de pertinence avec problématique
function calculateRelevanceScoreWithProblematique(article, keywords, problematique, projectTitle) {
  let score = 0;
  
  const articleText = `
    ${article.title || ''} 
    ${article.summary || ''} 
    ${article.ai_summary || ''} 
    ${article.content || ''}
    ${(article.keywords || []).join(' ')}
  `.toLowerCase();

  const problematiqueLower = problematique.toLowerCase();

  // Score élevé pour les mots-clés dans le titre (très pertinent)
  keywords.forEach(keyword => {
    if (article.title && article.title.toLowerCase().includes(keyword)) {
      score += 10; // Bonus élevé pour titre
    }
  });

  // Score pour les mots-clés dans le contenu
  keywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = articleText.match(regex);
    if (matches) {
      score += matches.length * 3; // 3 points par occurrence
    }
  });

  // Bonus si des mots de la problématique apparaissent directement
  const problematicWords = problematiqueLower
    .split(/\s+/)
    .filter(w => w.length >= 4);
  
  problematicWords.forEach(word => {
    if (articleText.includes(word)) {
      score += 5; // Bonus pour correspondance directe
    }
  });

  // Bonus si le titre du projet apparaît
  if (projectTitle) {
    const titleWords = projectTitle.toLowerCase().split(/\s+/);
    titleWords.forEach(word => {
      if (word.length >= 3 && articleText.includes(word)) {
        score += 4; // Bonus titre projet
      }
    });
  }

  // Bonus pour les catégories pertinentes
  const relevantCategories = ['économie', 'business', 'entreprise', 'innovation', 'technologie', 'startup', 'gabon', 'afrique'];
  if (article.category && relevantCategories.includes(article.category.toLowerCase())) {
    score += 8;
  }

  // Bonus pour sentiment positif ou neutre
  if (article.sentiment === 'positive') {
    score += 3;
  } else if (article.sentiment === 'neutral') {
    score += 1;
  }

  // Bonus pour articles récents (derniers 30 jours)
  const daysSincePublished = (Date.now() - new Date(article.published_at)) / (1000 * 60 * 60 * 24);
  if (daysSincePublished <= 7) {
    score += 5; // Très récent
  } else if (daysSincePublished <= 30) {
    score += 3; // Récent
  }

  // Bonus si l'article a des keywords qui matchent
  if (article.keywords && Array.isArray(article.keywords)) {
    keywords.forEach(keyword => {
      if (article.keywords.some(k => k.toLowerCase().includes(keyword))) {
        score += 6;
      }
    });
  }

  return score;
}

// Fonction pour calculer le score de pertinence (ancienne version)
function calculateRelevanceScore(article, keywords, projectTitle, projectDescription) {
  let score = 0;
  
  const articleText = `
    ${article.title || ''} 
    ${article.summary || ''} 
    ${article.ai_summary || ''} 
    ${article.content || ''}
    ${(article.keywords || []).join(' ')}
  `.toLowerCase();

  // Score basé sur les mots-clés
  keywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    const matches = articleText.match(regex);
    if (matches) {
      score += matches.length * 2; // 2 points par occurrence
    }
  });

  // Bonus si le titre du projet apparaît
  if (projectTitle) {
    const titleWords = projectTitle.toLowerCase().split(/\s+/);
    titleWords.forEach(word => {
      if (word.length >= 3 && articleText.includes(word)) {
        score += 3; // Bonus titre
      }
    });
  }

  // Bonus pour les catégories pertinentes
  const relevantCategories = ['économie', 'business', 'entreprise', 'innovation', 'technologie', 'startup'];
  if (article.category && relevantCategories.includes(article.category.toLowerCase())) {
    score += 5;
  }

  // Bonus pour sentiment positif
  if (article.sentiment === 'positive') {
    score += 2;
  }

  // Bonus pour articles récents (dernière semaine)
  const daysSincePublished = (Date.now() - new Date(article.published_at)) / (1000 * 60 * 60 * 24);
  if (daysSincePublished <= 7) {
    score += 3;
  }

  return score;
}

module.exports = router;
