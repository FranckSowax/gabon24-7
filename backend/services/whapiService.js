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
 * Envoie les articles non envoyés vers WhatsApp
 * Limité à 5 articles par exécution pour éviter le spam
 */
async function sendPendingArticles(limit = 5) {
  if (!WHAPI_TOKEN) {
    console.error('Token Whapi manquant, impossible d\'envoyer les messages');
    return;
  }

  const supabaseService = require('../supabase-config');
  const channelId = process.env.WHAPI_CHANNEL_ID;
  const frontendUrl = process.env.FRONTEND_URL || 'https://gabon24-7.netlify.app';

  if (!channelId) {
    console.error('WHAPI_CHANNEL_ID non configuré');
    return;
  }

  try {
    // 1. Récupérer les articles enrichis mais non envoyés
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, ai_summary, url, image_urls')
      .eq('whatsapp_sent', false)
      .not('ai_summary', 'is', null) // S'assurer qu'il y a un résumé
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!articles || articles.length === 0) {
      console.log('Aucun article en attente d\'envoi WhatsApp');
      return;
    }

    console.log(`${articles.length} articles trouvés pour envoi WhatsApp`);

    // 2. Boucle d'envoi
    for (const article of articles) {
      try {
        const title = article.title;
        const summary = article.ai_summary || 'Pas de résumé disponible.';
        const originalUrl = article.url;
        // Rediriger vers l'analyseur avec l'ID de l'article pré-sélectionné (aid)
        const opportunityUrl = `${frontendUrl}/business/analyzer?aid=${article.id}&source=whatsapp`;
        
        // Déterminer si on envoie une image
        const imageUrl = (article.image_urls && article.image_urls.length > 0) ? article.image_urls[0] : null;

        await sendInteractiveMessage(channelId, title, summary, originalUrl, opportunityUrl, imageUrl);
        
        // Marquer comme envoyé
        await supabaseService.supabase
          .from('articles')
          .update({ whatsapp_sent: true })
          .eq('id', article.id);
          
        console.log(`Article ${article.id} envoyé sur WhatsApp avec succès`);
        
        // Pause de 5 secondes pour respecter les limites de débit
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (sendError) {
        console.error(`Erreur lors de l'envoi de l'article ${article.id}:`, sendError.message);
        // On continue avec l'article suivant même si un échoue
      }
    }
  } catch (error) {
    console.error('Erreur globale service WhatsApp:', error);
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendInteractiveMessage,
  sendPendingArticles,
  sendAlertNotification,
  getMessageStatus,
  isValidPhoneNumber
};
