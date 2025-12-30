/**
 * 🔔 ROUTES VEILLE & ALERTES - Migration depuis Netlify
 * Système de matching articles/mots-clés et notifications
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');

// POST /api/alerts/process - Traiter les alertes (matching articles)
router.post('/process', async (req, res) => {
  try {
    console.log('🔔 Traitement des alertes avec IA...');

    // Récupérer toutes les alertes actives
    const { data: alerts } = await supabaseService.supabase
      .from('user_alerts')
      .select('*')
      .eq('is_active', true);

    if (!alerts || alerts.length === 0) {
      return res.json({ success: true, message: 'Aucune alerte active', processed: 0 });
    }

    // Récupérer articles récents avec MÉTADONNÉES + KEYWORDS
    // Colonnes DB réelles: category, importance, is_breaking, sentiment_score, keywords
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: articles } = await supabaseService.supabase
      .from('articles')
      .select('id,title,summary,source,url,published_at,category,sentiment_score,importance,is_breaking,keywords')
      .eq('is_published', true)
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false });

    if (!articles || articles.length === 0) {
      return res.json({ success: true, message: 'Aucun article récent', processed: 0 });
    }

    let matchCount = 0;
    let skippedByFilter = 0;

    // Grouper alertes par catégorie pour optimisation (Option 1 du diagnostic)
    const alertsByCategory = {};
    for (const alert of alerts) {
      const categories = alert.categories || ['all'];
      for (const cat of categories) {
        if (!alertsByCategory[cat]) alertsByCategory[cat] = [];
        alertsByCategory[cat].push(alert);
      }
    }

    // Pour chaque catégorie, traiter les articles correspondants
    for (const [category, categoryAlerts] of Object.entries(alertsByCategory)) {
      // Pré-filtrer articles par catégorie IA (GAIN DE PERFORMANCE)
      const categoryArticles = category === 'all'
        ? articles
        : articles.filter(a => a.ai_category === category || !a.ai_category);

      console.log(`📂 Catégorie ${category}: ${categoryAlerts.length} alertes, ${categoryArticles.length} articles`);

      for (const alert of categoryAlerts) {
        const keywords = Array.isArray(alert.keywords) ? alert.keywords : [];
        if (keywords.length === 0) continue;

        for (const article of categoryArticles) {
          // 🚀 FILTRAGE INTELLIGENT AVEC MÉTADONNÉES IA (Option 1)
          const passesAIFilters = applyIntelligentFilters(article, alert);
          if (!passesAIFilters) {
            skippedByFilter++;
            continue;
          }

          // Matching amélioré
          const matchResult = improvedMatching(article, keywords);

          if (matchResult.hasMatch) {
            // Utiliser upsert pour éviter les race conditions et doublons
            // On suppose qu'il y a une contrainte unique sur (alert_id, article_id)
            // Sinon, on fait une vérification manuelle robuste
            
            // 1. D'abord vérifier si le match existe déjà (lecture)
            const { data: existing } = await supabaseService.supabase
              .from('alert_matches')
              .select('id')
              .eq('alert_id', alert.id)
              .eq('article_id', article.id)
              .single();

            if (!existing) {
              // 2. Créer nouveau match
              const { data: newMatch, error: matchError } = await supabaseService.supabase
                .from('alert_matches')
                .insert({
                  alert_id: alert.id,
                  user_id: alert.user_id,
                  article_id: article.id,
                  matched_keywords: matchResult.matchedKeywords,
                  confidence_score: matchResult.confidence,
                  is_notified: false
                })
                .select()
                .single();

              if (matchError) {
                // Si erreur (probablement contrainte unique violée par race condition), on ignore
                if (matchError.code === '23505') { // Code erreur unique_violation Postgres
                   console.log(`⚠️ Doublon détecté pour alerte ${alert.id} article ${article.id}, ignoré.`);
                   continue; 
                }
                console.error('❌ Erreur création match:', matchError.message);
                continue;
              }

              matchCount++;
              
              // 🔔 NOTIFICATION EN TEMPS RÉEL
              try {
                // Vérifier si une notification existe déjà pour ce match (par sécurité)
                // Note: notifyAlertMatch crée la notification. 
                // On va modifier notifyAlertMatch pour qu'il soit idempotent ou on check ici.
                // Comme on vient de créer le match avec succès (et unicité), on peut notifier.
                
                const notificationHelper = require('../utils/notificationHelper');
                await notificationHelper.notifyAlertMatch(
                  alert.user_id,
                  alert.name,
                  article.title,
                  article.url,
                  matchResult.matchedKeywords,
                  matchResult.confidence
                );
                console.log(`✅ Notification envoyée pour alerte "${alert.name}"`);
              } catch (notifError) {
                console.warn('⚠️ Erreur notification:', notifError.message);
              }
              
              // 📱 ENVOI WHATSAPP si activé
              if (alert.whatsapp_enabled && alert.whatsapp_numbers && alert.whatsapp_numbers.length > 0) {
                try {
                  const whapiService = require('../services/whapiService');
                  
                  // Envoyer à tous les numéros configurés
                  for (const phoneNumber of alert.whatsapp_numbers) {
                    const alertData = {
                      alertName: alert.name,
                      articleTitle: article.title,
                      articleSummary: article.summary || article.summary_ai || 'Résumé non disponible',
                      articleUrl: article.url,
                      matchedKeywords: matchResult.matchedKeywords,
                      confidenceScore: matchResult.confidence
                    };
                    
                    const result = await whapiService.sendAlertNotification(phoneNumber, alertData);
                    
                    // Logger l'envoi
                    await supabaseService.supabase
                      .from('whatsapp_notifications')
                      .insert({
                        user_id: alert.user_id,
                        alert_id: alert.id,
                        match_id: newMatch.id,
                        phone_number: phoneNumber,
                        message_text: `Alerte: ${alert.name} - ${article.title}`,
                        article_title: article.title,
                        article_url: article.url,
                        confidence_score: matchResult.confidence,
                        status: result.success ? 'sent' : 'failed',
                        whapi_message_id: result.messageId,
                        error_message: result.error,
                        sent_at: result.success ? new Date().toISOString() : null
                      });
                    
                    console.log(`📱 WhatsApp ${result.success ? 'envoyé' : 'échoué'} à ${phoneNumber} pour alerte "${alert.name}"`);
                  }
                } catch (whatsappError) {
                  console.error('❌ Erreur envoi WhatsApp:', whatsappError);
                  // Ne pas bloquer le processus si WhatsApp échoue
                }
              }
            }
          }
        }
      }
    }

    console.log(`✅ Traitement terminé: ${matchCount} matches, ${skippedByFilter} articles filtrés par IA`);

    res.json({
      success: true,
      processed: matchCount,
      alertsChecked: alerts.length,
      articlesScanned: articles.length,
      skippedByAIFilters: skippedByFilter
    });

  } catch (error) {
    console.error('❌ Erreur process alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🧠 FILTRAGE INTELLIGENT AVEC MÉTADONNÉES
 * Colonnes DB: category, sentiment_score, importance, is_breaking
 */
