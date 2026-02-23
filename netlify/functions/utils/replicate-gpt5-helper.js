/**
 * 🚀 Helper Replicate GPT-5 Nano pour fonctions Netlify
 * 
 * Service réutilisable pour appeler GPT-5 Nano via Replicate API
 * - 30x moins cher que GPT-3.5-turbo
 * - Qualité équivalente pour la plupart des cas
 * - Fallback automatique vers OpenAI si échec
 * 
 * Tarification:
 * - GPT-5 Nano: $0.00005/$0.00005 par 1K tokens
 * - vs GPT-3.5: $0.500/$1.500 par 1M tokens
 * - vs GPT-4o-mini: $0.150/$0.600 par 1M tokens
 */

const fetch = require('node-fetch');

/**
 * Appeler GPT-5 Nano via Replicate
 * @param {string} prompt - Prompt utilisateur
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} - Réponse avec content et usage
 */
async function callGPT5Nano(prompt, options = {}) {
  const {
    systemPrompt = 'Tu es un expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens = 800,
    temperature = 0.5,
    returnJSON = true,
    timeout = 60000 // 60 secondes max
  } = options;

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  
  if (!replicateToken) {
    throw new Error('REPLICATE_API_TOKEN manquant');
  }

  console.log('🚀 Appel GPT-5 Nano via Replicate...');
  const startTime = Date.now();

  try {
    // Créer la prédiction
    const response = await fetch('https://api.replicate.com/v1/models/openai/gpt-5-nano/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          max_tokens: maxTokens,
          temperature: temperature,
          top_p: 0.9,
          reasoning_effort: 'minimal', // Plus rapide
          verbosity: 'medium',
          system_prompt: systemPrompt
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
    }

    let prediction = await response.json();
    console.log('📊 Prediction créée:', prediction.id, 'status:', prediction.status);

    // Attendre la complétion si nécessaire
    if (prediction.status !== 'succeeded') {
      const pollUrl = prediction.urls.get;
      let attempts = 0;
      const maxAttempts = Math.floor(timeout / 2000); // 2s par tentative
      
      while (attempts < maxAttempts && prediction.status !== 'succeeded') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pollResponse = await fetch(pollUrl, {
          headers: { 'Authorization': `Token ${replicateToken}` }
        });
        
        prediction = await pollResponse.json();
        attempts++;
        
        console.log(`⏳ Tentative ${attempts}/${maxAttempts} - Status: ${prediction.status}`);
        
        if (prediction.status === 'failed' || prediction.status === 'canceled') {
          throw new Error(`Prédiction échouée: ${prediction.error || prediction.status}`);
        }
      }
      
      if (prediction.status !== 'succeeded') {
        throw new Error('Timeout: génération trop longue');
      }
    }

    // Extraire le contenu
    let content = '';
    if (Array.isArray(prediction.output)) {
      content = prediction.output.join('').trim();
    } else if (typeof prediction.output === 'string') {
      content = prediction.output.trim();
    } else if (prediction.output?.text) {
      content = prediction.output.text.trim();
    } else {
      throw new Error('Format de sortie GPT-5 inattendu');
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ GPT-5 Nano réponse reçue en ${elapsed}ms`);
    console.log(`📝 Longueur: ${content.length} caractères`);

    // Parser JSON si demandé
    let parsedContent = content;
    if (returnJSON) {
      try {
        // Essayer de parser directement
        parsedContent = JSON.parse(content);
      } catch {
        // Extraire JSON depuis bloc de code
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            parsedContent = JSON.parse(jsonMatch[1]);
          } catch {
            // Chercher objet/array JSON
            const objMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (objMatch) {
              parsedContent = JSON.parse(objMatch[0]);
            } else {
              throw new Error('Impossible de parser le JSON de la réponse');
            }
          }
        } else {
          // Chercher objet/array JSON
          const objMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (objMatch) {
            parsedContent = JSON.parse(objMatch[0]);
          } else {
            throw new Error('Impossible de parser le JSON de la réponse');
          }
        }
      }
    }

    // Estimer les tokens (approximation)
    const estimatedPromptTokens = Math.ceil(prompt.length / 4);
    const estimatedCompletionTokens = Math.ceil(content.length / 4);
    const estimatedTotalTokens = estimatedPromptTokens + estimatedCompletionTokens;

    return {
      content: parsedContent,
      rawContent: content,
      usage: {
        prompt_tokens: estimatedPromptTokens,
        completion_tokens: estimatedCompletionTokens,
        total_tokens: estimatedTotalTokens
      },
      model: 'gpt-5-nano',
      provider: 'replicate',
      elapsed_ms: elapsed
    };

  } catch (error) {
    console.error('❌ Erreur GPT-5 Nano:', error.message);
    throw error;
  }
}

/**
 * Appeler Gemini 3 Pro
 * @param {string} prompt - Prompt utilisateur
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} - Réponse avec content et usage
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

  console.log('♊ Appel Gemini 3 Pro...');
  const startTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`;
  
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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const elapsed = Date.now() - startTime;

  // Extraire le contenu
  let content = '';
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    content = data.candidates[0].content.parts.map(p => p.text).join('');
  } else {
    throw new Error('Aucun contenu généré par Gemini');
  }

  console.log(`✅ Gemini réponse reçue en ${elapsed}ms`);

  // Parser JSON si demandé
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

  // Estimation des tokens (Gemini ne retourne pas toujours les tokens)
  const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4);

  return {
    content: parsedContent,
    raw: content,
    usage: {
      prompt_tokens: Math.ceil(prompt.length / 4),
      completion_tokens: Math.ceil(content.length / 4),
      total_tokens: estimatedTokens
    },
    model: 'gemini-3-pro',
    provider: 'gemini',
    elapsed_ms: elapsed
  };
}

