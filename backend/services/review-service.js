/**
 * Révision espacée (système de Leitner) + streaks d'apprentissage.
 * Chaque question de QCM ratée devient une carte de révision reprogrammée
 * à J+1 → J+3 → J+7 → J+21 (bonne réponse = boîte suivante, erreur = retour boîte 1).
 * Tables : formation_reviews, formation_activity (migration 20260707) — tout est
 * best-effort : sans migration, les fonctions échouent en silence.
 */
const supabaseService = require('../supabase-config');
const supabase = supabaseService.supabase;

const BOX_INTERVALS_DAYS = { 1: 1, 2: 3, 3: 7, 4: 21 }; // boîte → prochain délai
const MAX_BOX = 4;

function nextDue(box) {
  const days = BOX_INTERVALS_DAYS[Math.min(box, MAX_BOX)] || 21;
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
}

/** Jour UTC (YYYY-MM-DD) */
function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// ---------- Activité quotidienne & streak ----------
async function recordActivity(userId) {
  if (!userId) return;
  try {
    await supabase.from('formation_activity').upsert(
      { user_id: userId, day: utcDay() },
      { onConflict: 'user_id,day', ignoreDuplicates: true }
    );
  } catch { /* migration pas encore passée */ }
}

/**
 * Streak = jours consécutifs d'activité (aujourd'hui non compté comme rupture
 * tant que la journée n'est pas finie). Gel automatique : 1 jour manqué pardonné
 * par tranche de 7 jours comptés.
 */
async function computeStreak(userId) {
  try {
    const { data } = await supabase
      .from('formation_activity')
      .select('day')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .limit(400);
    const days = new Set((data || []).map((r) => String(r.day)));
    if (!days.size) return { current: 0, best: 0, todayDone: false };

    const todayDone = days.has(utcDay());
    const dayMs = 24 * 3600 * 1000;

    // Série courante (part d'aujourd'hui ou d'hier)
    let current = 0;
    let freezes = 1;
    let cursor = new Date();
    if (!todayDone) cursor = new Date(cursor.getTime() - dayMs);
    while (true) {
      if (days.has(utcDay(cursor))) {
        current += 1;
        if (current % 7 === 0) freezes += 1; // un gel regagné chaque semaine tenue
        cursor = new Date(cursor.getTime() - dayMs);
      } else if (freezes > 0 && days.has(utcDay(new Date(cursor.getTime() - dayMs)))) {
        freezes -= 1; // gel : on pardonne UN jour manqué isolé
        cursor = new Date(cursor.getTime() - dayMs);
      } else break;
      if (current > 400) break;
    }

    // Meilleure série historique (stricte, sans gel — simple et suffisant)
    const sorted = [...days].sort();
    let best = 0; let run = 0; let prev = null;
    for (const d of sorted) {
      run = (prev && (new Date(d) - new Date(prev)) === dayMs) ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    }

    return { current, best: Math.max(best, current), todayDone };
  } catch {
    return { current: 0, best: 0, todayDone: false };
  }
}

// ---------- Cartes de révision ----------
/** Après un QCM corrigé serveur : chaque question ratée devient une carte. */
async function recordFailedQuestions(userId, moduleId, level, questions, answers) {
  if (!userId || !Array.isArray(questions)) return;
  const rows = [];
  questions.forEach((q, i) => {
    if (Number(answers?.[i]) === q.correctIndex) return;
    rows.push({
      user_id: userId,
      module_id: moduleId,
      question_index: i,
      question: {
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || null,
        level: parseInt(level, 10) || 1,
      },
      box: 1,
      due_at: nextDue(1),
      last_result: false,
      updated_at: new Date().toISOString(),
    });
  });
  if (!rows.length) return;
  try {
    await supabase.from('formation_reviews').upsert(rows, { onConflict: 'user_id,module_id,question_index' });
  } catch (e) { console.warn('⚠️ formation_reviews (migration ?):', e.message); }
}

/** Cartes dues (sans la réponse — la correction se fait côté serveur). */
async function getDue(userId, limit = 10) {
  try {
    const { data } = await supabase
      .from('formation_reviews')
      .select('id, module_id, question, box, due_at')
      .eq('user_id', userId)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(limit);
    return (data || []).map((r) => ({
      id: r.id,
      module_id: r.module_id,
      box: r.box,
      question: r.question?.question,
      options: r.question?.options || [],
      level: r.question?.level || 1,
    }));
  } catch { return []; }
}

async function countDue(userId) {
  try {
    const { count } = await supabase
      .from('formation_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('due_at', new Date().toISOString());
    return count || 0;
  } catch { return 0; }
}

/** Corrige une carte et la reprogramme (Leitner). */
async function answerReview(userId, reviewId, answerIndex) {
  const { data: row } = await supabase
    .from('formation_reviews')
    .select('id, box, reps, question')
    .eq('id', reviewId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!row) return null;

  const q = row.question || {};
  const correct = Number(answerIndex) === q.correctIndex;
  const box = correct ? Math.min((row.box || 1) + 1, MAX_BOX) : 1;

  await supabase.from('formation_reviews').update({
    box,
    due_at: nextDue(box),
    last_result: correct,
    reps: (row.reps || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);

  await recordActivity(userId);

  return {
    correct,
    correctIndex: q.correctIndex,
    explanation: q.explanation || null,
    box,
    nextInDays: BOX_INTERVALS_DAYS[box] || 21,
    mastered: correct && box === MAX_BOX,
  };
}

// ---------- Rappel WhatsApp quotidien ----------
/**
 * Envoie un rappel aux apprenants qui ont des cartes dues ET un téléphone
 * renseigné dans leur candidature. Appelé par un cron quotidien.
 */
async function sendDailyReviewReminders() {
  const whapi = require('./whapiService');
  const FRONT = (process.env.FRONTEND_URL || 'https://gaboninsight.com').replace(/\/$/, '');
  let sent = 0;
  try {
    const { data: due } = await supabase
      .from('formation_reviews')
      .select('user_id')
      .lte('due_at', new Date().toISOString())
      .limit(2000);
    const counts = {};
    for (const r of (due || [])) counts[r.user_id] = (counts[r.user_id] || 0) + 1;
    const userIds = Object.keys(counts);
    if (!userIds.length) return { sent: 0 };

    const { data: cands } = await supabase
      .from('formation_candidates')
      .select('user_id, phone, full_name')
      .in('user_id', userIds)
      .not('phone', 'is', null);

    for (const c of (cands || [])) {
      const n = counts[c.user_id];
      if (!n || !c.phone) continue;
      const prenom = c.full_name ? c.full_name.split(' ')[0] : '';
      const msg = `🧠 ${prenom ? prenom + ', v' : 'V'}os révisions du jour vous attendent !
*${n} question${n > 1 ? 's' : ''}* à revoir pour ancrer vos acquis (2 min).
👉 ${FRONT}/formations/revisions
Ou tapez *6* ici pour réviser directement sur WhatsApp. 🔥 Gardez votre série !`;
      try {
        await whapi.sendWhatsAppMessage(c.phone, msg);
        sent += 1;
      } catch (e) { console.warn('⚠️ rappel révision KO pour', c.user_id, e.message); }
    }
  } catch (e) { console.warn('⚠️ sendDailyReviewReminders:', e.message); }
  return { sent };
}

module.exports = {
  recordActivity,
  computeStreak,
  recordFailedQuestions,
  getDue,
  countDue,
  answerReview,
  sendDailyReviewReminders,
  BOX_INTERVALS_DAYS,
};