function applyIntelligentFilters(article, alert) {
  // 1. Filtre catégorie (si spécifié dans l'alerte)
  if (alert.categories && alert.categories.length > 0 && !alert.categories.includes('all')) {
    if (!article.category || !alert.categories.includes(article.category)) {
      return false;
    }
  }

  // 2. Filtre sentiment (si spécifié)
  if (alert.sentiment_filter && article.sentiment_score !== null) {
    const sentiment = article.sentiment_score;
    
    if (alert.sentiment_filter === 'positive' && sentiment < 0.3) {
      return false;
    }
    if (alert.sentiment_filter === 'negative' && sentiment > -0.3) {
      return false;
    }
    if (alert.sentiment_filter === 'neutral' && Math.abs(sentiment) > 0.3) {
      return false;
    }
  }

  // 3. Filtre importance minimale (si spécifié)
  if (alert.min_importance && article.importance !== null) {
    if (article.importance < alert.min_importance) {
      return false;
    }
  }

  // 4. Filtre breaking news uniquement (si activé)
  if (alert.breaking_news_only && !article.is_breaking) {
    return false;
  }

  return true; // Article passe tous les filtres
}

/**
 * 🎯 MATCHING AMÉLIORÉ AVEC SCORING + AI KEYWORDS + STEMMING + SYNONYMES
 * Utilise les keywords IA, stemming français et synonymes gabonais
 */
