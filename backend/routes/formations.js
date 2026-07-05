/**
 * 🎓 Formations Entrepreneur BCEG — Phase 1
 * Candidature publique + gestion/sélection admin.
 */
const express = require('express');
const crypto = require('crypto');
const OpenAI = require('openai');
const supabaseService = require('../supabase-config');
const { requireAdmin, requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const { supabase } = supabaseService;

const notificationService = require('../services/notification-service');
const { renderHtmlToPdf } = require('../services/businessPlanPdf');
const mistral = require('../services/mistral-service');
const bankerService = require('../services/banker-service');
const reviewService = require('../services/review-service');

// Assistant IA des formations (gratuit, gpt-4.1-mini)
let openai = null;
if (process.env.OPENAI_API_KEY) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LEVEL_TITLES = { 1: 'Fondamentaux', 2: 'Développement', 3: 'Croissance' };

// Nom affiché de l'apprenant (depuis la candidature), best-effort
async function getLearnerName(userId) {
  const { data } = await supabase
    .from('formation_candidates')
    .select('full_name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.full_name || 'Apprenant Gabon Insight';
}

// Lundi 00:00 (UTC) de la semaine en cours
function weekStart() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}
function weekNumber() {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  return Math.floor((Date.now() - start.getTime()) / (7 * 24 * 3600 * 1000));
}

// Défi de la semaine (rotation déterministe, calculable depuis formation_progress)
const WEEKLY_CHALLENGES = [
  { id: 'modules-3', title: 'Valider 3 modules cette semaine', target: 3, metric: 'modules', reward_xp: 150 },
  { id: 'perfect-2', title: 'Obtenir 100 % à 2 QCM cette semaine', target: 2, metric: 'perfect', reward_xp: 120 },
  { id: 'modules-2', title: 'Valider 2 modules cette semaine', target: 2, metric: 'modules', reward_xp: 100 },
];

// Gamification
const XP_PER_MODULE = 100;
const XP_PERFECT_BONUS = 20;

function computeGamification(rows) {
  let xp = 0;
  let perfect = false;
  const passedByLevel = {};
  for (const r of rows) {
    xp += XP_PER_MODULE + (r.score === 100 ? XP_PERFECT_BONUS : 0);
    if (r.score === 100) perfect = true;
    passedByLevel[r.level] = (passedByLevel[r.level] || 0) + 1;
  }
  const levelUnlocked = computeUnlockedLevel(passedByLevel);
  const badges = [];
  if (rows.length >= 1) badges.push({ id: 'first-step', label: 'Premier pas', emoji: '🚀' });
  if (perfect) badges.push({ id: 'perfectionist', label: 'Sans faute', emoji: '🎯' });
  if (levelUnlocked >= 1) badges.push({ id: 'level-1', label: 'Fondamentaux', emoji: '📘' });
  if (levelUnlocked >= 2) badges.push({ id: 'level-2', label: 'Développement', emoji: '📈' });
  if (levelUnlocked >= 3) badges.push({ id: 'graduate', label: 'Entrepreneur confirmé', emoji: '🏆' });
  return { xp, badges, passedByLevel, levelUnlocked };
}

// Référentiel des niveaux (aligné sur le contenu front : 5 modules/niveau)
const LEVEL_MODULE_COUNTS = { 1: 5, 2: 5, 3: 5 };
const LEVEL_CEILINGS = {
  0: { amount: 0, label: 'Aucun palier débloqué' },
  1: { amount: 1000000, label: "Jusqu'à 1 000 000 FCFA" },
  2: { amount: 5000000, label: "Jusqu'à 5 000 000 FCFA" },
  3: { amount: 999999999, label: 'Au-delà de 5 000 000 FCFA' },
};

// Plus haut niveau CONSÉCUTIF entièrement validé
function computeUnlockedLevel(passedByLevel) {
  let unlocked = 0;
  for (let lvl = 1; lvl <= 3; lvl++) {
    if ((passedByLevel[lvl] || 0) >= (LEVEL_MODULE_COUNTS[lvl] || 9999)) unlocked = lvl;
    else break;
  }
  return unlocked;
}

// ---------- PUBLIC : déposer une candidature ----------
router.post('/candidates', async (req, res) => {
  try {
    const {
      full_name, email, phone, province, city, sector,
      project_title, project_stage, preferred_format, motivation, user_id, source,
    } = req.body || {};

    if (!full_name || !email) {
      return res.status(400).json({ success: false, error: 'Nom et e-mail requis' });
    }

    const { data, error } = await supabase
      .from('formation_candidates')
      .insert({
        user_id: user_id || null,
        full_name: String(full_name).slice(0, 200),
        email: String(email).slice(0, 200),
        phone: phone ? String(phone).slice(0, 50) : null,
        province: province || null,
        city: city ? String(city).slice(0, 120) : null,
        sector: sector || null,
        project_title: project_title ? String(project_title).slice(0, 300) : null,
        project_stage: project_stage || null,
        preferred_format: preferred_format || null,
        motivation: motivation ? String(motivation).slice(0, 4000) : null,
        source: source ? String(source).slice(0, 120) : null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;
    res.json({ success: true, id: data.id, message: 'Candidature enregistrée' });
  } catch (error) {
    console.error('❌ formations/candidates POST:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'envoi de la candidature' });
  }
});

// ---------- ADMIN : liste des candidatures ----------
router.get('/candidates', requireAdmin, async (req, res) => {
  try {
    const { status, province } = req.query;
    let q = supabase.from('formation_candidates').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (province) q = q.eq('province', province);
    const { data, error } = await q;
    if (error) throw error;

    // Compteurs par statut
    const counts = (data || []).reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});
    res.json({ success: true, candidates: data || [], counts, total: (data || []).length });
  } catch (error) {
    console.error('❌ formations/candidates GET:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ---------- ADMIN : mettre à jour le statut / notes ----------
router.patch('/candidates/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (status) {
      if (!['pending', 'selected', 'waitlist', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Statut invalide' });
      }
      patch.status = status;
    }
    if (admin_notes !== undefined) patch.admin_notes = admin_notes;

    const { data, error } = await supabase
      .from('formation_candidates')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Sélectionné → créer/activer l'inscription apprenant
    if (status === 'selected' && data?.user_id) {
      await supabase
        .from('formation_enrollments')
        .upsert({ user_id: data.user_id, candidate_id: data.id, status: 'active' }, { onConflict: 'user_id' });
    }

    res.json({ success: true, candidate: data });
  } catch (error) {
    console.error('❌ formations/candidates PATCH:', error);
    res.status(500).json({ success: false, error: 'Erreur mise à jour' });
  }
});

// ---------- APPRENANT : progression ----------
async function buildProgress(userId) {
  const { data: rows } = await supabase
    .from('formation_progress')
    .select('module_id, level, passed, score')
    .eq('user_id', userId)
    .eq('passed', true);

  const passedModuleIds = (rows || []).map((r) => r.module_id);
  const g = computeGamification(rows || []);
  return {
    passedModuleIds,
    passedByLevel: g.passedByLevel,
    levelUnlocked: g.levelUnlocked,
    ceiling: LEVEL_CEILINGS[g.levelUnlocked],
    xp: g.xp,
    badges: g.badges,
  };
}

// GET /progress : modules validés + niveau débloqué
router.get('/progress', requireAuth, async (req, res) => {
  try {
    const p = await buildProgress(req.user.id);
    res.json({ success: true, ...p });
  } catch (error) {
    console.error('❌ formations/progress GET:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Enregistre un ou plusieurs modules validés puis retourne la progression (+ notification de niveau)
async function recordPassedModules(userId, entries) {
  const before = await buildProgress(userId);

  const rows = entries.map((e) => ({
    user_id: userId,
    module_id: e.module_id,
    level: parseInt(e.level, 10),
    passed: true,
    score: typeof e.score === 'number' ? e.score : null,
    completed_at: new Date().toISOString(),
  }));
  await supabase.from('formation_progress').upsert(rows, { onConflict: 'user_id,module_id' });

  const p = await buildProgress(userId);

  // Refléter le niveau débloqué sur l'inscription (best-effort)
  await supabase
    .from('formation_enrollments')
    .upsert({ user_id: userId, level_unlocked: p.levelUnlocked, status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  // Notification si un nouveau niveau vient d'être validé
  if (p.levelUnlocked > before.levelUnlocked) {
    try {
      await notificationService.sendUserNotification(userId, {
        title: `🎉 Niveau ${p.levelUnlocked} validé !`,
        message: `Bravo ! Vous avez validé le niveau ${LEVEL_TITLES[p.levelUnlocked] || p.levelUnlocked}. Demande de financement ${p.ceiling.label.toLowerCase()} débloquée. Téléchargez votre certificat.`,
        type: 'success',
        category: 'formation',
        actionUrl: '/formations',
        actionLabel: 'Voir mon certificat',
      });
    } catch { /* best-effort */ }
  }

  await reviewService.recordActivity(userId); // streak 🔥

  return { ...p, newLevel: p.levelUnlocked > before.levelUnlocked };
}

// POST /progress : enregistrer un module validé (QCM réussi)
// Conservé pour le contenu statique (non importé en base) et les anciens bundles ;
// le parcours principal passe par /quiz/submit (correction côté serveur).
router.post('/progress', requireAuth, async (req, res) => {
  try {
    const { module_id, level, score } = req.body || {};
    if (!module_id || !level) {
      return res.status(400).json({ success: false, error: 'module_id et level requis' });
    }
    const p = await recordPassedModules(req.user.id, [{ module_id, level, score }]);
    res.json({ success: true, ...p });
  } catch (error) {
    console.error('❌ formations/progress POST:', error);
    res.status(500).json({ success: false, error: 'Erreur enregistrement' });
  }
});

// ---------- QCM corrigé côté serveur ----------
// Jetons de validation anonymes : un visiteur non connecté qui réussit un QCM reçoit
// un jeton signé (HMAC) qu'il pourra « réclamer » après création de compte.
function quizSecret() {
  return process.env.FORMATION_QUIZ_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'gabon-insight-quiz';
}
function signPassToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', quizSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyPassToken(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', quizSecret()).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.m || !p.l) return null;
    if (Date.now() - (p.t || 0) > 180 * 24 * 3600 * 1000) return null; // 6 mois max
    return p;
  } catch { return null; }
}

// POST /quiz/submit : correction serveur (public, auth optionnelle).
// Connecté + réussi → progression enregistrée directement.
// Anonyme + réussi → pass_token à réclamer via /progress/claim après inscription.
router.post('/quiz/submit', optionalAuth, async (req, res) => {
  try {
    const { module_id, level, answers } = req.body || {};
    if (!module_id) return res.status(400).json({ success: false, error: 'module_id requis' });

    const { data: course } = await supabase
      .from('formation_courses')
      .select('id, level, quiz')
      .eq('id', module_id)
      .eq('is_published', true)
      .maybeSingle();

    const qs = course?.quiz?.questions;
    if (!Array.isArray(qs) || !qs.length) {
      // Cours non importé en base → le front corrige localement (contenu statique)
      return res.json({ success: true, fallback: true });
    }

    const arr = Array.isArray(answers) ? answers : [];
    const correct = qs.reduce((n, q, i) => n + (Number(arr[i]) === q.correctIndex ? 1 : 0), 0);
    const score = Math.round((correct / qs.length) * 100);
    const passScore = course.quiz.passScore || 70;
    const passed = score >= passScore;
    const corrections = qs.map((q) => ({ correctIndex: q.correctIndex, explanation: q.explanation || null }));
    const lvl = parseInt(level, 10) || course.level;

    const out = { success: true, score, passed, passScore, corrections };
    if (req.user?.id) {
      // Révision espacée : chaque question ratée devient une carte (J+1, J+3, J+7, J+21)
      await reviewService.recordFailedQuestions(req.user.id, module_id, lvl, qs, arr);
      await reviewService.recordActivity(req.user.id);
      out.reviewsAdded = qs.length - correct;
    }
    if (passed && req.user?.id) {
      const p = await recordPassedModules(req.user.id, [{ module_id, level: lvl, score }]);
      Object.assign(out, { recorded: true, ...p });
    } else if (passed) {
      out.pass_token = signPassToken({ m: module_id, l: lvl, s: score, t: Date.now() });
    }
    res.json(out);
  } catch (error) {
    console.error('❌ formations/quiz/submit:', error);
    res.status(500).json({ success: false, error: 'Erreur correction' });
  }
});

// ---------- STREAK & RÉVISION ESPACÉE ----------
// GET /streak : série de jours d'activité (🔥) + révisions dues
router.get('/streak', requireAuth, async (req, res) => {
  try {
    const [streak, dueCount] = await Promise.all([
      reviewService.computeStreak(req.user.id),
      reviewService.countDue(req.user.id),
    ]);
    res.json({ success: true, ...streak, dueReviews: dueCount });
  } catch (error) {
    console.error('❌ formations/streak:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /reviews/due : cartes à réviser aujourd'hui (sans les réponses)
router.get('/reviews/due', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    const items = await reviewService.getDue(req.user.id, limit);
    const total = await reviewService.countDue(req.user.id);
    res.json({ success: true, items, total });
  } catch (error) {
    console.error('❌ formations/reviews/due:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /reviews/answer : corrige une carte et la reprogramme (Leitner)
router.post('/reviews/answer', requireAuth, async (req, res) => {
  try {
    const { review_id, answer } = req.body || {};
    if (!review_id) return res.status(400).json({ success: false, error: 'review_id requis' });
    const result = await reviewService.answerReview(req.user.id, review_id, answer);
    if (!result) return res.status(404).json({ success: false, error: 'Carte introuvable' });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ formations/reviews/answer:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /progress/claim : rattacher au compte les QCM réussis en anonyme (jetons signés)
router.post('/progress/claim', requireAuth, async (req, res) => {
  try {
    const tokens = Array.isArray(req.body?.tokens) ? req.body.tokens.slice(0, 60) : [];
    const claims = tokens.map(verifyPassToken).filter(Boolean);
    if (!claims.length) {
      const p = await buildProgress(req.user.id);
      return res.json({ success: true, claimed: 0, ...p });
    }
    const p = await recordPassedModules(
      req.user.id,
      claims.map((c) => ({ module_id: c.m, level: c.l, score: c.s }))
    );
    res.json({ success: true, claimed: claims.length, ...p });
  } catch (error) {
    console.error('❌ formations/progress/claim:', error);
    res.status(500).json({ success: false, error: 'Erreur enregistrement' });
  }
});

// GET /financing-access : palier de financement débloqué par la formation
router.get('/financing-access', requireAuth, async (req, res) => {
  try {
    const p = await buildProgress(req.user.id);
    res.json({
      success: true,
      level_unlocked: p.levelUnlocked,
      ceiling_amount: p.ceiling.amount,
      ceiling_label: p.ceiling.label,
    });
  } catch (error) {
    console.error('❌ formations/financing-access:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ---------- GAMIFICATION : classement national ----------
router.get('/leaderboard', requireAuth, async (req, res) => {
  try {
    const { data: rows } = await supabase
      .from('formation_progress')
      .select('user_id, level, score')
      .eq('passed', true);

    // Agrégation XP par utilisateur
    const byUser = {};
    for (const r of (rows || [])) {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    }
    const userIds = Object.keys(byUser);

    // Noms (depuis les candidatures), best-effort
    const names = {};
    if (userIds.length) {
      const { data: cands } = await supabase
        .from('formation_candidates')
        .select('user_id, full_name')
        .in('user_id', userIds);
      for (const c of (cands || [])) if (c.user_id && !names[c.user_id]) names[c.user_id] = c.full_name;
    }

    const board = userIds.map((uid) => {
      const g = computeGamification(byUser[uid]);
      return {
        user_id: uid,
        name: names[uid] || 'Entrepreneur',
        xp: g.xp,
        modules: byUser[uid].length,
        level_unlocked: g.levelUnlocked,
      };
    }).sort((a, b) => b.xp - a.xp).slice(0, 50)
      .map((u, i) => ({ rank: i + 1, ...u }));

    const me = board.find((u) => u.user_id === req.user.id) || null;
    res.json({ success: true, leaderboard: board, me });
  } catch (error) {
    console.error('❌ formations/leaderboard:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Appel IA unifié : Mistral en priorité (clé fournie), repli OpenAI.
async function aiComplete({ system, user, temperature = 0.5, maxTokens = 700 }) {
  if (mistral.isConfigured()) {
    return await mistral.chat({ system, user, temperature, maxTokens });
  }
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

const FORMATEUR_SYSTEM = `Tu es un formateur en entrepreneuriat, expert du contexte gabonais (FCFA, OHADA, marché local, financement BCEG).
Tu formes des entrepreneurs en autonomie. Sois concret, pédagogique et actionnable.
Donne des exemples adaptés au Gabon. Utilise un ton encourageant. Formate en markdown léger (listes à puces, **gras** pour les points clés).`;

// Mode « me faire réfléchir » : le tuteur guide sans donner la réponse (pattern socratique)
const SOCRATIQUE_SYSTEM = `Tu es un tuteur socratique en entrepreneuriat, expert du contexte gabonais (FCFA, OHADA, financement BCEG).
Tu ne donnes JAMAIS la réponse directement. À la place :
1) reformule la question de l'apprenant en une phrase pour vérifier sa compréhension,
2) pose 2-3 questions courtes qui le font raisonner par étapes,
3) donne UN indice concret (exemple gabonais ou ordre de grandeur en FCFA),
4) termine en l'invitant à proposer SA réponse.
Ton encourageant, 5-8 phrases max, markdown léger.`;

// ---------- ASSISTANT IA (gratuit) ----------
router.post('/ai-assist', requireAuth, async (req, res) => {
  try {
    const { question, moduleTitle, moduleSummary, projectContext, mode } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ success: false, error: 'Question requise' });
    }
    const socratic = mode === 'socratic';
    const user = `Module en cours : "${moduleTitle || 'Formation entrepreneur'}"${moduleSummary ? ` (${moduleSummary})` : ''}.
${projectContext ? `Projet de l'apprenant : ${projectContext}.\n` : ''}Question : ${question}

${socratic ? 'Guide-moi sans me donner la réponse.' : 'Réponds en 5-8 phrases max, concret et adapté au Gabon.'}`;
    const answer = await aiComplete({ system: socratic ? SOCRATIQUE_SYSTEM : FORMATEUR_SYSTEM, user, temperature: 0.5, maxTokens: 600 });
    res.json({ success: true, answer: answer || "Désolé, je n'ai pas pu répondre.", mode: socratic ? 'socratic' : 'direct' });
  } catch (error) {
    console.error('❌ formations/ai-assist:', error);
    res.status(error.message?.includes('configuré') ? 503 : 500).json({ success: false, error: 'Erreur de l\'assistant' });
  }
});

// ---------- ATELIERS PRATIQUES (livrable par module, corrigé par IA) ----------
// Le fil rouge du parcours : chaque module produit une pièce du dossier de financement.

// POST /deliverable/brief : consigne de l'atelier (cache en base si possible) + dernière soumission
router.post('/deliverable/brief', requireAuth, async (req, res) => {
  try {
    const { module_id, moduleTitle, moduleSummary, level } = req.body || {};
    if (!module_id) return res.status(400).json({ success: false, error: 'module_id requis' });

    // 1) Brief en cache sur le cours (colonne deliverable_brief, migration optionnelle)
    let brief = null; let title = moduleTitle; let summary = moduleSummary;
    try {
      const { data: course } = await supabase
        .from('formation_courses')
        .select('title, summary, deliverable_brief')
        .eq('id', module_id)
        .maybeSingle();
      if (course) { brief = course.deliverable_brief || null; title = course.title; summary = course.summary; }
    } catch { /* colonne/table absente → on génère */ }

    if (!brief) {
      brief = await aiComplete({
        system: FORMATEUR_SYSTEM,
        user: `Module "${title || module_id}"${summary ? ` — ${summary}` : ''} (niveau ${level || '?'} de la formation Entrepreneur BCEG).
Rédige la consigne d'un ATELIER PRATIQUE court que l'apprenant applique à SON propre projet, dont le résultat servira de pièce à son dossier de financement BCEG.
Format STRICT :
**🎯 Votre mission :** <1-2 phrases, action concrète appliquée à SON projet>
**À inclure :** liste de 3-4 puces précises (avec chiffres en FCFA quand pertinent)
**Exemple de format attendu :** <2-3 lignes montrant à quoi ressemble une bonne réponse>
Pas d'autre texte.`,
        temperature: 0.4, maxTokens: 450,
      });
      // Persistance best-effort (ne bloque jamais)
      try { await supabase.from('formation_courses').update({ deliverable_brief: brief }).eq('id', module_id); } catch { /* noop */ }
    }

    // 2) Dernière soumission de l'utilisateur (best-effort si table absente)
    let last = null;
    try {
      const { data } = await supabase
        .from('formation_deliverables')
        .select('content, score, feedback, updated_at')
        .eq('user_id', req.user.id)
        .eq('module_id', module_id)
        .maybeSingle();
      last = data || null;
    } catch { /* migration pas encore passée */ }

    res.json({ success: true, brief, last });
  } catch (error) {
    console.error('❌ formations/deliverable/brief:', error);
    res.status(error.message?.includes('configuré') ? 503 : 500).json({ success: false, error: 'Erreur atelier' });
  }
});

// POST /deliverable/submit : correction IA avec grille + persistance
router.post('/deliverable/submit', requireAuth, async (req, res) => {
  try {
    const { module_id, level, brief, text, moduleTitle } = req.body || {};
    if (!module_id || !text || String(text).trim().length < 30) {
      return res.status(400).json({ success: false, error: 'Rédigez votre réponse (au moins quelques phrases) avant d\'envoyer.' });
    }

    const feedback = await bankerService.completeJSON({
      system: `Tu es un formateur-évaluateur BCEG. Tu corriges le travail pratique d'un entrepreneur gabonais avec bienveillance et exigence.
Réponds en JSON STRICT :
{
  "score": <0-100>,
  "verdict": "<1 phrase de synthèse>",
  "strengths": ["<2-3 points forts>"],
  "improvements": ["<2-4 améliorations concrètes, chiffrées si possible>"],
  "next_step": "<la prochaine action à faire pour son dossier BCEG, 1 phrase>"
}
Barème : pertinence pour SON projet (40), chiffres réalistes en FCFA (30), clarté/structure (30). Un travail vague ou hors-sujet ne dépasse pas 40.`,
      user: `Module "${moduleTitle || module_id}" (niveau ${level || '?'}).
Consigne de l'atelier :
"""${String(brief || '').slice(0, 1500)}"""

Travail rendu par l'apprenant :
"""${String(text).slice(0, 4000)}"""`,
      temperature: 0.3, maxTokens: 700,
    });

    feedback.score = Math.max(0, Math.min(100, parseInt(feedback.score, 10) || 0));

    // Persistance best-effort (la table peut ne pas encore exister)
    try {
      await supabase.from('formation_deliverables').upsert({
        user_id: req.user.id,
        module_id,
        level: parseInt(level, 10) || 1,
        content: String(text).slice(0, 8000),
        score: feedback.score,
        feedback,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_id' });
    } catch (e) { console.warn('⚠️ formation_deliverables (migration ?):', e.message); }

    await reviewService.recordActivity(req.user.id); // streak 🔥

    res.json({ success: true, feedback });
  } catch (error) {
    console.error('❌ formations/deliverable/submit:', error);
    res.status(error.message?.includes('configuré') ? 503 : 500).json({ success: false, error: 'Erreur de correction' });
  }
});

// ---------- SIMULATEUR D'ENTRETIEN BANQUIER BCEG ----------
router.post('/banker/chat', requireAuth, async (req, res) => {
  try {
    const { messages, project } = req.body || {};
    const history = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .slice(-24);
    const reply = await bankerService.bankerReply({ history, project });
    res.json({ success: true, reply });
  } catch (error) {
    console.error('❌ formations/banker/chat:', error);
    res.status(error.message?.includes('configuré') ? 503 : 500).json({ success: false, error: 'Le banquier est indisponible, réessayez.' });
  }
});

router.post('/banker/evaluate', requireAuth, async (req, res) => {
  try {
    const { messages, project } = req.body || {};
    const history = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
      .slice(-30);
    if (history.filter((m) => m.role === 'user').length < 3) {
      return res.status(400).json({ success: false, error: 'Répondez à au moins 3 questions du banquier avant l\'évaluation.' });
    }
    const evaluation = await bankerService.bankerEvaluate({ history, project });
    res.json({ success: true, evaluation });
  } catch (error) {
    console.error('❌ formations/banker/evaluate:', error);
    res.status(error.message?.includes('configuré') ? 503 : 500).json({ success: false, error: 'Évaluation indisponible, réessayez.' });
  }
});

// ---------- AUTO-FORMATION : actions IA par paragraphe ----------
// action: 'deepen' (approfondir) | 'simplify' (expliquer simplement + exemple)
router.post('/ai-paragraph', requireAuth, async (req, res) => {
  try {
    const { action, paragraph, moduleTitle, level } = req.body || {};
    if (!paragraph || !String(paragraph).trim()) {
      return res.status(400).json({ success: false, error: 'Paragraphe requis' });
    }
    const ctx = `Formation entrepreneur BCEG${moduleTitle ? ` — module "${moduleTitle}"` : ''}${level ? ` (niveau ${level})` : ''}.`;

    let user;
    if (action === 'simplify') {
      user = `${ctx}
Explique TRÈS SIMPLEMENT le point ci-dessous à un entrepreneur débutant, puis donne UN exemple concret gabonais (avec des chiffres en FCFA si pertinent).
Format : 3-5 phrases simples + un exemple en bloc "**Exemple :** …".

Point à expliquer :
"""${String(paragraph).slice(0, 1500)}"""`;
    } else {
      user = `${ctx}
APPROFONDIS le point ci-dessous pour un entrepreneur qui s'auto-forme : ajoute les détails essentiels, les arguments clés, les erreurs fréquentes à éviter et 2-3 tips actionnables.
Format : markdown avec puces et **gras**, 8-12 lignes max, adapté au Gabon.

Point à approfondir :
"""${String(paragraph).slice(0, 1500)}"""`;
    }

    const answer = await aiComplete({ system: FORMATEUR_SYSTEM, user, temperature: action === 'simplify' ? 0.4 : 0.6, maxTokens: 800 });
    res.json({ success: true, action: action === 'simplify' ? 'simplify' : 'deepen', answer });
  } catch (error) {
    console.error('❌ formations/ai-paragraph:', error);
    res.status(error.message?.includes('configuré') ? 503 : 500).json({ success: false, error: 'Erreur IA' });
  }
});

// ---------- CERTIFICAT PDF par niveau ----------
function buildCertificateHtml({ name, level, levelTitle, ceiling, dateStr }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; }
  .page { width: 210mm; height: 297mm; padding: 18mm; display: flex; }
  .frame { flex: 1; border: 3px solid #697357; border-radius: 8px; padding: 16mm 14mm; text-align: center;
    display: flex; flex-direction: column; justify-content: space-between; position: relative; }
  .frame::after { content: ''; position: absolute; inset: 6px; border: 1px solid #8a9576; border-radius: 6px; pointer-events: none; }
  .brand { color: #4d553e; letter-spacing: 2px; font-size: 12pt; font-weight: bold; text-transform: uppercase; }
  .title { color: #697357; font-size: 30pt; font-weight: bold; margin: 10mm 0 4mm; }
  .sub { color: #555; font-size: 13pt; }
  .name { font-size: 26pt; color: #1f2937; margin: 8mm 0 2mm; border-bottom: 2px solid #697357; display: inline-block; padding: 0 8mm 3mm; }
  .level { font-size: 16pt; color: #4d553e; margin-top: 6mm; }
  .ceiling { display: inline-block; margin-top: 5mm; background: #697357; color: #fff; padding: 3mm 6mm; border-radius: 6px; font-size: 12pt; }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12mm; font-size: 11pt; color: #444; }
  .sig { border-top: 1px solid #999; padding-top: 2mm; min-width: 55mm; }
  </style></head><body><div class="page"><div class="frame">
    <div>
      <div class="brand">Gabon Insight × BCEG</div>
      <div class="title">Certificat de réussite</div>
      <div class="sub">Ce certificat atteste que</div>
      <div class="name">${escapeHtmlCert(name)}</div>
      <div class="sub">a validé avec succès la formation Entrepreneur BCEG</div>
      <div class="level"><b>Niveau ${level} — ${escapeHtmlCert(levelTitle)}</b></div>
      <div class="ceiling">Demande de financement débloquée : ${escapeHtmlCert(ceiling)}</div>
    </div>
    <div class="foot">
      <div class="sig">Délivré le ${escapeHtmlCert(dateStr)}</div>
      <div class="sig">Gabon Insight × BCEG</div>
    </div>
  </div></div></body></html>`;
}
function escapeHtmlCert(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

router.get('/certificate/:level', requireAuth, async (req, res) => {
  try {
    const level = parseInt(req.params.level, 10);
    if (![1, 2, 3].includes(level)) return res.status(400).json({ success: false, error: 'Niveau invalide' });

    const p = await buildProgress(req.user.id);
    if (p.levelUnlocked < level) {
      return res.status(403).json({ success: false, error: `Niveau ${level} non encore validé` });
    }

    const name = await getLearnerName(req.user.id);
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const html = buildCertificateHtml({ name, level, levelTitle: LEVEL_TITLES[level], ceiling: LEVEL_CEILINGS[level].label, dateStr });
    const pdf = await renderHtmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificat-niveau-${level}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('❌ formations/certificate:', error);
    res.status(500).json({ success: false, error: 'Erreur génération certificat' });
  }
});

// ---------- DÉFI DE LA SEMAINE ----------
router.get('/challenge', requireAuth, async (req, res) => {
  try {
    const ch = WEEKLY_CHALLENGES[weekNumber() % WEEKLY_CHALLENGES.length];
    const { data: rows } = await supabase
      .from('formation_progress')
      .select('score, completed_at')
      .eq('user_id', req.user.id)
      .eq('passed', true)
      .gte('completed_at', weekStart().toISOString());

    let current = 0;
    if (ch.metric === 'modules') current = (rows || []).length;
    else if (ch.metric === 'perfect') current = (rows || []).filter(r => r.score === 100).length;

    res.json({
      success: true,
      challenge: { id: ch.id, title: ch.title, target: ch.target, reward_xp: ch.reward_xp, current: Math.min(current, ch.target), done: current >= ch.target },
    });
  } catch (error) {
    console.error('❌ formations/challenge:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ---------- COURS EN BASE (éditables) ----------
function dbToModule(c) {
  return {
    id: c.id,
    level: c.level,
    order: c.order_index,
    title: c.title,
    summary: c.summary || '',
    durationMin: c.duration_min || 20,
    content: c.content || '',
    sector: c.sector || null,
    // Les réponses (correctIndex/explanation) ne sont JAMAIS envoyées au client :
    // la correction se fait côté serveur via POST /quiz/submit.
    quiz: {
      passScore: c.quiz?.passScore || 70,
      questions: (c.quiz?.questions || []).map((q) => ({ question: q.question, options: q.options })),
    },
  };
}

// PUBLIC : cours publiés (option ?level=N&sector=...)
router.get('/courses', async (req, res) => {
  try {
    let q = supabase.from('formation_courses').select('*').eq('is_published', true);
    if (req.query.level) q = q.eq('level', parseInt(req.query.level, 10));
    if (req.query.sector) q = q.eq('sector', String(req.query.sector));
    q = q.order('order_index', { ascending: true });
    const { data, error } = await q;
    if (error) {
      // Table absente / non migrée → repli silencieux sur le contenu statique côté front
      console.warn('⚠️ formations/courses indisponible (migration ?):', error.message);
      return res.json({ success: true, courses: [] });
    }
    res.json({ success: true, courses: (data || []).map(dbToModule) });
  } catch (error) {
    console.error('❌ formations/courses GET:', error);
    res.json({ success: true, courses: [] });
  }
});

// ADMIN : tous les cours (publiés ou non)
router.get('/admin/courses', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('formation_courses').select('*').order('level').order('order_index');
    if (error) throw error;
    res.json({ success: true, courses: data || [] });
  } catch (error) {
    console.error('❌ formations/admin/courses GET:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ADMIN : créer / mettre à jour un cours
router.post('/admin/courses', requireAdmin, async (req, res) => {
  try {
    const { id, level, order_index, title, summary, duration_min, content, quiz, is_published, sector } = req.body || {};
    if (!id || !level || !title || !content) {
      return res.status(400).json({ success: false, error: 'id, level, title, content requis' });
    }
    const row = {
      id, level: parseInt(level, 10),
      order_index: parseInt(order_index, 10) || 0,
      title, summary: summary || null,
      duration_min: parseInt(duration_min, 10) || 20,
      content,
      sector: sector || null,
      quiz: quiz || { passScore: 70, questions: [] },
      is_published: is_published !== false,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('formation_courses').upsert(row, { onConflict: 'id' }).select().single();
    if (error) throw error;
    res.json({ success: true, course: data });
  } catch (error) {
    console.error('❌ formations/admin/courses POST:', error);
    res.status(500).json({ success: false, error: 'Erreur enregistrement' });
  }
});

// ADMIN : supprimer un cours
router.delete('/admin/courses/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('formation_courses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('❌ formations/admin/courses DELETE:', error);
    res.status(500).json({ success: false, error: 'Erreur suppression' });
  }
});

// ADMIN : import en masse du contenu de démarrage (depuis le front)
router.post('/admin/courses/seed', requireAdmin, async (req, res) => {
  try {
    const { modules } = req.body || {};
    if (!Array.isArray(modules) || !modules.length) {
      return res.status(400).json({ success: false, error: 'modules[] requis' });
    }
    const rows = modules.map((m) => ({
      id: m.id,
      level: m.level,
      order_index: m.order || 0,
      title: m.title,
      summary: m.summary || null,
      duration_min: m.durationMin || 20,
      content: m.content,
      sector: m.sector || null,
      quiz: m.quiz || { passScore: 70, questions: [] },
      is_published: true,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('formation_courses').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
    res.json({ success: true, imported: rows.length });
  } catch (error) {
    console.error('❌ formations/admin/courses/seed:', error);
    res.status(500).json({ success: false, error: 'Erreur import' });
  }
});

// ADMIN : (re)génère un contenu pédagogique enrichi via Mistral et l'enregistre
// body: { id, level, title, summary?, sector?, quiz?, save? }
router.post('/admin/courses/generate', requireAdmin, async (req, res) => {
  try {
    if (!mistral.isConfigured()) {
      return res.status(503).json({ success: false, error: 'MISTRAL_API_KEY non configurée' });
    }
    const { id, level, title, summary, sector, quiz, order, durationMin, save = true } = req.body || {};
    if (!id || !level || !title) {
      return res.status(400).json({ success: false, error: 'id, level, title requis' });
    }

    const system = `Tu es un concepteur pédagogique expert en entrepreneuriat au Gabon (FCFA, OHADA, financement BCEG).
Tu rédiges des modules de formation pour des entrepreneurs qui s'auto-forment. Style clair, concret, encourageant.`;

    const user = `Rédige le CONTENU d'un module de formation.
Titre : "${title}" — niveau ${level}${sector ? ` — secteur ${sector}` : ''}.
${summary ? `Résumé : ${summary}\n` : ''}
Exigences STRICTES :
- 5 à 7 sections, chacune avec un sous-titre "### ".
- Dans chaque section : 2 à 3 paragraphes DENSES (pas de phrases creuses) + une puce "💡 **Tip :** …" (conseil actionnable) + une puce "➡️ **Essentiel :** …" (l'argument clé à retenir).
- Contenu indispensable et arguments essentiels du sujet, avec exemples concrets gabonais (chiffres en FCFA si utile).
- Markdown uniquement : ## (titre module), ### (sous-titres), - (listes), **gras**. PAS de QCM, PAS de conclusion générique.
- Longueur riche mais lisible (~700 à 1000 mots).`;

    const content = await aiComplete({ system, user, temperature: 0.6, maxTokens: 2600 });
    if (!content || content.length < 200) {
      return res.status(502).json({ success: false, error: 'Contenu généré insuffisant' });
    }

    let course = null;
    if (save) {
      const row = {
        id, level: parseInt(level, 10),
        order_index: parseInt(order, 10) || 0,
        title,
        summary: summary || null,
        duration_min: parseInt(durationMin, 10) || 25,
        content,
        sector: sector || null,
        quiz: quiz || { passScore: 70, questions: [] },
        is_published: true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('formation_courses').upsert(row, { onConflict: 'id' }).select().single();
      if (error) throw error;
      course = data;
    }

    res.json({ success: true, content, course, model: mistral.model() });
  } catch (error) {
    console.error('❌ formations/admin/courses/generate:', error);
    res.status(500).json({ success: false, error: 'Erreur génération' });
  }
});

// ADMIN : enrichit UN paragraphe (auto-formation, appels courts et progressifs)
router.post('/admin/courses/enrich-paragraph', requireAdmin, async (req, res) => {
  try {
    if (!mistral.isConfigured()) {
      return res.status(503).json({ success: false, error: 'MISTRAL_API_KEY non configurée' });
    }
    const { paragraph, moduleTitle, level, sector } = req.body || {};
    if (!paragraph || !String(paragraph).trim()) {
      return res.status(400).json({ success: false, error: 'paragraph requis' });
    }
    const system = `Tu es un concepteur pédagogique expert en entrepreneuriat au Gabon (FCFA, OHADA, financement BCEG).
Tu réécris des paragraphes de cours pour des entrepreneurs qui s'auto-forment.`;
    const user = `Contexte : module "${moduleTitle || ''}"${level ? ` (niveau ${level})` : ''}${sector ? `, secteur ${sector}` : ''}.
Réécris le paragraphe ci-dessous en PLUS RICHE et pédagogique :
- garde le même sujet (et le sous-titre "### " s'il existe) ;
- densifie en 2-3 phrases concrètes (pas de remplissage) ;
- ajoute une puce "💡 **Tip :** …" (actionnable) et une puce "➡️ **Essentiel :** …" (argument clé) ;
- exemple gabonais avec chiffres FCFA si pertinent.
Réponds UNIQUEMENT avec le markdown réécrit, sans phrase d'introduction.

Paragraphe :
"""${String(paragraph).slice(0, 1500)}"""`;

    const text = await aiComplete({ system, user, temperature: 0.5, maxTokens: 550 });
    res.json({ success: true, text: text && text.length > 20 ? text : paragraph });
  } catch (error) {
    console.error('❌ formations/admin/courses/enrich-paragraph:', error);
    res.status(500).json({ success: false, error: 'Erreur enrichissement' });
  }
});

module.exports = router;