/**
 * Appeler Kimi K2.5 (Moonshot AI, OpenAI-compatible)
 */
async function callKimi(prompt, options = {}) {
  const {
    systemPrompt = 'Tu es un expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens = 800,
    temperature = 0.5,
    returnJSON = true
  } = options;

  const kimiApiKey = process.env.KIMI_API_KEY;
  if (!kimiApiKey) throw new Error('KIMI_API_KEY manquant');

  console.log('🌙 Appel Kimi K2.5...');
  const startTime = Date.now();

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${kimiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kimi-k2.5-preview',
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
    throw new Error(`Kimi API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const elapsed = Date.now() - startTime;
  console.log(`✅ Kimi réponse reçue en ${elapsed}ms`);

  let parsedContent = content;
  if (returnJSON) {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      parsedContent = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser le JSON de la réponse Kimi');
      }
    }
  }

  return {
    content: parsedContent,
    rawContent: content,
    usage: data.usage || { prompt_tokens: Math.ceil(prompt.length / 4), completion_tokens: Math.ceil(content.length / 4), total_tokens: Math.ceil((prompt.length + content.length) / 4) },
    model: 'kimi-k2.5-preview',
    provider: 'kimi',
    elapsed_ms: elapsed
  };
}

/**
 * Appeler IA avec fallback: Kimi K2.5 → Gemini → Replicate → OpenAI
 * @param {string} prompt - Prompt utilisateur
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} - Réponse avec content et usage
 */
async function callGPT5NanoWithFallback(prompt, options = {}) {
  const {
    fallbackToOpenAI = true,
    openaiModel = 'gpt-4o-mini',
    preferredProvider = null,
    preferredModel = null,
    ...gpt5Options
  } = options;

  // 1. Primary: Kimi K2.5
  if (process.env.KIMI_API_KEY) {
    try {
      console.log('🌙 Utilisation de Kimi K2.5 (modèle principal)');
      return await callKimi(prompt, gpt5Options);
    } catch (error) {
      console.error('⚠️ Kimi échoué:', error.message);
    }
  }

  // 2. Fallback: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('♊ Fallback Gemini...');
      return await callGemini(prompt, gpt5Options);
    } catch (error) {
      console.error('⚠️ Gemini échoué:', error.message);
    }
  }

  // 3. Fallback: GPT-5 Nano (Replicate)
  try {
    return await callGPT5Nano(prompt, gpt5Options);
  } catch (error) {
    console.error('⚠️ GPT-5 Nano échoué:', error.message);

    if (!fallbackToOpenAI || !process.env.OPENAI_API_KEY) {
      throw error;
    }

    // 4. Last resort: OpenAI
    console.log('🔄 Fallback vers OpenAI', openaiModel);
    return await callOpenAI(prompt, { ...gpt5Options, model: openaiModel });
  }
}

/**
 * Fallback OpenAI (pour compatibilité)
 * @param {string} prompt - Prompt utilisateur
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} - Réponse avec content et usage
 */
async function callOpenAI(prompt, options = {}) {
  const {
    systemPrompt = 'Tu es un expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens = 800,
    temperature = 0.5,
    model = 'gpt-4o-mini',
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
      const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser le JSON de la réponse');
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
 * Calculer le coût estimé
 * @param {Object} usage - Objet usage avec prompt_tokens et completion_tokens
 * @param {string} provider - 'replicate' ou 'openai'
 * @param {string} model - Nom du modèle
 * @returns {Object} - Coûts détaillés
 */
function calculateCost(usage, provider = 'replicate', model = 'gpt-5-nano') {
  const { prompt_tokens = 0, completion_tokens = 0 } = usage;

  const pricing = {
    replicate: {
      'gpt-5-nano': { input: 0.00005, output: 0.00005 } // par 1K tokens
    },
    openai: {
      'gpt-4o-mini': { input: 0.150, output: 0.600 }, // par 1M tokens
      'gpt-3.5-turbo': { input: 0.500, output: 1.500 } // par 1M tokens
    },
    gemini: {
      'gemini-3-pro': { input: 0.25, output: 0.50 }, // $0.25/$0.50 par 1M tokens
    }
  };

  let rates = pricing[provider]?.[model];
  if (!rates) {
    rates = pricing.replicate['gpt-5-nano'];
  }

  let inputCost, outputCost;
  
  if (provider === 'replicate') {
    // Replicate: prix par 1K tokens
    inputCost = (prompt_tokens / 1000) * rates.input;
    outputCost = (completion_tokens / 1000) * rates.output;
  } else {
    // OpenAI et Gemini: prix par 1M tokens
    inputCost = (prompt_tokens / 1000000) * rates.input;
    outputCost = (completion_tokens / 1000000) * rates.output;
  }

  return {
    input_cost: inputCost,
    output_cost: outputCost,
    total_cost: inputCost + outputCost,
    provider: provider,
    model: model
  };
}

module.exports = {
  callGPT5Nano,
  callGPT5NanoWithFallback,
  callOpenAI,
  callGemini,
  callKimi,
  calculateCost
};
