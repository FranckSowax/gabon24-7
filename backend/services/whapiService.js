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
 * Utilise OpenAI GPT-4.1 pour proposer des idées d'entreprise liées à la problématique
 */
async function generateOpportunities(title, summary) {
  try {
    const OpenAI = require('openai');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY manquante - opportunités non générées');
      return null;
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      temperature: 0.8,
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

    const result = JSON.parse(response.choices[0].message.content);
    if (result && result.opportunities && result.opportunities.length >= 3) {
      return result.opportunities.slice(0, 3);
    }
    return null;
  } catch (error) {
    console.error('Erreur génération opportunités WhatsApp:', error.message);
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
  const summary = article.summary_ai || 'Pas de résumé disponible.';
  const analyzeUrl = `${frontendUrl}/business/analyzer?aid=${article.id}&source=whatsapp`;
  const imageUrl = (article.image_urls && article.image_urls.length > 0) ? article.image_urls[0] : null;

  // Générer les opportunités business via IA
  const opportunities = await generateOpportunities(title, summary);
  let opportunitiesBlock = '';
  if (opportunities) {
    opportunitiesBlock = `\n\n💼 *Opportunités détectées :*\n• ${opportunities[0]}\n• ${opportunities[1]}\n• ${opportunities[2]}`;
  }

  const caption = `📰 *${title}*\n\n${summary}${opportunitiesBlock}\n\n\n🤎 *Vous voyez une opportunité ? Allez plus loin !*\nCliquez ci-dessous pour obtenir une analyse IA complète : business plan, budget estimé et stratégie de lancement.\n\n🚀 *Lancer l'analyse IA* :\n${analyzeUrl}\n\n---\n_Gabon Insight — Votre source d'info_`;

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
    // 1. Récupérer les articles enrichis mais non envoyés
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary_ai, url, image_urls')
      .eq('whatsapp_sent', false)
      .not('summary_ai', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!articles || articles.length === 0) {
      console.log('Aucun article en attente d\'envoi WhatsApp');
      return { sent: 0, errors: 0, pending: 0, message: 'Aucun article en attente' };
    }

    console.log(`📱 ${articles.length} articles trouvés pour envoi WhatsApp`);

    // 2. Boucle d'envoi avec image en header
    for (const article of articles) {
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

    return { sent, errors, total: articles.length };
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
    const { count, error } = await supabaseService.supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('whatsapp_sent', false)
      .not('summary_ai', 'is', null);

    if (error) throw error;
    return { success: true, count: count || 0 };
  } catch (error) {
    return { success: false, count: 0, error: error.message };
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendInteractiveMessage,
  sendChannelPost,
  sendPendingArticles,
  sendAlertNotification,
  getMessageStatus,
  getChannels,
  getPendingCount,
  isValidPhoneNumber
};
