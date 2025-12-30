/**
 * 🤖 SERVICE: AI Streaming
 * Permet de streamer les réponses IA mot par mot (comme ChatGPT)
 * 
 * Utilise Server-Sent Events (SSE) pour envoyer les tokens en temps réel
 * Migré vers Gemini Service (Gemini 3 Pro / OpenAI Fallback)
 */

const geminiService = require('./gemini-service');

/**
 * Stream une génération IA via Gemini Service
 * @param {Object} res - Response Express pour SSE
 * @param {string} prompt - Le prompt à envoyer
 * @param {Object} options - Options de génération
 */
async function streamGeneration(res, prompt, options = {}) {
  const {
    temperature = 0.7,
    onProgress = null,
    systemPrompt = ''
  } = options;

  // Configuration SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Envoyer événement de démarrage
    res.write(`data: ${JSON.stringify({ type: 'start', message: 'Génération en cours (Gemini)...' })}\n\n`);

    // Obtenir le flux depuis GeminiService
    const stream = await geminiService.streamText(prompt, {
      systemPrompt,
      temperature
    });

    let fullText = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullText += chunkText;
        chunkCount++;

        // Envoyer le token
        // Note: Progress est estimatif car on ne connait pas la longueur totale
        res.write(`data: ${JSON.stringify({ 
          type: 'token', 
          content: chunkText,
          progress: Math.min(99, chunkCount * 2) // Fake progress
        })}\n\n`);

        if (onProgress) {
          onProgress(chunkText, fullText);
        }
      }
    }

    // Envoyer le résultat final
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      content: fullText,
      progress: 100
    })}\n\n`);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

    return fullText;

  } catch (error) {
    console.error('❌ Erreur streaming IA:', error);
    
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: error.message 
    })}\n\n`);
    
    res.end();
    throw error;
  }
}

/**
 * Génération non-streaming (fallback)
 * Retourne le résultat complet avec callbacks de progression simulés
 */
async function generateWithProgress(prompt, options = {}) {
  const {
    temperature = 0.7,
    onProgress = null,
    systemPrompt = ''
  } = options;

  try {
    if (onProgress) onProgress(10, 'Initialisation Gemini...');

    // Utiliser generateText qui gère déjà les retries et fallbacks
    const text = await geminiService.generateText(prompt, {
      systemPrompt,
      temperature
    });

    if (onProgress) onProgress(100, 'Terminé!');

    return text;

  } catch (error) {
    console.error('❌ Erreur génération IA:', error);
    throw error;
  }
}

module.exports = {
  streamGeneration,
  generateWithProgress
};
