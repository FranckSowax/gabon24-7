/**
 * 🚀 Helper IA pour fonctions Netlify
 *
 * Architecture:
 * 1. Primary: OpenAI GPT-4.1-mini
 * 2. Fallback: Google Gemini
 *
 * Tarification GPT-4.1-mini:
 * - Input: $0.40 / 1M tokens
 * - Output: $1.60 / 1M tokens
 */

const fetch = require('node-fetch');

/**
 * Appeler OpenAI GPT-4.1-mini
 */
async function callOpenAI(prompt, options = {}) {
  const {
    systemPrompt = 'Tu es un expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens = 800,
    temperature = 0.5,
    model = 'gpt-4.1-mini',
    returnJSON = true
  } = options;

  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY manquant');
  }

  console.log(`🤖 Appel OpenAI ${model}...`);
  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const elapsed = Date.now() - startTime;

  console.log(`✅ OpenAI réponse reçue en ${elapsed}ms`);

  // Parser JSON si demandé
  let parsedContent = content;
  if (returnJSON) {
    try {
      parsedContent = JSON.parse(content);
    } catch {
      // Extraire JSON depuis bloc de code
      const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      try {
        parsedContent = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Impossible de parser le JSON de la réponse');
        }
      }
    }
  }

  return {
    content: parsedContent,
    rawContent: content,
    usage: data.usage,
    model: model,
    provider: 'openai',
    elapsed_ms: elapsed
  };
}

/**
 * Appeler Gemini (fallback)
 */
async function callGemini(prompt, options = {}) {
  const {
    systemPrompt = 'Tu es un expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens = 800,
    temperature = 1.0,
    returnJSON = true
  } = options;

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY manquant');
  }

  console.log('♊ Appel Gemini (fallback)...');
  const startTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: returnJSON ? 'application/json' : 'text/plain'
    }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const elapsed = Date.now() - startTime;

  let content = '';
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    content = data.candidates[0].content.parts.map(p => p.text).join('');
  } else {
    throw new Error('Aucun contenu généré par Gemini');
  }

  console.log(`✅ Gemini réponse reçue en ${elapsed}ms`);

  let parsedContent = content;
  if (returnJSON) {
    try {
      parsedContent = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser le JSON de la réponse Gemini');
      }
    }
  }

  const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4);

  return {
    content: parsedContent,
    raw: content,
    usage: {
      prompt_tokens: Math.ceil(prompt.length / 4),
      completion_tokens: Math.ceil(content.length / 4),
      total_tokens: estimatedTokens
    },
    model: 'gemini-2.0-flash',
    provider: 'gemini',
    elapsed_ms: elapsed
  };
}

/**
 * Appeler IA avec fallback: OpenAI GPT-4.1-mini → Gemini
 * Fonction principale utilisée par toutes les fonctions Netlify
 */
async function callGPT5NanoWithFallback(prompt, options = {}) {
  const {
    fallbackToOpenAI = true,
    openaiModel = 'gpt-4.1-mini',
    ...restOptions
  } = options;

  // 1. Primary: OpenAI GPT-4.1-mini
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('🤖 Utilisation de OpenAI GPT-4.1-mini (modèle principal)');
      return await callOpenAI(prompt, { ...restOptions, model: openaiModel });
    } catch (error) {
      console.error('⚠️ OpenAI échoué:', error.message);
    }
  }

  // 2. Fallback: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('♊ Fallback Gemini...');
      return await callGemini(prompt, restOptions);
    } catch (error) {
      console.error('⚠️ Gemini échoué:', error.message);
    }
  }

  throw new Error('Aucun service IA disponible (OPENAI_API_KEY et GEMINI_API_KEY manquants)');
}

/**
 * Calculer le coût estimé
 */
function calculateCost(usage, provider = 'openai', model = 'gpt-4.1-mini') {
  const { prompt_tokens = 0, completion_tokens = 0 } = usage;

  const pricing = {
    openai: {
      'gpt-4.1-mini': { input: 0.40, output: 1.60 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o': { input: 2.50, output: 10.00 },
    },
    gemini: {
      'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    }
  };

  let rates = pricing[provider]?.[model];
  if (!rates) {
    rates = pricing.openai['gpt-4.1-mini'];
  }

  // Tous les prix sont par 1M tokens
  const inputCost = (prompt_tokens / 1000000) * rates.input;
  const outputCost = (completion_tokens / 1000000) * rates.output;

  return {
    input_cost: inputCost,
    output_cost: outputCost,
    total_cost: inputCost + outputCost,
    provider: provider,
    model: model
  };
}

module.exports = {
  callGPT5NanoWithFallback,
  callOpenAI,
  callGemini,
  calculateCost
};
