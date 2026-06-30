/**
 * 🎓 Formations Entrepreneur BCEG — Phase 1
 * Candidature publique + gestion/sélection admin.
 */
const express = require('express');
const OpenAI = require('openai');
const supabaseService = require('../supabase-config');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();
const { supabase } = supabaseService;

// Assistant IA des formations (gratuit, gpt-4.1-mini)
let openai = null;
if (process.env.OPENAI_API_KEY) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      project_title, project_stage, preferred_format, motivation, user_id,
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

// POST /progress : enregistrer un module validé (QCM réussi)
router.post('/progress', requireAuth, async (req, res) => {
  try {
    const { module_id, level, score } = req.body || {};
    if (!module_id || !level) {
      return res.status(400).json({ success: false, error: 'module_id et level requis' });
    }

    await supabase
      .from('formation_progress')
      .upsert({
        user_id: req.user.id,
        module_id,
        level: parseInt(level, 10),
        passed: true,
        score: typeof score === 'number' ? score : null,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_id' });

    const p = await buildProgress(req.user.id);

    // Refléter le niveau débloqué sur l'inscription (best-effort)
    await supabase
      .from('formation_enrollments')
      .upsert({ user_id: req.user.id, level_unlocked: p.levelUnlocked, status: 'active', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    res.json({ success: true, ...p });
  } catch (error) {
    console.error('❌ formations/progress POST:', error);
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

// ---------- ASSISTANT IA (gratuit) ----------
router.post('/ai-assist', requireAuth, async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ success: false, error: 'Assistant indisponible' });
    const { question, moduleTitle, moduleSummary, projectContext } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ success: false, error: 'Question requise' });
    }

    const system = `Tu es un formateur en entrepreneuriat, expert du contexte gabonais (FCFA, OHADA, marché local, BCEG).
Tu réponds à un apprenant pendant un module de formation. Sois concret, pédagogique et bref (5-8 phrases max).
Donne des exemples adaptés au Gabon. Reste dans le cadre du module et de l'entrepreneuriat.`;

    const user = `Module en cours : "${moduleTitle || 'Formation entrepreneur'}"${moduleSummary ? ` (${moduleSummary})` : ''}.
${projectContext ? `Projet de l'apprenant : ${projectContext}.\n` : ''}Question : ${question}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.5,
      max_tokens: 500,
    });
    const answer = completion.choices?.[0]?.message?.content?.trim() || "Désolé, je n'ai pas pu répondre.";
    res.json({ success: true, answer });
  } catch (error) {
    console.error('❌ formations/ai-assist:', error);
    res.status(500).json({ success: false, error: 'Erreur de l\'assistant' });
  }
});

module.exports = router;
