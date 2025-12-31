/**
 * ♊ SERVICE GEMINI ROBUSTE (Wrapper)
 * 
 * Architecture:
 * 1. Primary: Google Gemini via SDK @google/generative-ai (JSON Mode strict)
 * 2. Fallback: OpenAI GPT-4o via SDK openai
 * 
 * Features:
 * - Retry Pattern (Exponential Backoff)
 * - JSON Sanitization
 * - Strict Types
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
require('dotenv').config();

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    
    // Configuration des modèles
    // On utilise gemini-2.5-flash (dernière version) comme principal
    this.models = {
      text: 'gemini-2.5-flash',          // Modèle principal: Gemini 2.5 Flash
      textFallback: 'gemini-2.0-flash',  // Fallback: Gemini 2.0 Flash (stable)
      image: 'gemini-2.5-flash'          // Modèle Image
    };

    // Initialisation des IDs de modèles
    this.primaryModelId = process.env.GEMINI_MODEL_NAME || this.models.text;
    this.fallbackModelId = this.models.textFallback;

    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY non configuré - Service IA Google désactivé');
    } else {
      console.log('✅ Service Gemini initialisé avec modèle:', this.primaryModelId);
    }
    
    if (this.openaiApiKey) {
      console.log('✅ OpenAI GPT-4o disponible comme fallback');
    }

    // Initialisation Google
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    // Initialisation OpenAI (Fallback ultime)
    if (this.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: this.openaiApiKey });
      console.log('✅ Fallback OpenAI GPT-4o prêt');
    }
  }

  /**
   * Nettoie le JSON brut retourné par le LLM
   * Enlève les balises markdown ```json ... ```
   */
  cleanJson(text) {
    if (!text) return "";
    // Enlever les balises markdown code blocks
    let cleaned = text.replace(/```json/g, "").replace(/```/g, "");
    // Enlever les espaces avant/après
    return cleaned.trim();
  }

  /**
   * Attendre x millisecondes (pour le backoff)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Exécute une requête avec Retry Pattern
   */
  async executeWithRetry(operation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const isRetryable = error.status === 503 || error.status === 429 || error.message.includes('timeout') || error.message.includes('quota');
        
        if (attempt < maxRetries && isRetryable) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée. Retrying in ${delay}ms... (Erreur: ${error.message})`);
          await this.sleep(delay);
        } else {
          // Si dernière tentative ou erreur non-retryable
          if (!isRetryable) break; // Sortir tout de suite si c'est une erreur 400 ou autre
        }
      }
    }
    throw lastError;
  }

  /**
   * Méthode principale générique pour obtenir du JSON
   * @param {string} prompt - Prompt utilisateur
   * @param {object} options - Options (systemPrompt, temperature, schema, model, etc.)
   */
  async generateJSON(prompt, options = {}) {
    // Gestion de la compatibilité si options est une string (ancien usage)
    if (typeof options === 'string') {
      options = { systemPrompt: options };
    }

    const { systemPrompt = "", temperature = 0.7, model: modelOverride } = options;
    const targetModel = modelOverride || this.primaryModelId;

    try {
      // 1. Essai avec Gemini (Primary)
      if (this.genAI) {
        try {
          return await this.executeWithRetry(async () => {
            const model = this.genAI.getGenerativeModel({
              model: targetModel,
              generationConfig: {
                responseMimeType: "application/json",
                temperature: temperature
              },
              systemInstruction: systemPrompt ? {
                role: "system",
                parts: [{ text: systemPrompt }]
              } : undefined
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return JSON.parse(this.cleanJson(text));
          });
        } catch (geminiError) {
          console.error(`❌ Erreur Gemini Primary (${targetModel}):`, geminiError.message);
          
          // Fallback Gemini Flash si le Pro échoue (souvent quotas ou surcharge)
          // Seulement si on n'a pas forcé un modèle spécifique qui était déjà le fallback, ou si le modèle cible était le primaire
          const shouldUseFallback = !modelOverride || modelOverride === this.primaryModelId;
          
          if (shouldUseFallback && this.fallbackModelId && this.fallbackModelId !== targetModel) {
             console.log(`🔄 Tentative Fallback Interne Gemini (${this.fallbackModelId})...`);
             try {
                return await this.executeWithRetry(async () => {
                    const model = this.genAI.getGenerativeModel({
                      model: this.fallbackModelId,
                      generationConfig: { 
                        responseMimeType: "application/json",
                        temperature: temperature 
                      },
                      systemInstruction: systemPrompt ? { role: "system", parts: [{ text: systemPrompt }] } : undefined
                    });
                    const result = await model.generateContent(prompt);
                    return JSON.parse(this.cleanJson(result.response.text()));
                });
             } catch (flashError) {
                 console.error(`❌ Erreur Gemini Fallback (${this.fallbackModelId}):`, flashError.message);
             }
          }
        }
      }

      // 2. Fallback Ultime: OpenAI GPT-4o
      if (this.openai) {
        console.log("🔄 Basculement vers OpenAI GPT-4o...");
        return await this.generateWithOpenAI(prompt, systemPrompt, true);
      }

      throw new Error("Tous les modèles IA ont échoué.");

    } catch (finalError) {
      console.error("🔥 ECHEC CRITIQUE IA:", finalError);
      throw finalError; // Propager l'erreur pour que le controller le sache
    }
  }

  /**
   * Stream text generation (Retourne un flux asynchrone)
   * @param {string} prompt
   * @param {object} options
   */
  async streamText(prompt, options = {}) {
    const { systemPrompt = "", temperature = 0.7, model: modelOverride } = options;
    const targetModel = modelOverride || this.primaryModelId;

    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: targetModel,
          generationConfig: {
            temperature: temperature
          },
          systemInstruction: systemPrompt ? {
            role: "system",
            parts: [{ text: systemPrompt }]
          } : undefined
        });

        const result = await model.generateContentStream(prompt);
        return result.stream;
      } catch (error) {
        console.error(`❌ Erreur Gemini Stream (${targetModel}):`, error.message);
        
        // Fallback Gemini Flash
        const shouldUseFallback = !modelOverride || modelOverride === this.primaryModelId;
        if (shouldUseFallback && this.fallbackModelId && this.fallbackModelId !== targetModel) {
           console.log(`🔄 Fallback Stream Gemini (${this.fallbackModelId})...`);
           const model = this.genAI.getGenerativeModel({
              model: this.fallbackModelId,
              generationConfig: { temperature },
              systemInstruction: systemPrompt ? { role: "system", parts: [{ text: systemPrompt }] } : undefined
           });
           const result = await model.generateContentStream(prompt);
           return result.stream;
        }
        throw error;
      }
    }

    if (this.openai) {
       console.log("🔄 Basculement Stream vers OpenAI GPT-4o...");
       return await this.streamWithOpenAI(prompt, systemPrompt);
    }

    throw new Error("Streaming IA indisponible");
  }

  /**
   * Fallback Streaming OpenAI
   */
  async streamWithOpenAI(prompt, systemPrompt) {
    if (!this.openai) throw new Error("OpenAI non configuré");

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const stream = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      stream: true,
      temperature: 0.7,
    });

    // Adapter le stream OpenAI pour qu'il ressemble à celui de Gemini (AsyncIterable de chunks avec text())
    async function* adapter() {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          yield { text: () => content };
        }
      }
    }

    return adapter();
  }

  /**
   * Méthode pour texte simple (non JSON)
   */
  async generateText(prompt, options = {}) {
    const { systemPrompt = "", temperature = 0.7, model: modelOverride } = options;
    const targetModel = modelOverride || this.primaryModelId;
    
    try {
      if (this.genAI) {
        try {
          return await this.executeWithRetry(async () => {
            const model = this.genAI.getGenerativeModel({
              model: targetModel,
              generationConfig: {
                temperature: temperature
              },
              systemInstruction: systemPrompt ? {
                role: "system",
                parts: [{ text: systemPrompt }]
              } : undefined
            });

            const result = await model.generateContent(prompt);
            return result.response.text();
          });
        } catch (error) {
           console.error(`❌ Erreur Gemini Text (${targetModel}):`, error.message);
           // Fallback OpenAI
        }
      }

      if (this.openai) {
        return await this.generateWithOpenAI(prompt, systemPrompt, false);
      }

      throw new Error("Service IA indisponible");
    } catch (e) {
      console.error("IA Text Error:", e);
      throw e;
    }
  }

  /**
   * Fallback OpenAI (Privé)
   */
  async generateWithOpenAI(prompt, systemPrompt, jsonMode = false) {
    if (!this.openai) throw new Error("OpenAI non configuré");

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: jsonMode ? { type: "json_object" } : { type: "text" },
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    return jsonMode ? JSON.parse(content) : content;
  }

  /**
   * Génération d'images (Wrapper Gemini Image)
   */
  async generateImage(prompt, config = {}) {
    if (!this.apiKey) throw new Error("Gemini API Key manquante");
    
    // Utiliser un modèle d'image spécifique si disponible, sinon celui par défaut
    // Note: 'imagen-3.0-generate-001' est souvent le modèle pour l'image
    const imageModel = this.models.image || 'imagen-3.0-generate-001';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict`; // Imagen utilise souvent :predict
    
    // Alternative: Si c'est un modèle Gemini multimodal qui génère des images via generateContent
    // const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${this.apiKey}`;

    // Pour l'instant, on tente le format generateContent compatible Gemini 3 (selon MD)
    const genContentUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${this.apiKey}`;

    const {
      aspectRatio = '16:9',
      imageSize = '1024x1024'
    } = config;

    // Mapping aspect ratio pour Imagen/Gemini
    // Souvent: "1:1", "16:9", "4:3", etc.
    
    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        // Paramètres spécifiques image (si supportés par le modèle)
        // Note: Certains modèles utilisent 'sampleCount', 'aspectRatio' directement
      }
    };

    try {
      console.log(`🎨 Appel Gemini Image (${imageModel})...`);
      const response = await fetch(genContentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Image API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Extraction de l'image (Base64)
      if (data.candidates && data.candidates[0]?.content?.parts) {
        const parts = data.candidates[0].content.parts;
        const imagePart = parts.find(p => p.inline_data || p.inlineData);
        
        if (imagePart) {
          const inlineData = imagePart.inline_data || imagePart.inlineData;
          const mimeType = inlineData.mime_type || inlineData.mimeType;
          const base64Data = inlineData.data;
          
          return `data:${mimeType};base64,${base64Data}`;
        }
      }
      
      // Si pas d'image inline, vérifier si c'est une URL (certains modèles)
      // ...

      throw new Error("Aucune image générée dans la réponse");

    } catch (error) {
      console.error("❌ Erreur Gemini Image:", error.message);
      
      // Fallback Replicate si configuré (via appel direct ou throw pour que le caller gère)
      // Le caller (gpt5-nano-analyzer) a déjà un fallback Replicate.
      // On throw pour déclencher le fallback du caller.
      throw error;
    }
  }
}

module.exports = new GeminiService();
