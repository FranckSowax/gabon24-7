/**
 * Service Mistral AI — génération de formations + assistants IA.
 * Clé : MISTRAL_API_KEY. Modèle : MISTRAL_MODEL (défaut mistral-large-latest).
 */
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

function isConfigured() {
  return !!process.env.MISTRAL_API_KEY;
}

function model() {
  return process.env.MISTRAL_MODEL || 'mistral-large-latest';
}

/**
 * Chat completion Mistral.
 * @param {{ system?:string, user:string, temperature?:number, maxTokens?:number, json?:boolean }} opts
 * @returns {Promise<string>} contenu texte
 */
async function chat({ system, user, temperature = 0.6, maxTokens = 1200, json = false }) {
  if (!isConfigured()) throw new Error('MISTRAL_API_KEY manquante');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const body = { model: model(), temperature, max_tokens: maxTokens, messages };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Mistral ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
}

/** Chat renvoyant un objet JSON (response_format json_object). */
async function chatJSON(opts) {
  const raw = await chat({ ...opts, json: true });
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { chat, chatJSON, isConfigured, model };
