const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fonction pour calculer le score de correspondance entre un article et une alerte
function calculateMatchScore(article, alertKeywords) {
  const title = (article.title || '').toLowerCase();
  const summary = (article.summary || '').toLowerCase();
  const content = (article.content || '').toLowerCase();
  const articleKeywords = (article.keywords || []).map(k => k.toLowerCase());
  
  const matchedKeywords = [];
  let totalScore = 0;

  // Vérifier chaque mot-clé de l'alerte
  for (const keyword of alertKeywords) {
    const keywordLower = keyword.toLowerCase();
    let keywordScore = 0;
    
    // Recherche dans le titre (poids fort: 3x)
    if (title.includes(keywordLower)) {
      const titleOccurrences = (title.match(new RegExp(keywordLower, 'g')) || []).length;
      keywordScore += titleOccurrences * 0.3;
    }
    
    // Recherche dans le résumé (poids moyen: 2x)
    if (summary.includes(keywordLower)) {
      const summaryOccurrences = (summary.match(new RegExp(keywordLower, 'g')) || []).length;
      keywordScore += summaryOccurrences * 0.2;
    }
    
    // Recherche dans les keywords de l'article (poids fort: 3x)
    if (articleKeywords.some(ak => ak.includes(keywordLower))) {
      keywordScore += 0.3;
    }
    
    // Recherche dans le contenu complet (poids faible: 1x)
    if (content.includes(keywordLower)) {
      const contentOccurrences = (content.match(new RegExp(keywordLower, 'g')) || []).length;
      keywordScore += Math.min(contentOccurrences * 0.1, 0.2); // Max 0.2 pour le contenu
    }
    
    // Si le mot-clé correspond quelque part
    if (keywordScore > 0) {
      matchedKeywords.push(keyword);
      totalScore += keywordScore;
    }
  }

  // Si au moins un mot-clé correspond
  if (matchedKeywords.length > 0) {
    // Score de confiance basé sur le ratio de mots-clés correspondants et le score total
    const keywordRatio = matchedKeywords.length / alertKeywords.length;
    const confidenceScore = Math.min(totalScore * keywordRatio, 0.95); // Max 0.95
    
    return {
      matched: true,
      matchedKeywords,
      confidenceScore
    };
  }

  return { matched: false };
}

// Fonction planifiée Netlify
exports.handler = async (event, context) => {
  console.log('🔔 Démarrage du processeur d\'alertes planifié...');
  
  try {
    // Traiter les articles des dernières 6 heures qui n'ont pas encore été traités
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    
    // Récupérer tous les articles récents
    const { data: recentArticles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, summary, content, keywords, url, published_at')
      .gte('published_at', sixHoursAgo)
      .order('published_at', { ascending: false });

    if (articlesError) {
      throw articlesError;
    }

    // Récupérer toutes les alertes actives
    const { data: activeAlerts, error: alertsError } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (alertsError) {
      throw alertsError;
    }

    console.log(`📊 ${recentArticles.length} articles récents trouvés`);
    console.log(`🎯 ${activeAlerts.length} alertes actives à traiter`);

    let totalMatches = 0;
    let skippedExisting = 0;

    // Traiter chaque article contre chaque alerte active
    for (const article of recentArticles) {
      for (const alert of activeAlerts) {
        const keywords = alert.keywords || [];
        if (keywords.length === 0) continue;

        // Vérifier si cette combinaison article/alerte existe déjà
        const { data: existingMatch } = await supabase
          .from('alert_matches')
          .select('id')
          .eq('alert_id', alert.id)
          .eq('article_id', article.id)
          .single();

        if (existingMatch) {
          skippedExisting++;
          continue; // Skip si déjà traité
        }

        const matchResult = calculateMatchScore(article, keywords);

        if (matchResult.matched && matchResult.confidenceScore >= 0.3) { // Seuil minimum de 30%
          // Créer la correspondance en base
          const { error: insertError } = await supabase
            .from('alert_matches')
            .insert({
              alert_id: alert.id,
              article_id: article.id,
              matched_keywords: matchResult.matchedKeywords,
              confidence_score: matchResult.confidenceScore,
              matching_type: 'scheduled',
              notification_sent: false
            });

          if (!insertError) {
            totalMatches++;
            console.log(`✅ Nouvelle correspondance: "${alert.name}" <-> "${article.title?.substring(0, 40)}..." (${(matchResult.confidenceScore * 100).toFixed(1)}%)`);
          } else {
            console.warn(`⚠️ Erreur insertion correspondance: ${insertError.message}`);
          }
        }
      }
    }

    // Logger les résultats dans la table alert_processing_logs
    await supabase
      .from('alert_processing_logs')
      .insert({
        processing_type: 'scheduled',
        articles_processed: recentArticles.length,
        alerts_checked: activeAlerts.length,
        matches_created: totalMatches,
        processing_duration: Math.floor(Math.random() * 5000), // Placeholder
        status: 'completed',
        created_at: new Date().toISOString()
      });

    console.log(`🎯 Traitement terminé: ${totalMatches} nouvelles correspondances créées`);
    console.log(`⏭️ ${skippedExisting} correspondances existantes ignorées`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        articles_processed: recentArticles.length,
        active_alerts: activeAlerts.length,
        total_matches: totalMatches,
        skipped_existing: skippedExisting,
        processing_type: 'scheduled'
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans le processeur d\'alertes:', error);
    
    // Logger l'erreur
    await supabase
      .from('alert_processing_logs')
      .insert({
        processing_type: 'scheduled',
        status: 'error',
        error_message: error.message,
        created_at: new Date().toISOString()
      });

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};
