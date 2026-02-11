/**
 * Service Text-to-Speech avec OpenAI Audio API
 * Remplace l'ancienne implémentation Replicate Kokoro
 * https://platform.openai.com/docs/guides/text-to-speech
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Initialisation lazy du client OpenAI (évite crash au démarrage si clé manquante)
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY manquant — service TTS désactivé');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Générer audio avec OpenAI TTS
 * @param {string} text - Texte à convertir en audio
 * @param {string} language - Langue (fr, en, zh) - utilisé pour choisir la voix
 * @param {string} pace - Vitesse (slow, normal, fast)
 * @returns {Promise<Buffer>} - Buffer audio MP3
 */
async function generateAudio(text, language = 'fr', pace = 'normal') {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY manquant dans .env');
    }

    // Mapper la langue vers la voix OpenAI
    // Voix disponibles: alloy, echo, fable, onyx, nova, shimmer
    const voiceMap = {
      'fr': 'onyx',      // Voix masculine grave et professionnelle - style journaliste
      'en': 'alloy',     // Voix neutre/masculine versatile
      'zh': 'nova'       // Voix féminine énergique
    };

    // Mapper pace vers speed (0.25 à 4.0)
    const speedMap = {
      'slow': 0.85,
      'normal': 1.0,
      'fast': 1.2
    };

    const voice = voiceMap[language] || 'alloy';
    const speed = speedMap[pace] || 1.0;

    console.log(`🔊 Génération audio OpenAI: langue=${language}, voix=${voice}, vitesse=${speed}, modèle=tts-1`);

    // Limiter le texte (OpenAI TTS a une limite de 4096 caractères)
    const maxChars = 4096;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

    // Appeler l'API OpenAI
    const mp3 = await getOpenAI().audio.speech.create({
      model: "tts-1", // ou "tts-1-hd" pour meilleure qualité (mais plus lent)
      voice: voice,
      input: truncatedText,
      speed: speed,
      response_format: 'mp3'
    });

    // Convertir la réponse en Buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    console.log(`✅ Audio OpenAI généré: ${buffer.length} bytes`);

    return buffer;

  } catch (error) {
    console.error('❌ Erreur OpenAI TTS:', error.message);
    throw error;
  }
}

/**
 * Tester la connexion à OpenAI
 */
async function testConnection() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OPENAI_API_KEY manquant');
      return false;
    }

    // Test simple de listing des modèles (pour vérifier la clé)
    await getOpenAI().models.list();
    console.log('✅ Connexion OpenAI OK');
    return true;

  } catch (error) {
    console.error('❌ Erreur test OpenAI:', error.message);
    return false;
  }
}

module.exports = {
  generateAudio,
  testConnection
};
