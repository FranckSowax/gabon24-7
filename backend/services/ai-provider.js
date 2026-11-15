/**
 * Fournisseur des appels d'IA texte (analyses, résumés, assistants).
 *
 * Tous les appels passent par OpenRouter, avec le modèle GLM 5.3 Flash de Z.ai.
 * Les fichiers appelants gardent leur code : ils reçoivent un client au format
 * OpenAI, et ce module ajuste chaque demande pour le fournisseur réel.
 *
 * WHY (repli) : tant que OPENROUTER_API_KEY n'est pas posée sur le serveur,
 * le module continue d'utiliser OPENAI_API_KEY comme avant. La bascule se fait
 * donc en posant la clé, sans coupure au déploiement.
 *
 * WHY (raisonnement) : sur GLM 5.3 Flash le raisonnement est obligatoire et
 * compte dans `max_tokens`. Un appel qui demande 10 jetons (une catégorie, un
 * oui/non) reviendrait vide. On demande donc l'effort le plus bas et on ajoute
 * une marge fixe à `max_tokens`.
 *
 * Non concernés : la génération d'images et la recherche web, qui ne sont pas
 * des appels de texte et gardent leur fournisseur.
 *
 * @example
 *   const { createAiClient } = require('./services/ai-provider');
 *   const ai = createAiClient({ timeout: 60000 });
 *   const completion = await ai.chat.completions.create({ messages, max_tokens: 200 });
 */

const OpenAI = require('openai');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'z-ai/glm-5.3-flash';
const LEGACY_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_REASONING_EFFORT = 'low';
const REASONING_EFFORTS = ['low', 'high', 'max'];
const REASONING_HEADROOM_TOKENS = 4000;

// En-têtes d'identification demandés par OpenRouter (facultatifs, non secrets).
const OPENROUTER_HEADERS = { 'HTTP-Referer': 'https://gaboninsight.com', 'X-Title': 'Gabon Insight' };

/**
 * Fournisseur actif d'après l'environnement, ou null si aucune clé n'est posée.
 * La clé n'est jamais journalisée.
 */
function getAiProvider(env = process.env) {
  if (env.OPENROUTER_API_KEY) {
    const effort = String(env.AI_REASONING_EFFORT || '').toLowerCase();
    return {
      name: 'openrouter',
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      model: env.AI_MODEL || DEFAULT_OPENROUTER_MODEL,
      reasoningEffort: REASONING_EFFORTS.includes(effort) ? effort : DEFAULT_REASONING_EFFORT,
      headers: OPENROUTER_HEADERS,
    };
  }
  if (env.OPENAI_API_KEY) {
    return { name: 'openai', apiKey: env.OPENAI_API_KEY, baseURL: undefined, model: LEGACY_OPENAI_MODEL, headers: {} };
  }
  return null;
}

/** Vrai si un fournisseur d'IA texte est configuré. */
function isAiConfigured(env = process.env) {
  return getAiProvider(env) !== null;
}

/** Nom du modèle réellement utilisé (pour les journaux et les enregistrements). */
function getAiModel(env = process.env) {
  const provider = getAiProvider(env);
  return provider ? provider.model : null;
}

/**
 * Ajuste une demande au format OpenAI pour le fournisseur actif.
 * Avec OpenRouter : le modèle est toujours celui configuré (les anciens noms
 * « gpt-… » laissés dans le code sont ignorés), l'effort de raisonnement est
 * fixé et `max_tokens` reçoit la marge de raisonnement.
 */
function adaptChatParams(params, provider) {
  const input = params || {};
  if (!provider || provider.name !== 'openrouter') {
    return { ...input, model: input.model || (provider ? provider.model : LEGACY_OPENAI_MODEL) };
  }
  const adapted = { ...input, model: provider.model, reasoning: { effort: provider.reasoningEffort } };
  if (Number.isFinite(input.max_tokens) && input.max_tokens > 0) {
    adapted.max_tokens = input.max_tokens + REASONING_HEADROOM_TOKENS;
  }
  return adapted;
}

/**
 * Client au format OpenAI branché sur le fournisseur actif, ou null si aucun
 * n'est configuré. Les options (timeout, maxRetries) sont celles du SDK.
 */
function createAiClient(options = {}, env = process.env) {
  const provider = getAiProvider(env);
  if (!provider) return null;

  const client = new OpenAI({
    ...options,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    defaultHeaders: { ...provider.headers, ...(options.defaultHeaders || {}) },
  });
  const create = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = (params, requestOptions) => create(adaptChatParams(params, provider), requestOptions);
  return client;
}

/**
 * Appel direct, pour le code qui n'a pas besoin de garder un client.
 * Lève une erreur si aucun fournisseur n'est configuré.
 */
async function chatCompletion(params, options = {}, env = process.env) {
  const client = createAiClient(options, env);
  if (!client) throw new Error('Service IA non configuré');
  return client.chat.completions.create(params);
}

module.exports = {
  getAiProvider,
  isAiConfigured,
  getAiModel,
  adaptChatParams,
  createAiClient,
  chatCompletion,
  DEFAULT_OPENROUTER_MODEL,
  LEGACY_OPENAI_MODEL,
  REASONING_HEADROOM_TOKENS,
};
