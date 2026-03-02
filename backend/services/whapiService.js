/**
 * 🟢 SERVICE WHAPI - Envoi de messages WhatsApp via Whapi.cloud
 * 
 * API: https://gate.whapi.cloud/
 * Documentation: https://whapi.cloud/docs
 */

const axios = require('axios');
require('dotenv').config();

const WHAPI_TOKEN = process.env.WHAPI_TOKEN || '';
const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

if (!WHAPI_TOKEN) {
  console.warn('⚠️ WHAPI_TOKEN non configuré - Service WhatsApp désactivé');
}

/**
 * Envoyer un message texte WhatsApp
 * @param {string} phoneNumber - Numéro au format international (ex: +24177123456)
 * @param {string} message - Texte du message
 * @returns {Promise<object>} Réponse Whapi avec message_id
 */
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    console.log(`📱 Envoi WhatsApp vers ${phoneNumber}...`);
    
    // Nettoyer le numéro (enlever espaces, tirets, etc.)
    const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');
    
    // Vérifier format international (+XXX)
    if (!cleanNumber.startsWith('+')) {
      throw new Error('Le numéro doit être au format international (+XXX)');
    }
    
    const response = await axios.post(
      `${WHAPI_BASE_URL}/messages/text`,
      {
        to: cleanNumber,
        body: message,
        typing_time: 0 // Pas de simulation typing
      },
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log(`✅ Message WhatsApp envoyé avec succès à ${phoneNumber}`);
    console.log(`   ID Message: ${response.data.id || 'N/A'}`);
    
    return {
      success: true,
      messageId: response.data.id,
      data: response.data
    };
    
  } catch (error) {
    console.error(`❌ Erreur envoi WhatsApp vers ${phoneNumber}:`, error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Envoyer une alerte article via WhatsApp
 * @param {string} phoneNumber - Numéro WhatsApp
 * @param {object} alertData - Données de l'alerte
 * @returns {Promise<object>}
 */
async function sendAlertNotification(phoneNumber, alertData) {
  const {
    alertName,
    articleTitle,
    articleSummary,
    articleUrl,
    matchedKeywords,
    confidenceScore
  } = alertData;
  
  // Formater le score en pourcentage
  const scorePercent = Math.round(confidenceScore * 100);
  
  // Construire le message
  const message = `
🔔 *Nouvelle Alerte: ${alertName}*

📰 *${articleTitle}*

📝 ${articleSummary || 'Résumé non disponible'}

🔗 Lire l'article:
${articleUrl}

🎯 Mots-clés détectés: ${matchedKeywords.join(', ')}
📊 Correspondance: ${scorePercent}%

---
_Alerte envoyée par Gabon Insight_
`.trim();
  
  return await sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Vérifier statut d'un message
 * @param {string} messageId - ID du message Whapi
 * @returns {Promise<object>}
 */
async function getMessageStatus(messageId) {
  try {
    const response = await axios.get(
      `${WHAPI_BASE_URL}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_TOKEN}`,
          'Accept': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      status: response.data.status,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ Erreur récupération statut message:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Valider format numéro WhatsApp
 * @param {string} phoneNumber
 * @returns {boolean}
 */
function isValidPhoneNumber(phoneNumber) {
  // Format international: +XXX suivi de 6 à 15 chiffres
  const regex = /^\+[1-9]\d{6,14}$/;
  const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');
  return regex.test(cleanNumber);
}

/**
 * Envoyer un message interactif (Boutons/Liste)
 */
async function sendInteractiveMessage(to, title, summary, originalUrl, opportunityUrl, imageUrl = null) {
  try {
    const payload = {
      to,
      type: 'button',
      body: {
        text: `*${title}*\n\n${summary}`
      },
      footer: {
        text: "Gabon 24/7 - Analyse IA"
      },
      action: {
        buttons: [
          {
            type: "url",
            title: "🚀 Opportunités Biz",
            id: "btn_opportunity",
            url: opportunityUrl
          },
          {
            type: "url",
            title: "🔗 Lire l'article",
            id: "btn_read_more",
            url: originalUrl
          }
        ]
      }
    };

    // Selon la doc Whapi, pour les messages interactifs avec image, 
    // on place 'media' à la racine et on ne met pas de 'header'
    if (imageUrl) {
      payload.media = imageUrl;
    } else {
      // Si pas d'image, on peut ajouter un header texte pour le style
      payload.header = {
        type: 'text',
        text: 'Actualité'
      };
    }

    const response = await axios.post(
      `${WHAPI_BASE_URL}/messages/interactive`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error('Erreur sendInteractiveMessage:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Générer 3 opportunités business à partir du titre et résumé d'un article
 * Utilise Kimi K2.5 (Moonshot AI) pour proposer des idées d'entreprise liées à la problématique
 */
async function generateOpportunities(title, summary) {
  try {
    const OpenAI = require('openai');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY manquante - opportunités non générées');
      return null;
    }

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en identification d\'opportunités d\'affaires au Gabon. Réponds UNIQUEMENT en JSON valide.'
        },
        {
          role: 'user',
          content: `Contexte article d'actualité au Gabon :
Titre : ${title}
Résumé : ${summary}

En te basant sur la problématique soulevée par cet article, propose exactement 3 idées de business concrètes et variées (tout type de catégorie et d'activité) qu'un entrepreneur pourrait lancer en lien avec cette actualité.

Réponds en JSON strict :
{
  "opportunities": ["Idée 1 en une phrase courte et percutante", "Idée 2 en une phrase courte et percutante", "Idée 3 en une phrase courte et percutante"]
}`
        }
      ]
    });

    const content = response.choices[0].message.content;
    console.log('🔍 GPT-4.1-mini opportunities response:', content.substring(0, 300));

    const result = JSON.parse(content);
    if (result && result.opportunities && result.opportunities.length >= 3) {
      console.log('✅ 3 opportunités générées avec succès');
      return result.opportunities.slice(0, 3);
    }
    console.warn('⚠️ Réponse invalide - pas assez d\'opportunités:', result);
    return null;
  } catch (error) {
    console.error('❌ Erreur génération opportunités WhatsApp:', error.message);
    return null;
  }
}

/**
 * Poster un article sur une chaîne WhatsApp (newsletter)
 * Utilise /messages/image pour afficher l'image en header + caption
 * Inclut 3 opportunités business générées par IA
 * Fallback sur /messages/text si pas d'image
 */
async function sendChannelPost(channelId, article, frontendUrl) {
  const title = article.title;
  const summary = article.summary_ai || article.summary || 'Pas de résumé disponible.';
  const source = article.source || null;
  const author = article.author || null;
  const analyzeUrl = `${frontendUrl}/business/analyzer?aid=${article.id}&source=whatsapp`;
  const imageUrl = (article.image_urls && article.image_urls.length > 0) ? article.image_urls[0] : null;

  // Générer les opportunités business via IA
  const opportunities = await generateOpportunities(title, summary);
  let opportunitiesBlock = '';
  if (opportunities) {
    opportunitiesBlock = `\n\n💼 *Opportunité Gabon Insight :*\n\n• ${opportunities[0]}\n• ${opportunities[1]}\n• ${opportunities[2]}`;
  }

  // Ligne source (média)
  const sourceLine = source ? `\n📡 _${source}_` : '';
  // Ligne auteur
  const authorLine = author ? `\n✍🏾 ${author}` : '';

  const caption = `📰 *${title}*${sourceLine}\n\n${summary}${authorLine}${opportunitiesBlock}\n\n🚀 *Créer un projet Business à partir de cet article* :\n${analyzeUrl}\n\n---\n_Gabon Insight — Votre source d'info_`;

  if (imageUrl) {
    // Envoi avec image en header
    const response = await axios.post(
      `${WHAPI_BASE_URL}/messages/image`,
      {
        to: channelId,
        media: imageUrl,
        caption,
        width: 800,
        height: 418
      },
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    return { success: true, type: 'image', data: response.data };
  } else {
    // Fallback texte si pas d'image
    const response = await axios.post(
      `${WHAPI_BASE_URL}/messages/text`,
      {
        to: channelId,
        body: caption,
        typing_time: 0
      },
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    return { success: true, type: 'text', data: response.data };
  }
}

/**
 * Récupérer la liste des chaînes WhatsApp (newsletters)
 */
async function getChannels() {
  try {
    const response = await axios.get(
      `${WHAPI_BASE_URL}/newsletters?count=100`,
      {
        headers: {
          'Authorization': `Bearer ${WHAPI_TOKEN}`,
          'Accept': 'application/json'
        }
      }
    );
    return { success: true, channels: response.data.newsletters || [] };
  } catch (error) {
    console.error('Erreur récupération chaînes:', error.message);
    return { success: false, error: error.message, channels: [] };
  }
}

/**
 * Envoie les articles non envoyés vers la chaîne WhatsApp
 * Limité à 5 articles par exécution pour éviter le spam
 */
async function sendPendingArticles(limit = 5) {
  if (!WHAPI_TOKEN) {
    console.error('Token Whapi manquant, impossible d\'envoyer les messages');
    return { sent: 0, errors: 0, message: 'Token Whapi manquant' };
  }

  const supabaseService = require('../supabase-config');
  const channelId = process.env.WHAPI_CHANNEL_ID;
  const frontendUrl = process.env.FRONTEND_URL || 'https://gabon24-7.netlify.app';

  if (!channelId) {
    console.error('WHAPI_CHANNEL_ID non configuré');
    return { sent: 0, errors: 0, message: 'WHAPI_CHANNEL_ID non configuré' };
  }

  let sent = 0;
  let errors = 0;

  try {
    // 1. Ne publier que les articles créés APRÈS l'activation du service (22 fév 2026 22:00 UTC)
    //    + uniquement ceux des dernières 24h pour éviter les rattrapages
    const WHATSAPP_START = '2026-02-23T19:41:00.000Z';
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since = since24h > WHATSAPP_START ? since24h : WHATSAPP_START;
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary_ai, summary, source, author, url, image_urls')
      .eq('whatsapp_sent', false)
      .or('summary_ai.not.is.null,summary.not.is.null')
      .gte('created_at', since)
      .order('published_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    if (!articles || articles.length === 0) {
      console.log('Aucun article récent en attente d\'envoi WhatsApp');
      return { sent: 0, errors: 0, pending: 0, message: 'Aucun article en attente' };
    }

    // 2. Détection des doublons par titre (vérifier les titres déjà envoyés)
    const titles = articles.map(a => a.title);
    const { data: alreadySent } = await supabaseService.supabase
      .from('articles')
      .select('title')
      .eq('whatsapp_sent', true)
      .in('title', titles);

    const sentTitles = new Set((alreadySent || []).map(a => a.title));
    const uniqueArticles = [];
    const skipped = [];

    for (const article of articles) {
      if (sentTitles.has(article.title)) {
        skipped.push(article);
        // Marquer le doublon comme envoyé pour ne plus le retraiter
        await supabaseService.supabase
          .from('articles')
          .update({ whatsapp_sent: true })
          .eq('id', article.id);
      } else {
        uniqueArticles.push(article);
        sentTitles.add(article.title); // éviter les doublons dans le même batch
      }
    }

    if (skipped.length > 0) {
      console.log(`⏭️ ${skipped.length} doublon(s) ignoré(s)`);
    }

    if (uniqueArticles.length === 0) {
      console.log('Aucun article unique à envoyer');
      return { sent: 0, errors: 0, skipped: skipped.length, message: 'Doublons uniquement' };
    }

    console.log(`📱 ${uniqueArticles.length} articles à envoyer sur WhatsApp`);

    // 3. Boucle d'envoi
    for (const article of uniqueArticles) {
      try {
        const result = await sendChannelPost(channelId, article, frontendUrl);

        // Marquer comme envoyé
        await supabaseService.supabase
          .from('articles')
          .update({ whatsapp_sent: true })
          .eq('id', article.id);

        console.log(`✅ Article ${article.id} envoyé (${result.type}) sur WhatsApp`);
        sent++;

        // Pause de 5 secondes entre chaque envoi
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (sendError) {
        console.error(`❌ Erreur envoi article ${article.id}:`, sendError.response?.data || sendError.message);
        errors++;
      }
    }

    return { sent, errors, skipped: skipped.length, total: uniqueArticles.length };
  } catch (error) {
    console.error('Erreur globale service WhatsApp:', error);
    return { sent, errors, message: error.message };
  }
}

/**
 * Compter les articles en attente d'envoi WhatsApp
 */
async function getPendingCount() {
  try {
    const supabaseService = require('../supabase-config');
    const WHATSAPP_START = '2026-02-23T19:41:00.000Z';
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since = since24h > WHATSAPP_START ? since24h : WHATSAPP_START;
    const { count, error } = await supabaseService.supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('whatsapp_sent', false)
      .or('summary_ai.not.is.null,summary.not.is.null')
      .gte('created_at', since);

    if (error) throw error;
    return { success: true, count: count || 0 };
  } catch (error) {
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Envoyer un carrousel d'articles sur la chaîne WhatsApp
 * Utilise POST /messages/carousel — jusqu'à 10 cards avec image, texte et bouton
 * @param {string} channelId - ID de la chaîne WhatsApp
 * @param {Array} articles - Tableau d'articles (max 10)
 * @param {string} frontendUrl - URL du frontend
 * @returns {Promise<object>}
 */
async function sendCarouselPost(channelId, articles, frontendUrl) {
  if (!WHAPI_TOKEN) throw new Error('WHAPI_TOKEN manquant');
  if (!articles || articles.length === 0) throw new Error('Aucun article fourni');

  // Limiter à 10 cards (max WhatsApp)
  const items = articles.slice(0, 10);

  // Filtrer les articles qui ont une image (obligatoire pour le carrousel)
  const withImages = items.filter(a => a.image_urls && a.image_urls.length > 0);
  if (withImages.length === 0) throw new Error('Aucun article avec image pour le carrousel');

  // Construire les cards (format Whapi: media, text, buttons avec id)
  const cards = withImages.map((article, i) => {
    const title = article.title || 'Article';
    const summary = (article.summary_ai || article.summary || '').substring(0, 200);
    const imageUrl = article.image_urls[0];
    const analyzeUrl = `${frontendUrl}/business/analyzer?aid=${article.id}&source=whatsapp`;
    const source = article.source ? `📡 ${article.source}` : '';

    return {
      id: `card_${i}`,
      media: { media: imageUrl },
      text: `📰 *${title}*\n${source}\n\n${summary}`,
      buttons: [
        {
          type: 'url',
          title: 'Analyse IA',
          id: `btn_${i}`,
          url: analyzeUrl
        }
      ]
    };
  });

  const payload = {
    to: channelId,
    body: {
      text: `📊 *${withImages.length} actus Gabon* — Swipez pour découvrir les opportunités business`
    },
    cards
  };

  console.log(`📱 Envoi carrousel WhatsApp: ${withImages.length} cards`);

  const response = await axios.post(
    `${WHAPI_BASE_URL}/messages/carousel`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${WHAPI_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  console.log('✅ Carrousel envoyé avec succès');
  return { success: true, type: 'carousel', cards: items.length, data: response.data };
}

/**
 * Envoyer un carrousel d'articles matchés pour une alerte WhatsApp
 * Regroupe les articles en carrousel de max 5 cartes
 * @param {string} phoneNumber - Numéro WhatsApp du destinataire
 * @param {string} alertName - Nom de l'alerte
 * @param {Array} articles - Articles matchés (avec image_urls, title, summary, url, source)
 * @param {string} frontendUrl - URL du frontend
 * @returns {Promise<object>}
 */
async function sendAlertCarousel(phoneNumber, alertName, articles, frontendUrl) {
  if (!WHAPI_TOKEN) throw new Error('WHAPI_TOKEN manquant');
  if (!articles || articles.length === 0) throw new Error('Aucun article fourni');

  const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '');

  // Filtrer les articles avec images (obligatoire pour carrousel)
  const withImages = articles.filter(a => a.image_urls && a.image_urls.length > 0).slice(0, 5);

  // Si aucun article avec image, fallback texte groupé
  if (withImages.length === 0) {
    const textMessage = `🔔 *Alerte: ${alertName}*\n\n${articles.slice(0, 5).map((a, i) =>
      `${i + 1}. *${a.title}*\n   ${a.url}`
    ).join('\n\n')}\n\n_Gabon Insight - Veille & Alertes_`;
    return await sendWhatsAppMessage(cleanNumber, textMessage);
  }

  const cards = withImages.map((article, i) => {
    const title = (article.title || 'Article').substring(0, 100);
    const summary = (article.summary_ai || article.summary || '').substring(0, 180);
    const source = article.source ? `📡 ${article.source}\n` : '';

    return {
      id: `alert_card_${i}`,
      media: { media: article.image_urls[0] },
      text: `📰 *${title}*\n${source}\n${summary}`,
      buttons: [{
        type: 'url',
        title: 'Lire',
        id: `btn_read_${i}`,
        url: article.url || `${frontendUrl}/article/${article.id}`
      }]
    };
  });

  const payload = {
    to: cleanNumber,
    body: {
      text: `🔔 *Alerte: ${alertName}*\n${withImages.length} article(s) détecté(s)`
    },
    cards
  };

  console.log(`📱 Envoi carrousel alerte "${alertName}": ${withImages.length} cards à ${cleanNumber}`);

  const response = await axios.post(
    `${WHAPI_BASE_URL}/messages/carousel`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${WHAPI_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  console.log(`✅ Carrousel alerte envoyé à ${cleanNumber}`);
  return { success: true, type: 'carousel', messageId: response.data?.id, cards: withImages.length };
}

module.exports = {
  sendWhatsAppMessage,
  sendInteractiveMessage,
  sendChannelPost,
  sendCarouselPost,
  sendPendingArticles,
  sendAlertNotification,
  sendAlertCarousel,
  getMessageStatus,
  getChannels,
  getPendingCount,
  isValidPhoneNumber
};
