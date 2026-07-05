/**
 * Simulateur d'entretien banquier BCEG — partagé entre la route /formations/banker
 * et le bot WhatsApp. L'IA joue un chargé d'affaires qui challenge le business plan,
 * puis délivre une évaluation notée (grille sur 100).
 */
const mistral = require('./mistral-service');

let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch { /* openai optionnel */ }

const BANKER_SYSTEM = `Tu es M. Ndong, chargé d'affaires senior à la BCEG (financement des entrepreneurs au Gabon).
Tu conduis un ENTRETIEN DE FINANCEMENT exigeant mais bienveillant, en français.
Règles strictes :
- UNE seule question à la fois, réponses courtes (3-6 phrases).
- Challenge les chiffres : prix de vente, marges, charges fixes, trésorerie, CA prévisionnel réaliste.
- Creuse les points faibles : concurrence, saisonnalité, recouvrement des créances, dépendance à un fournisseur, séparation argent perso/entreprise.
- Reste ancré dans la réalité gabonaise (FCFA, OHADA, marché local).
- Si une réponse est vague, demande des précisions chiffrées.
- Après 8-10 échanges, si l'essentiel est couvert, propose au candidat de conclure l'entretien pour recevoir son évaluation.
Ne donne JAMAIS de note pendant l'entretien.`;

const EVAL_SYSTEM = `Tu es un comité de crédit BCEG. À partir de la transcription d'un entretien de financement,
tu produis une évaluation JSON STRICTE (aucun texte hors JSON) selon ce schéma :
{
  "global_score": <0-100>,
  "decision": "favorable" | "favorable_avec_reserves" | "a_retravailler",
  "grid": [
    { "critere": "Solidité du modèle économique", "note": <0-20>, "commentaire": "<1 phrase>" },
    { "critere": "Maîtrise des chiffres", "note": <0-20>, "commentaire": "<1 phrase>" },
    { "critere": "Connaissance du marché et de la concurrence", "note": <0-20>, "commentaire": "<1 phrase>" },
    { "critere": "Gestion des risques", "note": <0-20>, "commentaire": "<1 phrase>" },
    { "critere": "Clarté et posture du candidat", "note": <0-20>, "commentaire": "<1 phrase>" }
  ],
  "points_forts": ["<2-4 items>"],
  "points_faibles": ["<2-4 items>"],
  "recommandations": ["<3-5 actions concrètes avant de déposer le dossier BCEG>"]
}
Sois juste : un candidat vague ou sans chiffres ne peut pas dépasser 50/100.`;

function transcript(history) {
  return (history || [])
    .slice(-24)
    .map((m) => `${m.role === 'assistant' ? 'Banquier' : 'Candidat'} : ${String(m.content || '').slice(0, 1200)}`)
    .join('\n');
}

function projectLine(project) {
  if (!project) return '';
  const parts = [];
  if (project.title) parts.push(`projet « ${project.title} »`);
  if (project.sector) parts.push(`secteur ${project.sector}`);
  if (project.amount) parts.push(`financement souhaité : ${project.amount} FCFA`);
  return parts.length ? `Contexte candidat : ${parts.join(', ')}.\n` : '';
}

async function complete({ system, user, temperature = 0.6, maxTokens = 500 }) {
  if (mistral.isConfigured()) return await mistral.chat({ system, user, temperature, maxTokens });
  if (openai) {
    const c = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature, max_tokens: maxTokens,
    });
    return c.choices?.[0]?.message?.content?.trim() || '';
  }
  throw new Error('Aucun fournisseur IA configuré');
}

async function completeJSON({ system, user, temperature = 0.3, maxTokens = 900 }) {
  if (mistral.isConfigured()) return await mistral.chatJSON({ system, user, temperature, maxTokens });
  if (openai) {
    const c = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature, max_tokens: maxTokens,
    });
    return JSON.parse(c.choices?.[0]?.message?.content || '{}');
  }
  throw new Error('Aucun fournisseur IA configuré');
}

/** Tour de parole du banquier. history = [{role:'user'|'assistant', content}] */
async function bankerReply({ history, project }) {
  const user = `${projectLine(project)}Entretien jusqu'ici :
${transcript(history) || '(le candidat vient d\'arriver)'}

Réponds en tant que banquier : réagis brièvement à la dernière réponse du candidat puis pose UNE question.`;
  return await complete({ system: BANKER_SYSTEM, user, temperature: 0.6, maxTokens: 400 });
}

/** Évaluation finale notée. */
async function bankerEvaluate({ history, project }) {
  const user = `${projectLine(project)}Transcription complète de l'entretien :
${transcript(history)}

Produis l'évaluation JSON.`;
  const out = await completeJSON({ system: EVAL_SYSTEM, user, temperature: 0.3, maxTokens: 1000 });
  // Garde-fous sur la forme
  out.global_score = Math.max(0, Math.min(100, parseInt(out.global_score, 10) || 0));
  if (!Array.isArray(out.grid)) out.grid = [];
  if (!Array.isArray(out.points_forts)) out.points_forts = [];
  if (!Array.isArray(out.points_faibles)) out.points_faibles = [];
  if (!Array.isArray(out.recommandations)) out.recommandations = [];
  return out;
}

module.exports = { bankerReply, bankerEvaluate, completeJSON, BANKER_SYSTEM };
