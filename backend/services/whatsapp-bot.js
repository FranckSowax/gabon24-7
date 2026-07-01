/**
 * Bot WhatsApp Gabon Insight — auto-formation par WhatsApp.
 * Menu : (1) me former, (2) progression/score, (3) question IA, (4) dossier.
 * Tout texte libre non reconnu => réponse IA (Mistral, repli OpenAI).
 */
const supabaseService = require('../supabase-config');
const supabase = supabaseService.supabase;
const whapi = require('./whapiService');
const mistral = require('./mistral-service');

let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch { /* openai optionnel */ }

const FRONT = (process.env.FRONTEND_URL || 'https://gaboninsight.com').replace(/\/$/, '');
const TOTAL_MODULES = 15;

const TIPS = [
  'Vendez la solution à un problème, pas juste un produit.',
  'Séparez toujours l\'argent perso de l\'argent de l\'entreprise.',
  'Un bon prix couvre les coûts + une marge + la valeur perçue.',
  'Testez votre idée avec 10 vrais clients avant d\'investir.',
  'Notez chaque entrée et sortie d\'argent, même 500 FCFA.',
];

function menuText() {
  return `👋 *Gabon Insight* — votre coach entrepreneur.

Répondez par un chiffre :
1️⃣ Me former (mini-cours)
2️⃣ Ma progression / BCEG Score
3️⃣ Poser une question à l'IA
4️⃣ Déposer un dossier de financement

Ou posez directement votre question 👇`;
}

async function aiAnswer(question) {
  const system = `Tu es un formateur en entrepreneuriat, expert du Gabon (FCFA, OHADA, financement BCEG).
Réponds sur WhatsApp : court (5-7 phrases max), concret, encourageant, avec un exemple gabonais si utile. Pas de markdown lourd.`;
  const user = `Question d'un entrepreneur : ${question}`;
  if (mistral.isConfigured()) return await mistral.chat({ system, user, temperature: 0.5, maxTokens: 500 });
  if (openai) {
    const c = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.5, max_tokens: 500,
    });
    return c.choices?.[0]?.message?.content?.trim() || '';
  }
  return "L'assistant IA est momentanément indisponible. Réessayez plus tard.";
}

// Progression formation à partir du numéro de téléphone
async function progressByPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const tail = digits.slice(-8); // 8 derniers chiffres (Gabon)
  if (!tail) return null;
  try {
    const { data: cands } = await supabase
      .from('formation_candidates')
      .select('user_id, full_name, phone')
      .not('phone', 'is', null)
      .limit(1000);
    const match = (cands || []).find(c => String(c.phone || '').replace(/\D/g, '').endsWith(tail));
    if (!match?.user_id) return { name: match?.full_name || null, passed: 0, found: !!match };
    const { data: rows } = await supabase
      .from('formation_progress')
      .select('id')
      .eq('user_id', match.user_id)
      .eq('passed', true);
    return { name: match.full_name || null, passed: (rows || []).length, found: true };
  } catch (e) {
    console.warn('⚠️ progressByPhone:', e.message);
    return null;
  }
}

async function replyFor(text, phone) {
  const t = String(text || '').trim().toLowerCase();

  if (['menu', 'bonjour', 'bonsoir', 'salut', 'start', 'aide', 'hello', 'hi', '0'].includes(t)) {
    return menuText();
  }

  if (t === '1' || t.startsWith('form')) {
    const tip = TIPS[Math.floor((Date.now() / 86400000)) % TIPS.length];
    return `🎓 *Formations Entrepreneur BCEG*
• Niveau 1 — Fondamentaux → financement jusqu'à 1 000 000 FCFA
• Niveau 2 — Développement → jusqu'à 5 000 000 FCFA
• Niveau 3 — Croissance → au-delà

👉 Continuez ici : ${FRONT}/formations

💡 Astuce : ${tip}
(Tapez *menu* pour revenir aux options.)`;
  }

  if (t === '2' || t.includes('score') || t.includes('progress')) {
    const p = await progressByPhone(phone);
    if (!p || !p.found) {
      return `📊 Je ne trouve pas encore votre profil.
Créez votre compte et candidatez : ${FRONT}/formations
Puis revenez ici pour suivre votre progression.`;
    }
    const bonjour = p.name ? `Bonjour ${p.name.split(' ')[0]},` : 'Bonjour,';
    return `📊 ${bonjour}
Progression formation : *${p.passed}/${TOTAL_MODULES}* modules validés.
${p.passed >= TOTAL_MODULES ? '🏆 Parcours complet !' : 'Continuez pour débloquer votre palier de financement.'}
Votre BCEG Score complet : ${FRONT}/business/mes-projets`;
  }

  if (t === '3' || t === 'question') {
    return `💬 Posez votre question directement (ex : "comment fixer le prix de mon plat ?") et je vous réponds.`;
  }

  if (t === '4' || t.includes('dossier') || t.includes('financ')) {
    return `📝 *Déposer un dossier de financement*
Générez votre business plan + plan d'action et soumettez-le à la BCEG :
👉 ${FRONT}/business/mes-projets
(Tapez *menu* pour les options.)`;
  }

  // Sinon : réponse IA
  const answer = await aiAnswer(text);
  return `${answer}\n\n_(Tapez *menu* pour les options.)_`;
}

// Parse le payload WHAPI et répond à chaque message texte entrant
async function handleIncoming(payload) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  for (const m of messages) {
    try {
      if (m.from_me) continue;
      if (m.type && m.type !== 'text') {
        await whapi.sendWhatsAppMessage(m.from, menuText());
        continue;
      }
      const body = m.text?.body || m.body || '';
      const from = m.from || (m.chat_id ? String(m.chat_id).split('@')[0] : null);
      if (!from || !body) continue;
      const reply = await replyFor(body, from);
      if (reply) await whapi.sendWhatsAppMessage(from, reply);
    } catch (e) {
      console.error('❌ whatsapp-bot message:', e.message);
    }
  }
}

module.exports = { handleIncoming, replyFor };
