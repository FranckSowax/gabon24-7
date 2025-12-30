/**
 * Service de priorisation des articles pour résumés audio
 * Analyse les sujets récurrents et utilise les scores d'enrichissement
 */

/**
 * Analyser et prioriser les articles par sujet et score
 * @param {Array} articles - Articles à analyser
 * @returns {Array} Articles triés par priorité
 */
function prioritizeArticles(articles) {
  if (!articles || articles.length === 0) return [];

  // 1. Extraire et comptabiliser les sujets
  const subjectFrequency = {};
  const articlesBySubject = {};

  articles.forEach(article => {
    // Extraire les mots-clés des différentes sources
    const keywords = extractKeywords(article);
    
    keywords.forEach(keyword => {
      if (!subjectFrequency[keyword]) {
        subjectFrequency[keyword] = 0;
        articlesBySubject[keyword] = [];
      }
      subjectFrequency[keyword]++;
      articlesBySubject[keyword].push(article);
    });
  });

  // 2. Calculer un score de priorité pour chaque article
  const articlesWithPriority = articles.map(article => {
    const keywords = extractKeywords(article);
    
    // Score de récurrence (sujets qui reviennent souvent)
    const recurrenceScore = keywords.reduce((sum, keyword) => {
      return sum + (subjectFrequency[keyword] || 0);
    }, 0) / (keywords.length || 1);

    // Score d'enrichissement (qualité de l'article)
    const enrichmentScore = (
      (article.enrichment_score || 0) * 0.3 +
      (article.relevance_score || 0) * 0.3 +
      (article.quality_score || 0) * 0.2 +
      (article.view_count || 0) / 100 * 0.2
    );

    // Score d'importance (colonne importance de la table articles)
    // Normaliser entre 0 et 1 (si importance est sur 10, diviser par 10)
    const importanceScore = (article.importance || 0) / 10;

    // Score combiné avec importance prioritaire
    const priorityScore = (
      (importanceScore * 0.4) +        // 40% importance (prioritaire)
      (recurrenceScore * 0.35) +       // 35% récurrence
      (enrichmentScore * 0.25)         // 25% enrichissement
    );

    return {
      ...article,
      priorityScore,
      recurrenceScore,
      enrichmentScore,
      importanceScore,
      keywords
    };
  });

  // 3. Trier par score de priorité décroissant
  articlesWithPriority.sort((a, b) => b.priorityScore - a.priorityScore);

  // 4. Sélectionner les articles les plus pertinents
  // Garder les 15 meilleurs pour éviter un résumé trop long
  const topArticles = articlesWithPriority.slice(0, 15);

  console.log('\n📊 Analyse de priorisation:');
  console.log(`   Total articles: ${articles.length}`);
  console.log(`   Sujets uniques: ${Object.keys(subjectFrequency).length}`);
  console.log(`   Articles sélectionnés: ${topArticles.length}`);
  
  // Afficher les top 5 sujets récurrents
  const topSubjects = Object.entries(subjectFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log('\n🔥 Top 5 sujets récurrents:');
  topSubjects.forEach(([subject, count]) => {
    console.log(`   - ${subject}: ${count} articles`);
  });

  console.log('\n⭐ Top 5 articles prioritaires:');
  topArticles.slice(0, 5).forEach((article, idx) => {
    console.log(`   ${idx + 1}. ${article.title.substring(0, 60)}...`);
    console.log(`      Score: ${article.priorityScore.toFixed(2)} (importance: ${article.importanceScore.toFixed(2)}, récurrence: ${article.recurrenceScore.toFixed(1)}, qualité: ${article.enrichmentScore.toFixed(2)})`);
  });

  return topArticles;
}

/**
 * Extraire les mots-clés pertinents d'un article
 */
function extractKeywords(article) {
  const keywords = new Set();

  // 1. Mots-clés de la colonne keywords (si disponible)
  if (article.keywords && Array.isArray(article.keywords)) {
    article.keywords.forEach(k => keywords.add(k.toLowerCase()));
  } else if (typeof article.keywords === 'string') {
    try {
      const parsed = JSON.parse(article.keywords);
      if (Array.isArray(parsed)) {
        parsed.forEach(k => keywords.add(k.toLowerCase()));
      }
    } catch {
      // Si ce n'est pas du JSON, séparer par virgules
      article.keywords.split(',').forEach(k => keywords.add(k.trim().toLowerCase()));
    }
  }

  // 2. Entités nommées (si disponible)
  if (article.entities) {
    try {
      const entities = typeof article.entities === 'string' 
        ? JSON.parse(article.entities) 
        : article.entities;
      
      if (Array.isArray(entities)) {
        entities.forEach(e => keywords.add(e.toLowerCase()));
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }

  // 3. Catégorie
  if (article.category) {
    keywords.add(article.category.toLowerCase());
  }

  // 4. Extraire des mots-clés du titre (mots importants)
  const titleWords = extractImportantWords(article.title);
  titleWords.forEach(w => keywords.add(w));

  // 5. Extraire des mots-clés du résumé
  const summary = article.summary_ai || article.summary || '';
  if (summary) {
    const summaryWords = extractImportantWords(summary);
    summaryWords.slice(0, 3).forEach(w => keywords.add(w)); // Limiter à 3 mots du résumé
  }

  return Array.from(keywords).filter(k => k.length > 3); // Filtrer les mots trop courts
}

/**
 * Extraire les mots importants d'un texte (noms propres, mots significatifs)
 */
function extractImportantWords(text) {
  if (!text) return [];

  // Mots à ignorer (stop words français)
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'pour',
    'dans', 'sur', 'avec', 'sans', 'par', 'est', 'sont', 'que', 'qui', 'mais',
    'donc', 'plus', 'moins', 'très', 'aussi', 'comme', 'cette', 'ce', 'ces',
    'son', 'sa', 'ses', 'leur', 'leurs', 'nous', 'vous', 'ils', 'elles',
    'the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'by'
  ]);

  // Extraire les mots (au moins 4 caractères)
  const words = text
    .toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüÿç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  // Déduplication et retour
  return [...new Set(words)];
}

/**
 * Formater les articles pour le prompt GPT-5
 */
function formatArticlesForPrompt(articles) {
  if (!articles || !Array.isArray(articles)) {
    console.error('❌ formatArticlesForPrompt: articles invalides');
    return '';
  }
  
  if (articles.length === 0) {
    console.warn('⚠️  formatArticlesForPrompt: aucun article à formater');
    return 'Aucun article disponible.';
  }
  
  return articles.map((article, idx) => {
    const summary = article.summary_ai || article.summary || article.content?.substring(0, 200) || '';
    const priority = article.priorityScore ? ` [Priorité: ${article.priorityScore.toFixed(1)}]` : '';
    const importance = article.importance ? ` [Importance: ${article.importance}/10]` : '';
    const recurrent = article.recurrenceScore > 2 ? ' ⭐ SUJET RÉCURRENT' : '';
    
    return `Article ${idx + 1}${priority}${importance}${recurrent}:
Titre: ${article.title}
Source: ${article.source || 'Non spécifiée'}
Catégorie: ${article.category || 'Actualité'}
Résumé: ${summary}
---`;
  }).join('\n\n');
}

module.exports = {
  prioritizeArticles,
  extractKeywords,
  formatArticlesForPrompt
};
