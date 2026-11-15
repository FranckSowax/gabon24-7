/**
 * Fournisseur des appels d'IA texte pour les fonctions Netlify.
 * Même règle que le serveur (backend/services/ai-provider.js) : OpenRouter et
 * GLM 5.3 Flash dès que OPENROUTER_API_KEY est posée, sinon l'ancienne clé
 * OpenAI. Les fonctions Netlify n'embarquent pas le SDK : appel HTTP direct.
 *
 * Le raisonnement de GLM 5.3 Flash est obligatoire et compte dans `max_tokens` :
 * on demande l'effort le plus bas et on ajoute une marge fixe.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'z-ai/glm-5.3-flash';
const LEGACY_OPENAI_MODEL = 'gpt-4.1-mini';
const REASONING_EFFORTS = ['low', 'high', 'max'];
const REASONING_HEADROOM_TOKENS = 4000;

function getAiProvider(env = process.env) {
  if (env.OPENROUTER_API_KEY) {
    const effort = String(env.AI_REASONING_EFFORT || '').toLowerCase();
    return {
      name: 'openrouter',
      apiKey: env.OPENROUTER_API_KEY,
      url: OPENROUTER_URL,
      model: env.AI_MODEL || DEFAULT_OPENROUTER_MODEL,
      reasoningEffort: REASONING_EFFORTS.includes(effort) ? effort : 'low',
      headers: { 'HTTP-Referer': 'https://gaboninsight.com', 'X-Title': 'Gabon Insight' },
    };
  }
  if (env.OPENAI_API_KEY) {
    return { name: 'openai', apiKey: env.OPENAI_API_KEY, url: OPENAI_URL, model: LEGACY_OPENAI_MODEL, headers: {} };
  }
  return null;
}

function isAiConfigured(env = process.env) {
  return getAiProvider(env) !== null;
}

function adaptChatParams(params, provider) {
  const input = params || {};
  if (provider.name !== 'openrouter') return { ...input, model: input.model || provider.model };
  const adapted = { ...input, model: provider.model, reasoning: { effort: provider.reasoningEffort } };
  if (Number.isFinite(input.max_tokens) && input.max_tokens > 0) {
    adapted.max_tokens = input.max_tokens + REASONING_HEADROOM_TOKENS;
  }
  return adapted;
}

/**
 * Envoie une demande au format OpenAI et renvoie la réponse HTTP brute, pour
 * que l'appelant garde sa gestion des codes (429, erreurs).
 */
async function fetchChatCompletion(params, env = process.env) {
  const provider = getAiProvider(env);
  if (!provider) throw new Error('Service IA non configuré');
  return fetch(provider.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json', ...provider.headers },
    body: JSON.stringify(adaptChatParams(params, provider)),
  });
}

module.exports = { getAiProvider, isAiConfigured, adaptChatParams, fetchChatCompletion, DEFAULT_OPENROUTER_MODEL };