function improvedMatching(article, keywords) {
  const titleWeight = 3.0;      // Titre 3x plus important
  const summaryWeight = 1.0;
  const aiKeywordsWeight = 1.5; // Keywords IA poids intermédiaire
  const exactMatchBonus = 2.0;
  const stemMatchBonus = 1.5;   // Bonus pour match par stem
  const synonymMatchBonus = 1.2; // Bonus pour match par synonyme
  
  let score = 0;
  let matchedKeywords = [];
  let matchDetails = []; // Pour debug/analytics
  
  const titleText = article.title || '';
  const summaryText = article.summary || '';
  
  // Normaliser les keywords de l'article
  const articleKeywords = (article.keywords || []).map(k => normalizeText(k));
  
  for (const keyword of keywords) {
    let keywordMatched = false;
    
    // 1. Check dans titre avec stemming et synonymes
    const titleMatch = matchWithStemAndSynonyms(titleText, keyword);
    if (titleMatch.matched) {
      const bonus = titleMatch.type === 'exact' ? exactMatchBonus : 
                    titleMatch.type === 'stem' ? stemMatchBonus : synonymMatchBonus;
      score += titleWeight * bonus * titleMatch.score;
      keywordMatched = true;
      matchDetails.push({ keyword, location: 'title', type: titleMatch.type });
    }
    
    // 2. Check dans résumé avec stemming et synonymes
    const summaryMatch = matchWithStemAndSynonyms(summaryText, keyword);
    if (summaryMatch.matched) {
      const bonus = summaryMatch.type === 'exact' ? exactMatchBonus : 
                    summaryMatch.type === 'stem' ? stemMatchBonus : synonymMatchBonus;
      score += summaryWeight * bonus * summaryMatch.score;
      if (!keywordMatched) keywordMatched = true;
      matchDetails.push({ keyword, location: 'summary', type: summaryMatch.type });
    }
    
    // 3. Check match avec keywords article (stemming aussi)
    const kwNormalized = normalizeText(keyword);
    const kwStem = stemFrench(kwNormalized);
    const articleKeywordMatch = articleKeywords.some(ak => {
      const akStem = stemFrench(ak);
      return ak.includes(kwNormalized) || kwNormalized.includes(ak) ||
             akStem === kwStem;
    });
    
    if (articleKeywordMatch) {
      score += aiKeywordsWeight;
      if (!keywordMatched) keywordMatched = true;
      matchDetails.push({ keyword, location: 'keywords', type: 'keyword' });
    }
    
    if (keywordMatched && !matchedKeywords.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }
  
  // Bonus pour mots-clés multiples (pertinence)
  if (matchedKeywords.length > 1) {
    score *= (1 + matchedKeywords.length * 0.2);
  }
  
  // Bonus si article important ou breaking
  if (article.is_breaking) {
    score *= 1.3;
  }
  if (article.importance && article.importance > 0.7) {
    score *= 1.2;
  }
  
  // Normaliser score 0-100
  const confidence = Math.min(100, Math.round(score * 10));
  
  return {
    hasMatch: matchedKeywords.length > 0 && confidence >= 30, // Seuil minimum
    confidence,
    matchedKeywords,
    matchDetails // Pour analytics/debug
  };
}

/**
 * 🔤 NORMALISATION TEXTE
 * Gère accents, casse, ponctuation
 */
function normalizeText(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever accents
    .replace(/[^\w\s]/g, ' ')         // Enlever ponctuation
    .replace(/\s+/g, ' ')             // Normaliser espaces
    .trim();
}

/**
 * 🌱 STEMMING FRANÇAIS BASIQUE
 * Réduit les mots à leur racine pour améliorer le matching
 */
function stemFrench(word) {
  if (!word || word.length < 4) return word;
  
  // Suffixes français courants (ordre: plus long au plus court)
  const suffixes = [
    'issement', 'isation', 'ement', 'ation', 'ition', 'ution',
    'ement', 'ateur', 'atrice', 'ement', 'ique', 'iste',
    'able', 'ible', 'tion', 'sion', 'ment', 'eur', 'euse',
    'eux', 'aux', 'ive', 'if', 'al', 'el', 'er', 'ir', 'es', 's'
  ];
  
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

/**
 * 📚 DICTIONNAIRE DE SYNONYMES GABONAIS
 * Termes courants dans l'actualité gabonaise
 */
const SYNONYMS_DICT = {
  // Politique
  'president': ['chef etat', 'pr', 'chef gouvernement', 'dirigeant', 'leader'],
  'gouvernement': ['gouvernemental', 'ministere', 'administration', 'executif', 'cabinet'],
  'election': ['electoral', 'vote', 'scrutin', 'ballot', 'urnes', 'suffrage'],
  'ministre': ['ministeriel', 'secretaire etat', 'membre gouvernement'],
  'depute': ['parlementaire', 'elu', 'assemblee nationale', 'legislateur'],
  'opposition': ['opposant', 'adversaire politique'],
  
  // Économie
  'economie': ['economique', 'finance', 'financier', 'marche'],
  'investissement': ['investir', 'investisseur', 'placement', 'capital'],
  'entreprise': ['societe', 'compagnie', 'firme', 'business', 'pme'],
  'petrole': ['petrolier', 'hydrocarbure', 'brut', 'or noir'],
  'budget': ['budgetaire', 'finances publiques', 'tresor'],
  'emploi': ['travail', 'embauche', 'recrutement', 'chomage'],
  
  // Société
  'education': ['educatif', 'enseignement', 'ecole', 'universite', 'formation'],
  'sante': ['sanitaire', 'medical', 'hopital', 'clinique', 'soins'],
  'jeunesse': ['jeune', 'adolescent', 'etudiant'],
  'femme': ['feminin', 'genre', 'egalite'],
  
  // Géographie Gabon
  'libreville': ['capitale', 'estuaire'],
  'port gentil': ['ogooue maritime', 'cite petroliere'],
  'franceville': ['haut ogooue'],
  'gabon': ['gabonais', 'gabonaise', 'republique gabonaise'],
  
  // Institutions
  'ctri': ['transition', 'comite transition'],
  'assemblee': ['parlement', 'chambre', 'deputes'],
  'senat': ['senateur', 'chambre haute'],
  
  // Sport
  'football': ['foot', 'ballon rond', 'pantheres'],
  'can': ['coupe afrique', 'competition africaine']
};

/**
 * 🔍 OBTENIR SYNONYMES D'UN MOT
 */
function getSynonyms(keyword) {
  const normalized = normalizeText(keyword);
  return SYNONYMS_DICT[normalized] || [];
}

/**
 * 🎯 MATCHING AVEC STEMMING ET SYNONYMES
 * Version améliorée qui utilise stemming + synonymes
 */
function matchWithStemAndSynonyms(text, keyword) {
  const textNorm = normalizeText(text);
  const kwNorm = normalizeText(keyword);
  
  // 1. Match exact
  if (textNorm.includes(kwNorm)) {
    return { matched: true, type: 'exact', score: 1.0 };
  }
  
  // 2. Match par stem
  const kwStem = stemFrench(kwNorm);
  const textWords = textNorm.split(' ');
  for (const word of textWords) {
    if (stemFrench(word) === kwStem) {
      return { matched: true, type: 'stem', score: 0.8 };
    }
  }
  
  // 3. Match par synonymes
  const synonyms = getSynonyms(keyword);
  for (const syn of synonyms) {
    if (textNorm.includes(normalizeText(syn))) {
      return { matched: true, type: 'synonym', score: 0.6 };
    }
  }
  
  return { matched: false, type: null, score: 0 };
}

// GET /api/alerts/matches/:alertId - Récupérer matches d'une alerte spécifique
router.get('/matches/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { data: matches, error } = await supabaseService.supabase
      .from('alert_matches')
      .select(`
        id,
        alert_id,
        article_id,
        matched_keywords,
        confidence_score,
        created_at,
        articles (
          id, title, summary, source, url, published_at, image_urls,
          category, sentiment_score, importance, is_breaking
        ),
        user_alerts (
          id, name, keywords
        )
      `)
      .eq('alert_id', alertId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erreur récupération matches par alerte:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      matches: matches || [],
      total: matches?.length || 0
    });

  } catch (error) {
    console.error('❌ Erreur get matches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/alerts/create - Créer une alerte
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const {
      name,
      keywords = [],
      notify_email = false,
      notify_push = false
    } = req.body;

    if (!name || keywords.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'name et keywords sont requis' 
      });
    }

    const { data: alert, error } = await supabaseService.supabase
      .from('user_alerts')
      .insert({
        user_id: userId,
        name,
        keywords,
        notify_email,
        notify_push,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      alert
    });

  } catch (error) {
    console.error('❌ Erreur create alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/alerts/:alertId - Mettre à jour une alerte
router.put('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const {
      name,
      keywords,
      notify_email,
      notify_push,
      is_active
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (keywords !== undefined) updates.keywords = keywords;
    if (notify_email !== undefined) updates.notify_email = notify_email;
    if (notify_push !== undefined) updates.notify_push = notify_push;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: alert, error } = await supabaseService.supabase
      .from('user_alerts')
      .update(updates)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      alert
    });

  } catch (error) {
    console.error('❌ Erreur update alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/alerts/:alertId - Mettre à jour partiellement une alerte (compatible frontend)
router.patch('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const {
      name,
      keywords,
      notify_email,
      notify_push,
      is_active
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (keywords !== undefined) updates.keywords = keywords;
    if (notify_email !== undefined) updates.notify_email = notify_email;
    if (notify_push !== undefined) updates.notify_push = notify_push;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: alert, error } = await supabaseService.supabase
      .from('user_alerts')
      .update(updates)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      alert
    });

  } catch (error) {
    console.error('❌ Erreur update alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alerts/user - Récupérer toutes les alertes de l'utilisateur connecté
router.get('/user', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT

    const { data: alerts, error } = await supabaseService.supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      alerts: alerts || []
    });

  } catch (error) {
    console.error('Erreur récupération alertes utilisateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alerts/recent-matches - Récupérer matches récents de l'utilisateur connecté
router.get('/recent-matches', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const { limit = 50 } = req.query;

    // D'abord récupérer les IDs des alertes de l'utilisateur
    const { data: userAlerts, error: alertsError } = await supabaseService.supabase
      .from('user_alerts')
      .select('id')
      .eq('user_id', userId);

    if (alertsError) {
      console.error('Erreur récupération alertes:', alertsError);
      return res.status(500).json({ success: false, error: alertsError.message });
    }

    if (!userAlerts || userAlerts.length === 0) {
      return res.json({ success: true, matches: [] });
    }

    const alertIds = userAlerts.map(a => a.id);

    // Récupérer les matches pour ces alertes
    const { data: matches, error } = await supabaseService.supabase
      .from('alert_matches')
      .select(`
        id,
        alert_id,
        article_id,
        matched_keywords,
        confidence_score,
        created_at,
        user_alerts!inner (name),
        articles (
          title,
          url,
          published_at,
          category,
          sentiment_score,
          importance,
          is_breaking
        )
      `)
      .in('alert_id', alertIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erreur récupération matches:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Formater les données
    const formattedMatches = (matches || []).map(match => ({
      match_id: match.id,
      alert_name: match.user_alerts?.name || 'Alerte inconnue',
      article_title: match.articles?.title || 'Titre non disponible',
      article_url: match.articles?.url || '#',
      matched_keywords: match.matched_keywords || [],
      confidence_score: match.confidence_score || 0,
      created_at: match.created_at,
      article_id: match.article_id,
      ai_category: match.articles?.category,
      ai_sentiment: match.articles?.sentiment_score,
      ai_importance: match.articles?.importance,
      ai_is_breaking: match.articles?.is_breaking,
      published_at: match.articles?.published_at
    }));

    res.json({
      success: true,
      matches: formattedMatches
    });

  } catch (error) {
    console.error('Erreur récupération matches récents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alerts/stats - Statistiques alertes de l'utilisateur connecté
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT

    // Compter les alertes
    const { count: totalAlerts } = await supabaseService.supabase
      .from('user_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: activeAlerts } = await supabaseService.supabase
      .from('user_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Récupérer les IDs des alertes de l'utilisateur
    const { data: userAlerts } = await supabaseService.supabase
      .from('user_alerts')
      .select('id')
      .eq('user_id', userId);

    const alertIds = (userAlerts || []).map(a => a.id);

    // Compter les matches pour ces alertes
    const { count: totalMatches } = alertIds.length > 0
      ? await supabaseService.supabase
          .from('alert_matches')
          .select('*', { count: 'exact', head: true })
          .in('alert_id', alertIds)
      : { count: 0 };

    // Calculer confiance moyenne
    const { data: matchesData } = alertIds.length > 0
      ? await supabaseService.supabase
          .from('alert_matches')
          .select('confidence_score')
          .in('alert_id', alertIds)
      : { data: [] };

    const avgConfidence = matchesData && matchesData.length > 0
      ? matchesData.reduce((sum, m) => sum + (m.confidence_score || 0), 0) / matchesData.length
      : 0;

    // Compter notifications envoyées (approximation)
    const notificationsSent = totalMatches || 0;

    res.json({
      success: true,
      stats: {
        total_alerts: totalAlerts || 0,
        active_alerts: activeAlerts || 0,
        total_matches: totalMatches || 0,
        notifications_sent: notificationsSent,
        avg_confidence: avgConfidence
      }
    });

  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/alerts/:alertId - Supprimer une alerte
router.delete('/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;

    const { error } = await supabaseService.supabase
      .from('user_alerts')
      .delete()
      .eq('id', alertId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Alerte supprimée'
    });

  } catch (error) {
    console.error('Erreur suppression alerte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
