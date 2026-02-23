/**
 * 🤖 SERVICE IA ROBUSTE (Wrapper Unifié)
 *
 * Architecture:
 * 1. Primary: Kimi K2.5 (Moonshot AI - rapide, performant, OpenAI-compatible)
 * 2. Fallback: Google Gemini via SDK @google/generative-ai
 *
 * Features:
 * - Retry Pattern (Exponential Backoff)
 * - JSON Sanitization
 * - Strict Types
 * - Automatic fallback on errors (429/503)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
require('dotenv').config();

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.kimiApiKey = process.env.KIMI_API_KEY;

    // Modèle principal: Kimi K2.5 (Moonshot AI)
    this.kimiModel = 'kimi-k2.5-preview';

    // Modèles Gemini (fallback)
    this.models = {
      text: 'gemini-flash-latest',
      textFallback: 'gemini-1.5-flash',
      image: 'gemini-flash-latest'
    };

    this.primaryModelId = process.env.GEMINI_MODEL_NAME || this.models.text;
    this.fallbackModelId = this.models.textFallback;

    // Initialisation Kimi K2.5 (Primary)
    if (this.kimiApiKey) {
      this.kimi = new OpenAI({ apiKey: this.kimiApiKey, baseURL: 'https://api.moonshot.ai/v1' });
      console.log(`✅ Kimi ${this.kimiModel} initialisé (modèle principal)`);
    } else {
      console.warn('⚠️ KIMI_API_KEY non configuré - Kimi K2.5 indisponible');
    }

    // Initialisation Google Gemini (Fallback)
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      console.log(`✅ Gemini ${this.primaryModelId} disponible comme fallback`);
    } else {
      console.warn('⚠️ GEMINI_API_KEY non configuré - Fallback Gemini désactivé');
    }
  }

  /**
   * Nettoie le JSON brut retourné par le LLM
   */
  cleanJson(text) {
    if (!text) return "";
    let cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
    return cleaned.trim();
  }

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
        const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes('timeout') || error.message?.includes('quota') || error.message?.includes('rate_limit');

        if (attempt < maxRetries && isRetryable) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée. Retry in ${delay}ms... (${error.message})`);
          await this.sleep(delay);
        } else {
          if (!isRetryable) break;
        }
      }
    }
    throw lastError;
  }

  /**
   * Méthode principale pour obtenir du JSON
   * Ordre: Kimi K2.5 → Gemini Primary → Gemini Fallback
   */
  async generateJSON(prompt, options = {}) {
    if (typeof options === 'string') {
      options = { systemPrompt: options };
    }

    const { systemPrompt = "", temperature = 0.7 } = options;

    try {
      // 1. Primary: Kimi K2.5
      if (this.kimi) {
        try {
          return await this.executeWithRetry(async () => {
            return await this.generateWithKimi(prompt, systemPrompt, true, temperature);
          });
        } catch (kimiError) {
          console.error(`❌ Erreur Kimi ${this.kimiModel}:`, kimiError.message);
        }
      }

      // 2. Fallback: Gemini Primary
      if (this.genAI) {
        try {
          return await this.executeWithRetry(async () => {
            const model = this.genAI.getGenerativeModel({
              model: this.primaryModelId,
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
            return JSON.parse(this.cleanJson(result.response.text()));
          });
        } catch (geminiError) {
          console.error(`❌ Erreur Gemini (${this.primaryModelId}):`, geminiError.message);

          // 3. Fallback: Gemini Secondary
          if (this.fallbackModelId && this.fallbackModelId !== this.primaryModelId) {
            console.log(`🔄 Fallback Gemini (${this.fallbackModelId})...`);
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

      throw new Error("Tous les modèles IA ont échoué.");

    } catch (finalError) {
      console.error("🔥 ECHEC CRITIQUE IA:", finalError);
      throw finalError;
    }
  }

  /**
   * Stream text generation
   * Ordre: Kimi K2.5 → Gemini
   */
  async streamText(prompt, options = {}) {
    const { systemPrompt = "", temperature = 0.7 } = options;

    // 1. Primary: Kimi streaming
    if (this.kimi) {
      try {
        return await this.streamWithKimi(prompt, systemPrompt, temperature);
      } catch (error) {
        console.error(`❌ Erreur Kimi Stream:`, error.message);
      }
    }

    // 2. Fallback: Gemini streaming
    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: this.primaryModelId,
          generationConfig: { temperature },
          systemInstruction: systemPrompt ? {
            role: "system",
            parts: [{ text: systemPrompt }]
          } : undefined
        });

        const result = await model.generateContentStream(prompt);
        return result.stream;
      } catch (error) {
        console.error(`❌ Erreur Gemini Stream (${this.primaryModelId}):`, error.message);

        if (this.fallbackModelId && this.fallbackModelId !== this.primaryModelId) {
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

    throw new Error("Streaming IA indisponible");
  }

  /**
   * Streaming Kimi K2.5
   */
  async streamWithKimi(prompt, systemPrompt, temperature = 0.7) {
    if (!this.kimi) throw new Error("Kimi non configuré");

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const stream = await this.kimi.chat.completions.create({
      model: this.kimiModel,
      messages: messages,
      stream: true,
      temperature: temperature,
    });

    // Adapter le stream pour ressembler à Gemini (AsyncIterable avec text())
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
   * Ordre: Kimi → Gemini
   */
  async generateText(prompt, options = {}) {
    const { systemPrompt = "", temperature = 0.7 } = options;

    try {
      // 1. Primary: Kimi
      if (this.kimi) {
        try {
          return await this.executeWithRetry(async () => {
            return await this.generateWithKimi(prompt, systemPrompt, false, temperature);
          });
        } catch (error) {
          console.error(`❌ Erreur Kimi Text:`, error.message);
        }
      }

      // 2. Fallback: Gemini
      if (this.genAI) {
        return await this.executeWithRetry(async () => {
          const model = this.genAI.getGenerativeModel({
            model: this.primaryModelId,
            generationConfig: { temperature },
            systemInstruction: systemPrompt ? {
              role: "system",
              parts: [{ text: systemPrompt }]
            } : undefined
          });

          const result = await model.generateContent(prompt);
          return result.response.text();
        });
      }

      throw new Error("Service IA indisponible");
    } catch (e) {
      console.error("IA Text Error:", e);
      throw e;
    }
  }

  /**
   * Appel Kimi K2.5 (JSON ou texte)
   */
  async generateWithKimi(prompt, systemPrompt, jsonMode = false, temperature = 0.7) {
    if (!this.kimi) throw new Error("Kimi non configuré");

    const messages = [];
    if (systemPrompt) {
      const suffix = jsonMode ? ' Réponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.' : '';
      messages.push({ role: "system", content: systemPrompt + suffix });
    } else if (jsonMode) {
      messages.push({ role: "system", content: "Réponds UNIQUEMENT en JSON valide, sans markdown ni commentaire." });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await this.kimi.chat.completions.create({
      model: this.kimiModel,
      messages: messages,
      temperature: temperature,
    });

    const content = completion.choices[0].message.content;
    if (jsonMode) {
      const cleaned = this.cleanJson(content);
      return JSON.parse(cleaned);
    }
    return content;
  }

  /**
   * Génération d'images (Gemini uniquement)
   */
  async generateImage(prompt, config = {}) {
    if (!this.apiKey) throw new Error("Gemini API Key manquante pour la génération d'images");

    const imageModel = this.models.image || 'imagen-3.0-generate-001';
    const genContentUrl = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {}
    };

    try {
      console.log(`🎨 Appel Gemini Image (${imageModel})...`);
      const response = await fetch(genContentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Image API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

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

      throw new Error("Aucune image générée dans la réponse");

    } catch (error) {
      console.error("❌ Erreur Gemini Image:", error.message);
      throw error;
    }
  }
}

module.exports = new GeminiService();
