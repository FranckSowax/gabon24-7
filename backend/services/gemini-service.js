/**
 * 🤖 SERVICE IA ROBUSTE (Wrapper Unifié)
 *
 * Architecture:
 * 1. Primary: OpenAI GPT-4.1-mini
 * 2. Fallback: Google Gemini via SDK @google/generative-ai
 *
 * Features:
 * - Retry Pattern (Exponential Backoff)
 * - JSON Sanitization
 * - Automatic fallback on errors (429/503)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
require('dotenv').config();

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;

    // Modèle principal: OpenAI GPT-4.1-mini
    this.openaiModel = 'gpt-4.1-mini';

    // Modèles Gemini (fallback)
    this.models = {
      text: 'gemini-2.0-flash',
      image: 'gemini-2.0-flash'
    };

    this.primaryModelId = this.models.text;

    // Initialisation OpenAI (Primary)
    if (this.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: this.openaiApiKey });
      console.log(`✅ OpenAI ${this.openaiModel} initialisé (modèle principal)`);
    } else {
      console.warn('⚠️ OPENAI_API_KEY non configuré - Service IA principal désactivé');
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
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) return jsonMatch[0];
      return cleaned;
    }
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
   * Ordre: OpenAI GPT-4.1-mini → Gemini
   */
  async generateJSON(prompt, options = {}) {
    if (typeof options === 'string') {
      options = { systemPrompt: options };
    }

    const { systemPrompt = "", temperature = 0.7, model = null } = options;

    // Modèle demandé → choix du provider (Gemini si "gemini*", sinon OpenAI).
    // Sans modèle explicite : comportement historique (OpenAI puis Gemini).
    const wantGemini = model ? String(model).startsWith('gemini') : false;
    const geminiModelId = wantGemini ? model : this.primaryModelId;

    const tryOpenAI = () => this.executeWithRetry(() =>
      this.generateWithOpenAI(prompt, systemPrompt, true, temperature));

    const tryGemini = () => this.executeWithRetry(async () => {
      const m = this.genAI.getGenerativeModel({
        model: geminiModelId,
        generationConfig: { responseMimeType: "application/json", temperature },
        systemInstruction: systemPrompt ? { role: "system", parts: [{ text: systemPrompt }] } : undefined,
      });
      const result = await m.generateContent(prompt);
      return JSON.parse(this.cleanJson(result.response.text()));
    });

    // Ordre des providers : le modèle demandé en premier, l'autre en repli.
    const chain = wantGemini
      ? [['Gemini', this.genAI, tryGemini, geminiModelId], ['OpenAI', this.openai, tryOpenAI, this.openaiModel]]
      : [['OpenAI', this.openai, tryOpenAI, this.openaiModel], ['Gemini', this.genAI, tryGemini, geminiModelId]];

    try {
      for (const [name, client, fn, modelId] of chain) {
        if (!client) continue;
        try {
          return await fn();
        } catch (err) {
          console.error(`❌ Erreur ${name} (${modelId}):`, err.message);
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
   * Ordre: OpenAI → Gemini
   */
  async streamText(prompt, options = {}) {
    const { systemPrompt = "", temperature = 0.7 } = options;

    // 1. Primary: OpenAI streaming
    if (this.openai) {
      try {
        return await this.streamWithOpenAI(prompt, systemPrompt, temperature);
      } catch (error) {
        console.error(`❌ Erreur OpenAI Stream:`, error.message);
      }
    }

    // 2. Fallback: Gemini streaming
    if (this.genAI) {
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
    }

    throw new Error("Streaming IA indisponible");
  }

  /**
   * Streaming OpenAI
   */
  async streamWithOpenAI(prompt, systemPrompt, temperature = 0.7) {
    if (!this.openai) throw new Error("OpenAI non configuré");

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const stream = await this.openai.chat.completions.create({
      model: this.openaiModel,
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
   * Ordre: OpenAI → Gemini
   */
  async generateText(prompt, options = {}) {
    const { systemPrompt = "", temperature = 0.7 } = options;

    try {
      // 1. Primary: OpenAI
      if (this.openai) {
        try {
          return await this.executeWithRetry(async () => {
            return await this.generateWithOpenAI(prompt, systemPrompt, false, temperature);
          });
        } catch (error) {
          console.error(`❌ Erreur OpenAI Text:`, error.message);
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
   * Appel OpenAI GPT-4.1-mini (JSON ou texte)
   */
  async generateWithOpenAI(prompt, systemPrompt, jsonMode = false, temperature = 0.7) {
    if (!this.openai) throw new Error("OpenAI non configuré");

    const messages = [];
    if (systemPrompt) {
      const suffix = jsonMode ? ' Réponds UNIQUEMENT en JSON valide, sans markdown ni commentaire.' : '';
      messages.push({ role: "system", content: systemPrompt + suffix });
    } else if (jsonMode) {
      messages.push({ role: "system", content: "Réponds UNIQUEMENT en JSON valide, sans markdown ni commentaire." });
    }
    messages.push({ role: "user", content: prompt });

    const completion = await this.openai.chat.completions.create({
      model: this.openaiModel,
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
