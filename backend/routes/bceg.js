/**
 * BCEG Project — endpoints Phase 2
 *
 *   POST /api/bceg/simulate    Calcule mensualité crédit BCEG
 *   POST /api/bceg/score       Calcule le BCEG Score (0-100) d'un projet
 *   GET  /api/bceg/stats       Stats globales pour les compteurs landing
 *   GET  /api/bceg/my-score    Dernier score connu d'un projet user
 *   GET  /api/bceg/leaderboard Top projets anonymisés (Phase 5 — placeholder ici)
 */

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateBcegDossier } = require('../services/bcegPdfService');

const supabase = supabaseService.supabase;
const BCEG_TARGET_EMAIL = process.env.BCEG_TARGET_EMAIL || 'commercial@bceg.ga';

/**
 * Accès au portail BCEG : autorisé si un code partagé valide est fourni
 * (header x-bceg-code ou ?code=) OU si l'utilisateur est un admin authentifié.
 * Le code est défini via la variable d'env BCEG_PORTAL_CODE (Railway).
 */
async function requireBcegAccess(req, res, next) {
  const code = req.headers['x-bceg-code'] || req.query.code;
  if (process.env.BCEG_PORTAL_CODE && code && code === process.env.BCEG_PORTAL_CODE) {
    req.user = req.user || { id: null };
    req.bcegPortal = true;
    return next();
  }
  return requireAdmin(req, res, next);
}

/**
 * Annonce la décision BCEG au porteur du projet sur 3 canaux (best-effort) :
 * notification in-app, WhatsApp (si numéro connu), email (SendGrid).
 * Ne notifie que pour les statuts in_review / accepted / rejected.
 */
async function notifyApplicantOfDecision({ submission, status }) {
  const result = { inApp: false, whatsapp: false, email: false };
  const userId = submission?.user_id;
  const reference = submission?.bceg_reference;
  const adminNotes = submission?.admin_notes;

  const titleMap = {
    in_review: 'Votre dossier BCEG est en cours d\'examen',
    accepted: '🎉 Votre dossier BCEG est accepté',
    rejected: 'Votre dossier BCEG nécessite une révision',
  };
  const msgMap = {
    in_review: 'La BCEG a bien reçu votre dossier et l\'examine actuellement. Vous serez notifié de la décision.',
    accepted: `Félicitations ! La BCEG a accepté votre dossier de financement${reference ? ` (réf. ${reference})` : ''}.${adminNotes ? `\n\n${adminNotes}` : ''}`,
    rejected: `La BCEG a examiné votre dossier et demande des compléments ou corrections.${adminNotes ? `\n\nMotif : ${adminNotes}` : ''}`,
  };
  const title = titleMap[status];
  const message = msgMap[status];
  if (!userId || !title) return result;

  const actionUrl = submission.project_id
    ? `/business/mes-projets/${submission.project_id}/dossier-bceg`
    : '/business/mes-projets';

  // 1. Notification in-app
  try {
    const notificationService = require('../services/notification-service');
    await notificationService.sendUserNotification(userId, {
      title, message,
      type: status === 'accepted' ? 'success' : status === 'rejected' ? 'warning' : 'info',
      category: 'bceg',
      priority: 'high',
      actionUrl,
      actionLabel: 'Voir mon dossier',
      referenceType: 'bceg_submission',
      referenceId: submission.id,
    });
    result.inApp = true;
  } catch (e) { console.warn('⚠️ Notif in-app décision échouée:', e.message); }

  // Récupérer email + téléphone du porteur
  let email = null, phone = null;
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    email = data?.user?.email || null;
  } catch (e) { console.warn('⚠️ getUserById échoué:', e.message); }
  try {
    const { data: pref } = await supabase
      .from('user_sector_preferences')
      .select('whatsapp_phone')
      .eq('user_id', userId)
      .not('whatsapp_phone', 'is', null)
      .limit(1)
      .maybeSingle();
    phone = pref?.whatsapp_phone || null;
  } catch (e) { /* table optionnelle */ }

  // 2. WhatsApp
  if (phone) {
    try {
      const whapiService = require('../services/whapiService');
      await whapiService.sendWhatsAppMessage(phone, `*${title}*\n\n${message}\n\n_Gabon Insight × BCEG_`);
      result.whatsapp = true;
    } catch (e) { console.warn('⚠️ WhatsApp décision échoué:', e.message); }
  }

  // 3. Email
  if (email && process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
        subject: `[BCEG] ${title}`,
        text: `${message}\n\nConsultez votre dossier : https://gaboninsight.com${actionUrl}`,
      });
      result.email = true;
    } catch (e) { console.warn('⚠️ Email décision échoué:', e.message); }
  }

  return result;
}

// ==================== SCHÉMAS DE VALIDATION (Zod) ====================
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

const uuidOpt = z.string().uuid().optional().nullable();

// .passthrough() : valide les champs clés sans retirer les autres (handlers à colonnes explicites)
const simulateSchema = z.object({
  project_id: uuidOpt,
  type: z.string().max(30).optional(),
  revenu_mensuel: z.coerce.number().nonnegative().max(1e12).optional().nullable(),
  montant_demande: z.coerce.number().positive('montant_demande doit être > 0').max(1e12),
  apport_personnel: z.coerce.number().nonnegative().max(1e12).optional(),
  duree_mois: z.coerce.number().int().positive().max(600).optional(),
  taux_annuel: z.coerce.number().nonnegative().max(100).optional(),
  persist: z.boolean().optional(),
}).passthrough();

const scoreSchema = z.object({
  project_id: uuidOpt,
  step: z.coerce.number().int().min(1).max(20).optional(),
  persist: z.boolean().optional(),
}).passthrough(); // le reste du body alimente le calcul du score

const submitSchema = z.object({
  project_id: uuidOpt,
  simulation_id: uuidOpt,
  montant_demande: z.coerce.number().positive('montant_demande doit être > 0').max(1e12),
  bceg_score: z.coerce.number().min(0).max(100).optional().nullable(),
  pdf_url: z.string().max(2000).optional().nullable(),
}).passthrough();

const dossierSchema = z.object({
  project_id: z.string().uuid('project_id invalide'),
  simulation_id: uuidOpt,
}).passthrough();

const mentorChatSchema = z.object({
  message: z.string().min(1, 'message requis').max(4000),
  history: z.array(z.any()).max(50).optional(),
  project_context: z.any().optional().nullable(),
}).passthrough();

const appointmentSchema = z.object({
  project_id: uuidOpt,
  submission_id: uuidOpt,
  appointment_date: z.string().min(1, 'appointment_date requis').max(40),
  appointment_time: z.string().min(1, 'appointment_time requis').max(20),
  topic: z.string().max(500).optional().nullable(),
  user_name: z.string().max(200).optional().nullable(),
  user_phone: z.string().max(40).optional().nullable(),
}).passthrough();

const signUploadSchema = z.object({
  doc_type: z.string().min(1, 'doc_type requis').max(100),
  file_name: z.string().min(1, 'file_name requis').max(255),
}).passthrough();

const dueDiligenceSchema = z.object({
  doc_type: z.string().min(1, 'doc_type requis').max(100),
  file_url: z.string().max(2000).optional().nullable(),
  file_name: z.string().max(255).optional().nullable(),
  file_size: z.coerce.number().int().nonnegative().optional().nullable(),
  mime_type: z.string().max(150).optional().nullable(),
  project_id: uuidOpt,
  submission_id: uuidOpt,
}).passthrough();

const sectorPrefSchema = z.object({
  sectors: z.array(z.string().max(100)).max(50).optional(),
  whatsapp_phone: z.string().max(40).optional().nullable(),
  notify_via_whatsapp: z.boolean().optional(),
  notify_via_email: z.boolean().optional(),
}).passthrough();

const sponsorshipSchema = z.object({
  campaign_name: z.string().min(1, 'campaign_name requis').max(200),
  description: z.string().max(5000).optional().nullable(),
  credits_offered: z.coerce.number().int().nonnegative().optional().nullable(),
  total_budget: z.coerce.number().nonnegative().optional().nullable(),
  target_sectors: z.array(z.string().max(100)).max(50).optional(),
  ends_at: z.string().max(40).optional().nullable(),
  status: z.string().max(30).optional(),
}).passthrough();

const grantSchema = z.object({
  user_id: z.string().uuid('user_id invalide'),
  reason: z.string().max(1000).optional().nullable(),
}).passthrough();

const submissionStatusSchema = z.object({
  status: z.string().min(1, 'status requis').max(40),
  admin_notes: z.string().max(5000).optional().nullable(),
  bceg_reference: z.string().max(200).optional().nullable(),
}).passthrough();

// PATCH admin qui spread req.body → schéma SANS passthrough : les colonnes inconnues
// sont retirées (anti-injection de colonnes Supabase).
const adminAppointmentUpdateSchema = z.object({
  status: z.string().max(40).optional(),
  admin_notes: z.string().max(5000).optional(),
  banker_name: z.string().max(200).optional(),
  location: z.string().max(300).optional(),
  meeting_link: z.string().max(500).optional(),
  appointment_date: z.string().max(40).optional(),
  appointment_time: z.string().max(20).optional(),
  topic: z.string().max(500).optional(),
});

const adminDueDiligenceUpdateSchema = z.object({
  status: z.string().max(40).optional(),
  admin_notes: z.string().max(5000).optional(),
  rejection_reason: z.string().max(2000).optional(),
});

// =====================================================================
// HELPERS — calculs financiers et scoring
// =====================================================================

/**
 * Mensualité d'un crédit amortissable (annuité constante).
 * principal: montant emprunté après apport
 * tauxAnnuelPct: taux annuel en % (ex: 5 pour 5%)
 * dureeMois: durée en mois
 */
function computeMensualite(principal, tauxAnnuelPct, dureeMois) {
  if (principal <= 0 || dureeMois <= 0) return 0;
  if (tauxAnnuelPct === 0) return principal / dureeMois;
  const r = tauxAnnuelPct / 100 / 12;
  const m = principal * r / (1 - Math.pow(1 + r, -dureeMois));
  return Math.round(m);
}

/**
 * Calcule un BCEG Score 0-100 à partir des données projet.
 * 4 axes pondérés sur 25 points chacun.
 */
function computeBcegScore(input) {
  const {
    funding_needed,
    revenue_model,
    pricing_strategy,
    target_audience,
    market_size,
    unique_value,
    short_term_goals,
    success_metrics,
    risks,
    key_skills,
    location,
    project_idea,
    project_vision,
    apport_pct,
    bceg_priority_sector,
    has_garanties,
  } = input || {};

  const lenScore = (s, min = 30, max = 200) => {
    if (!s || typeof s !== 'string') return 0;
    const len = s.trim().length;
    if (len < min) return Math.round((len / min) * 25);
    if (len <= max) return 25;
    return 25;
  };

  // Axe 1 : viabilité financière (sur 25)
  let viabilite = 0;
  viabilite += Math.min(10, lenScore(revenue_model, 20, 150) / 25 * 10);
  viabilite += Math.min(8, lenScore(pricing_strategy, 20, 150) / 25 * 8);
  viabilite += funding_needed ? 7 : 0;
  viabilite = Math.min(25, Math.round(viabilite));

  // Axe 2 : secteur prioritaire BCEG (sur 25)
  let secteur = bceg_priority_sector ? 25 : 0;
  if (!bceg_priority_sector) {
    const haystack = `${project_idea || ''} ${project_vision || ''} ${unique_value || ''} ${location || ''}`.toLowerCase();
    const keywords = [
      'agriculture', 'agro', 'élevage', 'pêche',
      'commerce', 'pme', 'pmi', 'industrie',
      'tourisme', 'artisanat', 'transport',
      'énergie', 'numérique', 'tech', 'digital',
      'santé', 'éducation', 'formation',
      'bâtiment', 'btp', 'immobilier',
    ];
    const hits = keywords.filter(k => haystack.includes(k)).length;
    secteur = Math.min(25, hits * 5);
  }

  // Axe 3 : capacité de remboursement (sur 25)
  let remboursement = 0;
  if (apport_pct !== undefined && apport_pct !== null) {
    if (apport_pct >= 40) remboursement += 18;
    else if (apport_pct >= 30) remboursement += 15;
    else if (apport_pct >= 20) remboursement += 10;
    else if (apport_pct >= 10) remboursement += 5;
  }
  remboursement += Math.min(7, lenScore(revenue_model, 30, 150) / 25 * 7);
  remboursement = Math.min(25, Math.round(remboursement));

  // Axe 4 : complétude du dossier / garanties (sur 25)
  let completude = 0;
  completude += lenScore(target_audience, 20, 100) > 15 ? 5 : 0;
  completude += lenScore(market_size, 15, 80) > 10 ? 4 : 0;
  completude += lenScore(unique_value, 20, 100) > 15 ? 4 : 0;
  completude += lenScore(short_term_goals, 20, 150) > 15 ? 4 : 0;
  completude += lenScore(success_metrics, 15, 100) > 10 ? 3 : 0;
  completude += lenScore(risks, 15, 100) > 10 ? 3 : 0;
  completude += (Array.isArray(key_skills) && key_skills.length >= 2) ? 2 : 0;
  if (has_garanties) completude += 3;
  completude = Math.min(25, completude);

  const score = viabilite + secteur + remboursement + completude;
  const color = score >= 70 ? 'green' : score >= 45 ? 'orange' : 'red';

  return {
    score,
    color,
    breakdown: {
      viabilite_financiere: viabilite,
      secteur_prioritaire: secteur,
      capacite_remboursement: remboursement,
      garanties_completude: completude,
    },
    advice: buildAdvice({ viabilite, secteur, remboursement, completude }),
  };
}

function buildAdvice(b) {
  const tips = [];
  if (b.viabilite < 15) tips.push({ axis: 'Viabilité financière', tip: 'Détaille ton modèle de revenus et ta stratégie de prix.' });
  if (b.secteur < 10) tips.push({ axis: 'Secteur', tip: 'Précise dans quel secteur prioritaire BCEG (agriculture, PME, tourisme…) ton projet s\'inscrit.' });
  if (b.remboursement < 15) tips.push({ axis: 'Remboursement', tip: 'Augmente ton apport personnel (idéalement 20-30 %) pour rassurer la BCEG.' });
  if (b.completude < 15) tips.push({ axis: 'Dossier', tip: 'Complète les sections marché, audience cible et indicateurs de succès.' });
  if (tips.length === 0) tips.push({ axis: 'Excellent', tip: 'Ton dossier est prêt à être soumis à la BCEG !' });
  return tips;
}

// =====================================================================
// Volet FORMATION du BCEG Score
// La formation suivie devient un critère de préqualification : le score
// final = 60 % projet + 40 % formation (modules validés + QCM + profil).
// =====================================================================
const TOTAL_FORMATION_MODULES = 15; // 3 niveaux × 5 modules
const SCORE_WEIGHTS = { project: 0.6, formation: 0.4 };

function colorFor(score) {
  return score >= 70 ? 'green' : score >= 45 ? 'orange' : 'red';
}

async function computeFormationScore(userId) {
  const empty = {
    score: 0,
    breakdown: { formation_modules: 0, resultats_qcm: 0, profil_complet: 0 },
    meta: { passed: 0, total: TOTAL_FORMATION_MODULES, avgQcm: null, hasProfile: false },
  };
  if (!userId) return empty;

  try {
    // Progression : modules validés + scores QCM
    const { data: rows } = await supabase
      .from('formation_progress')
      .select('score, passed')
      .eq('user_id', userId)
      .eq('passed', true);
    const passed = (rows || []).length;
    const scored = (rows || []).filter(r => typeof r.score === 'number');
    const avgQcm = scored.length
      ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length)
      : null;

    // Profil : candidature formation renseignée
    const { data: cand } = await supabase
      .from('formation_candidates')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    const hasProfile = !!cand;

    const formation_modules = Math.min(55, Math.round((passed / TOTAL_FORMATION_MODULES) * 55));
    const resultats_qcm = avgQcm != null ? Math.min(35, Math.round((avgQcm / 100) * 35)) : 0;
    const profil_complet = hasProfile ? 10 : 0;
    const score = Math.min(100, formation_modules + resultats_qcm + profil_complet);

    return {
      score,
      breakdown: { formation_modules, resultats_qcm, profil_complet },
      meta: { passed, total: TOTAL_FORMATION_MODULES, avgQcm, hasProfile },
    };
  } catch (e) {
    console.warn('⚠️ computeFormationScore:', e.message);
    return empty;
  }
}

// Mélange projet + formation et enrichit le breakdown/conseils
function blendScore(project, formation) {
  const final = Math.round(SCORE_WEIGHTS.project * project.score + SCORE_WEIGHTS.formation * formation.score);
  const advice = [...(project.advice || [])];
  if (formation.meta.passed < TOTAL_FORMATION_MODULES) {
    advice.unshift({
      axis: 'Formation',
      tip: `Validez les modules de formation BCEG (${formation.meta.passed}/${TOTAL_FORMATION_MODULES}) pour augmenter votre score.`,
    });
  }
  if (!formation.meta.hasProfile) {
    advice.push({ axis: 'Profil', tip: 'Complétez votre candidature formation pour gagner des points de préqualification.' });
  }
  return {
    score: final,
    color: colorFor(final),
    breakdown: {
      ...project.breakdown,
      formation: formation.breakdown,
      project_score: project.score,
      formation_score: formation.score,
      weights: SCORE_WEIGHTS,
    },
    advice: advice.slice(0, 4),
  };
}

// Score complet (projet + formation) pour un utilisateur donné
async function buildScoreWithFormation(formData, userId) {
  const project = computeBcegScore(formData);
  const formation = await computeFormationScore(userId);
  return blendScore(project, formation);
}

// =====================================================================
// Niveau de risque indicatif + recommandation d'orientation (gestionnaire)
// Indicateur d'aide à la décision — PAS une décision de crédit automatique.
// =====================================================================
function financingTier(montant) {
  if (montant == null) return null;
  if (montant <= 1000000) return 1;
  if (montant <= 5000000) return 2;
  return 3;
}

function assessRisk({ score, montant, formationPassed = 0 }) {
  const total = TOTAL_FORMATION_MODULES;
  const tier = financingTier(montant);
  const requiredModules = tier ? tier * 5 : 0;
  const formationOk = formationPassed >= requiredModules;
  const s = typeof score === 'number' ? score : 0;

  let level, label, recommendation;
  if (s >= 70 && formationOk) {
    level = 'faible'; label = 'Risque faible';
    recommendation = 'Dossier mûr — à instruire en priorité.';
  } else if (s >= 45) {
    level = 'modere'; label = 'Risque modéré';
    recommendation = formationOk
      ? 'À instruire ; demander les compléments manquants.'
      : `Faire compléter la formation (palier ${tier}) avant instruction.`;
  } else {
    level = 'eleve'; label = 'Risque élevé';
    recommendation = 'Orienter vers accompagnement / formation avant instruction.';
  }
  if (!formationOk && tier) {
    recommendation += ` Formation requise : ${requiredModules} modules (validés : ${formationPassed}/${total}).`;
  }

  return {
    level, label, recommendation,
    score: s, tier,
    formation_passed: formationPassed,
    formation_total: total,
    formation_pct: Math.round((formationPassed / total) * 100),
    formation_ok: formationOk,
  };
}

// Enregistre/maj la commission d'un dossier accepté (best-effort)
// Taux configurable : BCEG_COMMISSION_RATE (défaut 0.03 = 3 %).
async function recordCommissionForAccepted(submission) {
  try {
    if (!submission || submission.status !== 'accepted') return;
    const rate = Number(process.env.BCEG_COMMISSION_RATE || 0.03);
    const montant = Number(submission.montant_demande || 0);
    if (!montant) return;
    await supabase.from('bceg_commissions').upsert({
      submission_id: submission.id,
      project_id: submission.project_id || null,
      user_id: submission.user_id || null,
      montant_finance: montant,
      taux: rate,
      montant_commission: Math.round(montant * rate),
      status: 'pending',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'submission_id' });
  } catch (e) {
    console.warn('⚠️ recordCommissionForAccepted:', e.message);
  }
}

// Map user_id -> nb de modules de formation validés (en lot)
async function formationPassedByUsers(userIds) {
  const map = {};
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return map;
  try {
    const { data } = await supabase
      .from('formation_progress')
      .select('user_id')
      .in('user_id', ids)
      .eq('passed', true);
    (data || []).forEach(r => { map[r.user_id] = (map[r.user_id] || 0) + 1; });
  } catch (e) {
    console.warn('⚠️ formationPassedByUsers:', e.message);
  }
  return map;
}

// =====================================================================
// POST /api/bceg/simulate
// =====================================================================
router.post('/simulate', validateBody(simulateSchema), async (req, res) => {
  try {
    const {
      project_id = null,
      type = 'particulier',
      revenu_mensuel,
      montant_demande,
      apport_personnel = 0,
      duree_mois = 24,
      taux_annuel = 5.0,
      persist = false,
    } = req.body || {};

    if (!montant_demande || montant_demande <= 0) {
      return res.status(400).json({ success: false, error: 'montant_demande requis (> 0)' });
    }
    if (!['particulier', 'entreprise'].includes(type)) {
      return res.status(400).json({ success: false, error: "type doit être 'particulier' ou 'entreprise'" });
    }
    if (duree_mois < 6 || duree_mois > 84) {
      return res.status(400).json({ success: false, error: 'duree_mois entre 6 et 84' });
    }
    if (apport_personnel < 0 || apport_personnel >= montant_demande) {
      return res.status(400).json({ success: false, error: 'apport_personnel entre 0 et montant_demande exclu' });
    }
    if (taux_annuel < 0 || taux_annuel > 25) {
      return res.status(400).json({ success: false, error: 'taux_annuel entre 0 et 25%' });
    }

    const principal = montant_demande - apport_personnel;
    const mensualite = computeMensualite(principal, taux_annuel, duree_mois);
    const total_a_rembourser = mensualite * duree_mois;
    const cout_credit = total_a_rembourser - principal;
    const apport_pct = Math.round((apport_personnel / montant_demande) * 100);

    let capacite_remboursement_ok = null;
    if (revenu_mensuel && revenu_mensuel > 0) {
      capacite_remboursement_ok = mensualite < revenu_mensuel * 0.33;
    }

    const result = {
      principal,
      mensualite,
      total_a_rembourser,
      cout_credit,
      apport_pct,
      capacite_remboursement_ok,
      taux_effectif_global_estime: taux_annuel,
    };

    if (persist && req.user?.id) {
      const { data, error } = await supabase
        .from('bceg_simulations')
        .insert({
          project_id,
          user_id: req.user.id,
          type,
          revenu_mensuel,
          montant_demande,
          apport_personnel,
          apport_pct,
          duree_mois,
          taux_annuel,
          mensualite,
          total_a_rembourser,
          cout_credit,
          capacite_remboursement_ok,
        })
        .select()
        .single();
      if (error) {
        console.warn('⚠️ bceg_simulations insert failed:', error.message);
      } else {
        result.simulation_id = data.id;
      }
    }

    res.json({ success: true, simulation: result });
  } catch (error) {
    console.error('Erreur /api/bceg/simulate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// POST /api/bceg/score
// =====================================================================
router.post('/score', validateBody(scoreSchema), async (req, res) => {
  try {
    const { project_id = null, step = 1, persist = false, ...formData } = req.body || {};

    const result = req.user?.id
      ? await buildScoreWithFormation(formData, req.user.id)
      : computeBcegScore(formData);

    if (persist && req.user?.id) {
      const { error } = await supabase.from('bceg_scores').insert({
        project_id,
        user_id: req.user.id,
        step,
        score: result.score,
        color: result.color,
        breakdown: result.breakdown,
      });
      if (error) console.warn('⚠️ bceg_scores insert failed:', error.message);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erreur /api/bceg/score:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// GET /api/bceg/stats — stats globales pour la landing
// =====================================================================
router.get('/stats', async (_req, res) => {
  try {
    const [projectsRes, acceptedRes, fundedAgg] = await Promise.all([
      supabase.from('saved_projects').select('id', { count: 'exact', head: true }),
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('bceg_submissions').select('montant_demande').eq('status', 'accepted'),
    ]);

    const projectsCount = projectsRes?.count || 0;
    const acceptedCount = acceptedRes?.count || 0;
    const totalFundedXaf = (fundedAgg?.data || []).reduce((sum, row) => sum + Number(row.montant_demande || 0), 0);

    res.json({
      success: true,
      stats: {
        projects_count: projectsCount,
        bceg_accepted_count: acceptedCount,
        total_funded_xaf: totalFundedXaf,
        total_funded_billions: Math.round(totalFundedXaf / 1e9 * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Erreur /api/bceg/stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// GET /api/bceg/my-score?project_id=...  (dernier score connu)
// =====================================================================
router.get('/my-score', requireAuth, async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id requis' });

    const { data, error } = await supabase
      .from('bceg_scores')
      .select('*')
      .eq('project_id', project_id)
      .eq('user_id', req.user.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json({ success: true, score: null });

    // Recalcule la part formation en temps réel et re-mélange avec la part
    // projet stockée → le score reflète immédiatement la progression formation.
    const formation = await computeFormationScore(req.user.id);
    const projectScore = (data.breakdown && typeof data.breakdown.project_score === 'number')
      ? data.breakdown.project_score
      : data.score; // ancien format : data.score = part projet pure
    const final = Math.round(SCORE_WEIGHTS.project * projectScore + SCORE_WEIGHTS.formation * formation.score);

    res.json({
      success: true,
      score: {
        ...data,
        score: final,
        color: colorFor(final),
        breakdown: {
          ...(data.breakdown || {}),
          formation: formation.breakdown,
          project_score: projectScore,
          formation_score: formation.score,
          weights: SCORE_WEIGHTS,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// GET /api/bceg/leaderboard (placeholder Phase 5)
// =====================================================================
router.get('/leaderboard', async (_req, res) => {
  res.json({
    success: true,
    leaderboard: [],
    note: 'Phase 5 — leaderboard public à implémenter',
  });
});

// =====================================================================
// POST /api/bceg/submit — créer une soumission BCEG (user)
// =====================================================================
router.post('/submit', requireAuth, validateBody(submitSchema), async (req, res) => {
  try {
    const {
      project_id = null,
      simulation_id = null,
      montant_demande,
      bceg_score = null,
      pdf_url = null,
    } = req.body || {};

    if (!montant_demande || montant_demande <= 0) {
      return res.status(400).json({ success: false, error: 'montant_demande requis (> 0)' });
    }

    const { data, error } = await supabase
      .from('bceg_submissions')
      .insert({
        project_id,
        user_id: req.user.id,
        simulation_id,
        status: 'submitted',
        montant_demande,
        bceg_score,
        pdf_url,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, submission: data });
  } catch (error) {
    console.error('Erreur /api/bceg/submit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// GET /api/bceg/my-submissions — soumissions de l'user
// =====================================================================
router.get('/my-submissions', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_submissions')
      .select('*, saved_projects(article_title, proposition_titre)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, submissions: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// =====================================================================
// ROUTES ADMIN — dashboard BCEG
// =====================================================================
// =====================================================================

// GET /api/bceg/admin/submissions — toutes les soumissions (Kanban)
router.get('/admin/submissions', requireBcegAccess, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase
      .from('bceg_submissions')
      .select(`
        *,
        saved_projects(article_title, proposition_titre, secteur_selectionne, ville, problematique_centrale, proposition_description),
        bceg_simulations(montant_demande, apport_personnel, apport_pct, duree_mois, mensualite, total_a_rembourser, type, taux_annuel)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw error;

    let submissions = data || [];
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.toLowerCase();
      submissions = submissions.filter(s =>
        (s.saved_projects?.article_title || '').toLowerCase().includes(q) ||
        (s.saved_projects?.proposition_titre || '').toLowerCase().includes(q) ||
        (s.saved_projects?.secteur_selectionne || '').toLowerCase().includes(q) ||
        (s.saved_projects?.ville || '').toLowerCase().includes(q) ||
        (s.bceg_reference || '').toLowerCase().includes(q)
      );
    }

    // Enrichissement gestionnaire : palier + statut formation + niveau de risque
    const passedMap = await formationPassedByUsers(submissions.map(s => s.user_id));
    submissions = submissions.map(s => {
      const formationPassed = passedMap[s.user_id] || 0;
      return {
        ...s,
        formation_passed: formationPassed,
        financing_tier: financingTier(s.montant_demande),
        risk: assessRisk({ score: s.bceg_score, montant: s.montant_demande, formationPassed }),
      };
    });

    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Erreur /admin/submissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/admin/submissions/:id — détail complet d'une soumission
router.get('/admin/submissions/:id', requireBcegAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('bceg_submissions')
      .select(`
        *,
        saved_projects(*),
        bceg_simulations(*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;

    // Récupérer le dernier BCEG Score lié au projet
    let lastScore = null;
    if (data?.project_id) {
      const { data: scoreData } = await supabase
        .from('bceg_scores')
        .select('*')
        .eq('project_id', data.project_id)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastScore = scoreData;
    }

    // Score live (projet stocké + formation actuelle) + niveau de risque
    const formation = await computeFormationScore(data?.user_id);
    const projectScore = (lastScore?.breakdown && typeof lastScore.breakdown.project_score === 'number')
      ? lastScore.breakdown.project_score
      : (lastScore?.score ?? data?.bceg_score ?? 0);
    const liveScoreVal = Math.round(SCORE_WEIGHTS.project * projectScore + SCORE_WEIGHTS.formation * formation.score);
    const live_score = {
      score: liveScoreVal,
      color: colorFor(liveScoreVal),
      breakdown: {
        ...(lastScore?.breakdown || {}),
        formation: formation.breakdown,
        project_score: projectScore,
        formation_score: formation.score,
        weights: SCORE_WEIGHTS,
      },
    };
    const risk = assessRisk({ score: liveScoreVal, montant: data?.montant_demande, formationPassed: formation.meta.passed });

    res.json({ success: true, submission: data, last_score: lastScore, live_score, risk });
  } catch (error) {
    console.error('Erreur /admin/submissions/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/bceg/admin/submissions/:id/status — changer statut + notes
router.patch('/admin/submissions/:id/status', requireBcegAccess, validateBody(submissionStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, bceg_reference } = req.body || {};

    const valid = ['draft', 'submitted', 'in_review', 'accepted', 'rejected'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ success: false, error: `status doit être l'un de ${valid.join(', ')}` });
    }

    const update = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (admin_notes !== undefined) update.admin_notes = admin_notes;
    if (bceg_reference !== undefined) update.bceg_reference = bceg_reference;
    if (status === 'accepted' || status === 'rejected') {
      update.decision_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('bceg_submissions')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    console.log(`📋 Submission ${id} → ${status} (admin: ${req.user.id})`);

    // Enregistre la commission si le dossier est accepté
    if (status === 'accepted') await recordCommissionForAccepted(data);

    // Annonce la décision au porteur (in-app + WhatsApp + email), best-effort
    let notified = null;
    if (['in_review', 'accepted', 'rejected'].includes(status)) {
      notified = await notifyApplicantOfDecision({ submission: data, status });
    }

    res.json({ success: true, submission: data, notified });
  } catch (error) {
    console.error('Erreur PATCH /admin/submissions/:id/status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/admin/submissions/:id/documents — pièces du dossier + URLs signées + checklist
router.get('/admin/submissions/:id/documents', requireBcegAccess, async (req, res) => {
  try {
    const { data: sub, error: sErr } = await supabase
      .from('bceg_submissions')
      .select('id, user_id, project_id')
      .eq('id', req.params.id)
      .single();
    if (sErr || !sub) return res.status(404).json({ success: false, error: 'Soumission introuvable' });

    let q = supabase.from('due_diligence_documents').select('*').eq('user_id', sub.user_id);
    if (sub.project_id) q = q.eq('project_id', sub.project_id);
    const { data: docs, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;

    // URL signée d'aperçu (lecture) pour chaque pièce
    const withUrls = await Promise.all((docs || []).map(async (d) => {
      let view_url = null;
      try {
        const path = String(d.file_url || '').replace(/^due-diligence\//, '');
        const { data: signed } = await supabase.storage.from('due-diligence').createSignedUrl(path, 3600);
        view_url = signed?.signedUrl || null;
      } catch { /* ignore */ }
      return { ...d, view_url };
    }));

    // Checklist des 6 pièces attendues (présente ? statut ?)
    const REQUIRED = [
      { key: 'business_plan', label: 'Business Plan', required: true },
      { key: 'illustration', label: 'Infographie du projet', required: true },
      { key: 'plan_action', label: "Plan d'action détaillé", required: true },
      { key: 'cni', label: "Pièce d'identité (CNI)", required: true },
      { key: 'rccm', label: 'RCCM ou attestation', required: true },
      { key: 'rib', label: 'RIB / Coordonnées bancaires', required: true },
      { key: 'devis', label: 'Devis ou justificatifs', required: false },
    ];
    const byType = {};
    withUrls.forEach((d) => { (byType[d.doc_type] = byType[d.doc_type] || []).push(d); });
    const checklist = REQUIRED.map((r) => ({
      ...r,
      provided: !!(byType[r.key] && byType[r.key].length),
      status: byType[r.key]?.[0]?.verification_status || null,
    }));

    res.json({ success: true, documents: withUrls, checklist });
  } catch (error) {
    console.error('Erreur GET /admin/submissions/:id/documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/admin/stats — stats globales pour le header dashboard
router.get('/admin/stats', requireBcegAccess, async (_req, res) => {
  try {
    const [allRes, draftRes, subRes, reviewRes, accRes, rejRes, montants, scoreAcc] = await Promise.all([
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }),
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('bceg_submissions').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('bceg_submissions').select('montant_demande').not('montant_demande', 'is', null),
      supabase.from('bceg_submissions').select('bceg_score').eq('status', 'accepted').not('bceg_score', 'is', null),
    ]);

    const total = allRes?.count || 0;
    const accepted = accRes?.count || 0;
    const rejected = rejRes?.count || 0;
    const decided = accepted + rejected;
    const totalFunded = (montants?.data || [])
      .filter(r => r.montant_demande)
      .reduce((sum, r) => sum + Number(r.montant_demande), 0);

    const scores = (scoreAcc?.data || []).map(s => s.bceg_score).filter(Boolean);
    const avgAcceptedScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    res.json({
      success: true,
      stats: {
        total,
        by_status: {
          draft: draftRes?.count || 0,
          submitted: subRes?.count || 0,
          in_review: reviewRes?.count || 0,
          accepted,
          rejected,
        },
        acceptance_rate: decided ? Math.round((accepted / decided) * 100) : null,
        total_funded_xaf: totalFunded,
        avg_accepted_score: avgAcceptedScore,
      },
    });
  } catch (error) {
    console.error('Erreur /admin/stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/admin/export — export CSV pour BCEG
router.get('/admin/export', requireBcegAccess, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_submissions')
      .select(`
        id, status, montant_demande, bceg_score, bceg_reference,
        submitted_at, decision_at, created_at,
        saved_projects(article_title, proposition_titre, secteur_selectionne, problematique_centrale),
        bceg_simulations(apport_personnel, apport_pct, duree_mois, mensualite, type)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const header = [
      'ID', 'Statut', 'Référence BCEG', 'Titre projet', 'Article source', 'Secteur',
      'Montant demandé (XAF)', 'Apport (XAF)', 'Apport %', 'Durée mois', 'Mensualité (XAF)',
      'Type', 'BCEG Score', 'Soumis le', 'Décision le', 'Créé le',
    ];
    const escapeCsv = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(',')];
    rows.forEach(r => {
      const p = r.saved_projects || {};
      const s = r.bceg_simulations || {};
      lines.push([
        r.id, r.status, r.bceg_reference,
        p.proposition_titre, p.article_title, p.secteur_selectionne,
        r.montant_demande, s.apport_personnel, s.apport_pct, s.duree_mois, s.mensualite,
        s.type, r.bceg_score,
        r.submitted_at, r.decision_at, r.created_at,
      ].map(escapeCsv).join(','));
    });

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bceg-submissions-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Erreur /admin/export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// POST /api/bceg/generate-dossier — preview PDF d'un projet (sans soumettre)
// =====================================================================
router.post('/generate-dossier', requireAuth, validateBody(dossierSchema), async (req, res) => {
  try {
    const { project_id, simulation_id } = req.body || {};
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id requis' });

    const [{ data: project }, { data: scoreData }] = await Promise.all([
      supabase.from('saved_projects').select('*').eq('id', project_id).single(),
      supabase.from('bceg_scores').select('*').eq('project_id', project_id).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!project) return res.status(404).json({ success: false, error: 'Projet introuvable' });
    if (project.user_id && project.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Projet non autorisé' });
    }

    // Auto-fetch la dernière simulation du projet si pas d'id explicite
    let simulation = null;
    if (simulation_id) {
      const r = await supabase.from('bceg_simulations').select('*').eq('id', simulation_id).single();
      simulation = r.data;
    } else {
      const r = await supabase
        .from('bceg_simulations')
        .select('*')
        .eq('project_id', project_id)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      simulation = r.data;
    }

    const pdf = await generateBcegDossier({
      submission: {
        id: null,
        status: 'draft',
        montant_demande: simulation?.montant_demande || null,
        bceg_score: scoreData?.score ?? null,
        bceg_reference: null,
        created_at: new Date().toISOString(),
      },
      project,
      simulation,
      score: scoreData,
      userInfo: { email: req.user.email },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dossier-bceg-${project_id.slice(0,8)}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Erreur /generate-dossier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /import-business-plan : regroupe les sections générées (project_documents)
// en un PDF au template BCEG, l'upload dans le bucket privé et l'attache au
// dossier (due_diligence_documents). Aucun appel IA : assemblage déterministe.
router.post('/import-business-plan', requireAuth, async (req, res) => {
  try {
    const { project_id, kind = 'business_plan', document_ids } = req.body || {};
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id requis' });
    if (!['business_plan', 'plan_action'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'kind invalide' });
    }

    // 1. Projet (page de garde + contrôle d'accès)
    const { data: project } = await supabase.from('saved_projects').select('*').eq('id', project_id).single();
    if (!project) return res.status(404).json({ success: false, error: 'Projet introuvable' });
    if (project.user_id && project.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Projet non autorisé' });
    }

    // 2. Construire les sections
    let sections = [];

    // 2a. Plan d'action : compiler les checklists des étapes (table dédiée)
    if (kind === 'plan_action') {
      const { data: checklists } = await supabase
        .from('action_plan_checklists')
        .select('id, step_number, step_title, step_objective')
        .eq('project_id', project_id)
        .order('step_number', { ascending: true });

      for (const cl of (checklists || [])) {
        const { data: items } = await supabase
          .from('action_plan_checklist_items')
          .select('task, answer, is_completed, document_names, order_index')
          .eq('checklist_id', cl.id)
          .order('order_index', { ascending: true });

        const lines = [];
        if (cl.step_objective) lines.push(`**Objectif :** ${cl.step_objective}`, '');
        for (const it of (items || [])) {
          lines.push(`**${it.is_completed ? '✓ ' : ''}${it.task || ''}**`);
          if (it.answer) lines.push('', String(it.answer));
          if (Array.isArray(it.document_names) && it.document_names.length) {
            lines.push('', `_Documents : ${it.document_names.join(', ')}_`);
          }
          lines.push('');
        }
        sections.push({
          number: cl.step_number,
          title: cl.step_title || `Étape ${cl.step_number}`,
          content: lines.join('\n').trim() || '_Aucun élément renseigné pour cette étape._',
        });
      }
    }

    // 2b. Repli (business plan, ou plan d'action sans checklist) : project_documents
    if (!sections.length) {
      const { data: allDocs, error: docErr } = await supabase
        .from('project_documents')
        .select('id, document_type, title, content, metadata, created_at')
        .eq('project_id', project_id);
      if (docErr) throw docErr;

      const re = kind === 'business_plan' ? /business[-_]plan/i : /action[-_]plan/i;
      let docs = (allDocs || []).filter((d) => re.test(d.document_type || ''));
      if (Array.isArray(document_ids) && document_ids.length) {
        docs = docs.filter((d) => document_ids.includes(d.id));
      }
      if (!docs.length) {
        return res.status(404).json({ success: false, error: 'Aucun contenu à regrouper' });
      }
      docs.sort((a, b) => {
        const na = a.metadata?.section_number ?? a.metadata?.phase_number ?? 9999;
        const nb = b.metadata?.section_number ?? b.metadata?.phase_number ?? 9999;
        return na - nb;
      });
      sections = docs.map((d, i) => ({
        number: d.metadata?.section_number ?? d.metadata?.phase_number ?? (i + 1),
        title: d.title || d.metadata?.section_title || `Section ${i + 1}`,
        content: d.content || '',
      }));
    }

    // 4. Annexes : pièces déjà fournies au dossier
    const { data: dd } = await supabase
      .from('due_diligence_documents')
      .select('doc_type')
      .eq('project_id', project_id)
      .eq('user_id', req.user.id);
    const present = new Set((dd || []).map((d) => d.doc_type));
    const ANNEXES = [
      { key: 'cni', label: "Pièce d'identité (CNI)" },
      { key: 'rccm', label: 'RCCM ou attestation' },
      { key: 'rib', label: 'RIB / Coordonnées bancaires' },
      { key: 'devis', label: 'Devis ou justificatifs' },
    ];
    const annexes = ANNEXES.map((a) => ({ label: a.label, present: present.has(a.key) }));

    // 5. HTML template BCEG → PDF
    const { buildBcegBusinessPlanHtml, renderHtmlToPdf } = require('../services/businessPlanPdf');
    const docTitle = kind === 'business_plan' ? 'Business Plan' : "Plan d'action";
    const projectTitle = project.title || project.name || project.project_name || project.idea || 'Projet';
    const html = buildBcegBusinessPlanHtml({
      docTitle,
      projectTitle,
      owner: req.user.email || null,
      sections,
      annexes,
    });
    const pdf = await renderHtmlToPdf(html);

    // 6. Upload PDF (service role) dans le bucket privé due-diligence
    const safe = String(docTitle).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${req.user.id}/${kind}-${Date.now()}-${safe}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('due-diligence')
      .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
    if (upErr) throw upErr;

    // 7. Enregistrement de la pièce
    const { data: doc, error: insErr } = await supabase
      .from('due_diligence_documents')
      .insert({
        user_id: req.user.id,
        project_id,
        doc_type: kind,
        file_url: path,
        file_name: `${safe}.pdf`,
        file_size: pdf.length,
        mime_type: 'application/pdf',
        verification_status: 'pending',
      })
      .select()
      .single();
    if (insErr) throw insErr;

    res.json({ success: true, document: doc, sections: sections.length });
  } catch (error) {
    console.error('Erreur /import-business-plan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// POST /api/bceg/submit-full — soumission complète : PDF + email BCEG + DB
// =====================================================================
router.post('/submit-full', requireAuth, validateBody(dossierSchema), async (req, res) => {
  try {
    const { project_id, simulation_id } = req.body || {};
    if (!project_id) return res.status(400).json({ success: false, error: 'project_id requis' });

    // 1. Charger projet + score
    const [{ data: project }, { data: scoreData }] = await Promise.all([
      supabase.from('saved_projects').select('*').eq('id', project_id).single(),
      supabase.from('bceg_scores').select('*').eq('project_id', project_id).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!project) return res.status(404).json({ success: false, error: 'Projet introuvable' });
    if (project.user_id && project.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Projet non autorisé' });
    }

    // Auto-fetch la dernière simulation du projet si pas d'id explicite
    let simulation = null;
    if (simulation_id) {
      const r = await supabase.from('bceg_simulations').select('*').eq('id', simulation_id).single();
      simulation = r.data;
    } else {
      const r = await supabase
        .from('bceg_simulations')
        .select('*')
        .eq('project_id', project_id)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      simulation = r.data;
    }

    // Détermination du montant demandé : simulation > funding_needed du projet > NULL
    // (Le PDF gère l'absence de simulation avec un encart d'erreur clair.)
    let montant_demande = simulation?.montant_demande || null;
    if (!montant_demande && project.funding_needed) {
      const parsed = parseInt(String(project.funding_needed).replace(/\D/g, ''), 10);
      if (parsed && parsed > 0) montant_demande = parsed;
    }

    // 2. Créer la submission DB (status submitted)
    const { data: submission, error: subErr } = await supabase
      .from('bceg_submissions')
      .insert({
        project_id,
        user_id: req.user.id,
        simulation_id: simulation?.id || null,
        status: 'submitted',
        montant_demande,
        bceg_score: scoreData?.score ?? null,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (subErr) throw subErr;

    // 3. Générer le PDF
    const pdfBuffer = await generateBcegDossier({
      submission,
      project,
      simulation,
      score: scoreData,
      userInfo: { email: req.user.email },
    });

    // 4. Envoyer l'email à BCEG via SendGrid (best-effort, non bloquant)
    let emailStatus = 'skipped';
    if (process.env.SENDGRID_API_KEY) {
      try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        await sgMail.send({
          to: BCEG_TARGET_EMAIL,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@gabon-insight.com',
          replyTo: req.user.email,
          subject: `[Gabon Insight × BCEG] Nouveau dossier de financement — ${project.proposition_titre || project.article_title || 'Projet'}`,
          text: `Nouveau dossier soumis via Gabon Insight.\n\n` +
                `Titre: ${project.proposition_titre || 'N/A'}\n` +
                `Secteur: ${project.secteur_selectionne || 'N/A'}\n` +
                `Montant demandé: ${new Intl.NumberFormat('fr-FR').format(montant_demande)} XAF\n` +
                `BCEG Score: ${scoreData?.score ?? 'N/A'}/100\n` +
                `Contact porteur de projet: ${req.user.email}\n\n` +
                `Le dossier complet est en pièce jointe. Vous pouvez répondre directement à cet email pour échanger avec le porteur de projet.\n\n` +
                `Référence Gabon Insight: ${submission.id}`,
          html: `
            <div style="font-family: -apple-system, sans-serif; max-width: 600px; padding: 20px;">
              <h2 style="color: #f59e0b;">🏦 Nouveau dossier BCEG Project</h2>
              <p>Un nouveau dossier de financement a été soumis via Gabon Insight.</p>
              <table style="border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 6px; color: #64748b;">Titre :</td><td style="padding: 6px; font-weight: 600;">${project.proposition_titre || 'N/A'}</td></tr>
                <tr><td style="padding: 6px; color: #64748b;">Secteur :</td><td style="padding: 6px;">${project.secteur_selectionne || 'N/A'}</td></tr>
                <tr><td style="padding: 6px; color: #64748b;">Montant :</td><td style="padding: 6px; font-weight: 600; color: #f59e0b;">${new Intl.NumberFormat('fr-FR').format(montant_demande)} XAF</td></tr>
                <tr><td style="padding: 6px; color: #64748b;">BCEG Score :</td><td style="padding: 6px;">${scoreData?.score ?? 'N/A'}/100</td></tr>
                <tr><td style="padding: 6px; color: #64748b;">Porteur :</td><td style="padding: 6px;">${req.user.email}</td></tr>
              </table>
              <p style="background: #fef3c7; padding: 12px; border-radius: 6px;">📎 Dossier PDF complet en pièce jointe.</p>
              <p style="color: #64748b; font-size: 12px;">Réf. Gabon Insight : <code>${submission.id}</code></p>
            </div>
          `,
          attachments: [{
            content: pdfBuffer.toString('base64'),
            filename: `dossier-bceg-${submission.id.slice(0, 8)}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment',
          }],
        });
        emailStatus = 'sent';
      } catch (mailErr) {
        console.error('⚠️ Email BCEG échoué (non bloquant):', mailErr.message);
        emailStatus = 'failed';
      }
    }

    res.json({
      success: true,
      submission,
      email_status: emailStatus,
      pdf_size_bytes: pdfBuffer.length,
    });
  } catch (error) {
    console.error('Erreur /submit-full:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// POST /api/bceg/mentor-chat — Chatbot "Conseiller BCEG" (Gemini)
// =====================================================================
router.post('/mentor-chat', requireAuth, validateBody(mentorChatSchema), async (req, res) => {
  try {
    const { message, history = [], project_context = null } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'message requis' });
    }

    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'Service IA non configuré' });
    }

    const systemPrompt = `Tu es le Conseiller BCEG virtuel de l'application Gabon Insight.
Tu aides un entrepreneur gabonais à préparer un dossier de financement bancaire pour la BCEG
(Banque pour le Commerce et l'Entrepreneuriat du Gabon), banque dédiée aux PME/PMI gabonaises.

Ton rôle :
- Donner des conseils concrets pour rendre un projet "bancable" (viabilité financière, secteur prioritaire, capacité de remboursement, complétude du dossier)
- Expliquer les critères BCEG (taux dès 5 % via programmes CATR et FAMAD, apport recommandé 20 %)
- Aider à formuler un pitch convaincant
- Rester bienveillant, encourageant, et adapté au contexte gabonais

Règles :
- Réponses concises (max 3 paragraphes)
- Utilise des exemples concrets gabonais quand pertinent
- Pas de promesse de financement — uniquement des conseils
- Si l'user pose une question hors sujet (politique, religion, sport…), recentre poliment

${project_context ? `\nContexte du projet de l'utilisateur :\n${JSON.stringify(project_context, null, 2)}` : ''}`;

    const geminiService = require('../services/gemini-service');

    const historyText = (Array.isArray(history) ? history : [])
      .slice(-8)
      .map(m => `${m.role === 'assistant' ? 'Conseiller' : 'Utilisateur'}: ${String(m.content || '').slice(0, 2000)}`)
      .join('\n');
    const conversationPrompt = `${historyText ? historyText + '\n' : ''}Utilisateur: ${message.slice(0, 2000)}\nConseiller:`;

    // OpenAI (gpt-4.1-mini) en primaire, Gemini en fallback automatique
    const reply = await geminiService.generateText(conversationPrompt, {
      systemPrompt,
      temperature: 0.7,
    });

    res.json({ success: true, reply });
  } catch (error) {
    console.error('Erreur /mentor-chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// =====================================================================
// PHASE 6 — Templates, RDV, Due Diligence
// =====================================================================
// =====================================================================

router.get('/templates', async (req, res) => {
  try {
    const { sector } = req.query;
    let q = supabase.from('bceg_templates').select('*').eq('status', 'published').order('usage_count', { ascending: false });
    if (sector) q = q.eq('sector', sector);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, templates: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates/:slug', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_templates')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('status', 'published')
      .single();
    if (error) throw error;
    supabase.from('bceg_templates')
      .update({ usage_count: (data?.usage_count || 0) + 1 })
      .eq('id', data.id)
      .then(() => {})
      .then(null, () => {});
    res.json({ success: true, template: data });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Template non trouvé' });
  }
});

router.post('/appointments', requireAuth, validateBody(appointmentSchema), async (req, res) => {
  try {
    const { project_id, submission_id, appointment_date, appointment_time, topic, user_name, user_phone } = req.body || {};
    if (!appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, error: 'appointment_date et appointment_time requis' });
    }
    const { data, error } = await supabase
      .from('bceg_appointments')
      .insert({
        user_id: req.user.id,
        user_email: req.user.email,
        user_name,
        user_phone,
        project_id,
        submission_id,
        appointment_date,
        appointment_time,
        topic,
        status: 'requested',
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, appointment: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/appointments/mine', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_appointments')
      .select('*')
      .eq('user_id', req.user.id)
      .order('appointment_date', { ascending: true });
    if (error) throw error;
    res.json({ success: true, appointments: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/appointments', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let q = supabase.from('bceg_appointments').select('*').order('appointment_date', { ascending: true });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, appointments: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/admin/appointments/:id', requireAdmin, validateBody(adminAppointmentUpdateSchema), async (req, res) => {
  try {
    const update = { ...req.body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('bceg_appointments')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, appointment: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/due-diligence/sign-upload', requireAuth, validateBody(signUploadSchema), async (req, res) => {
  try {
    const { doc_type, file_name } = req.body || {};
    if (!doc_type || !file_name) {
      return res.status(400).json({ success: false, error: 'doc_type et file_name requis' });
    }
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${req.user.id}/${doc_type}-${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage
      .from('due-diligence')
      .createSignedUploadUrl(path);
    if (error) throw error;
    res.json({ success: true, ...data, path });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/due-diligence', requireAuth, validateBody(dueDiligenceSchema), async (req, res) => {
  try {
    const { doc_type, file_url, file_name, file_size, mime_type, project_id, submission_id } = req.body || {};
    if (!doc_type || !file_url) return res.status(400).json({ success: false, error: 'doc_type et file_url requis' });
    const { data, error } = await supabase
      .from('due_diligence_documents')
      .insert({
        user_id: req.user.id,
        project_id,
        submission_id,
        doc_type,
        file_url,
        file_name,
        file_size,
        mime_type,
        verification_status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, document: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/due-diligence/mine', requireAuth, async (req, res) => {
  try {
    let query = supabase
      .from('due_diligence_documents')
      .select('*')
      .eq('user_id', req.user.id);
    if (req.query.project_id) {
      query = query.eq('project_id', req.query.project_id);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, documents: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// URL signée de téléchargement/visualisation (propriétaire uniquement) — bucket privé
router.get('/due-diligence/:id/url', requireAuth, async (req, res) => {
  try {
    const { data: doc, error } = await supabase
      .from('due_diligence_documents')
      .select('file_url, user_id')
      .eq('id', req.params.id)
      .single();
    if (error || !doc) return res.status(404).json({ success: false, error: 'Document introuvable' });
    if (doc.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Accès refusé' });
    const path = String(doc.file_url || '').replace(/^due-diligence\//, '');
    const { data: signed, error: sErr } = await supabase.storage
      .from('due-diligence')
      .createSignedUrl(path, 3600);
    if (sErr) throw sErr;
    res.json({ success: true, url: signed.signedUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/due-diligence/:id', requireAuth, async (req, res) => {
  try {
    const { data: doc } = await supabase.from('due_diligence_documents').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!doc) return res.status(404).json({ success: false, error: 'Document non trouvé' });
    if (doc.file_url) {
      const m = String(doc.file_url).match(/due-diligence\/(.+)$/);
      if (m) await supabase.storage.from('due-diligence').remove([m[1]]).then(() => {}, () => {});
    }
    await supabase.from('due_diligence_documents').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/admin/due-diligence/:id', requireBcegAccess, validateBody(adminDueDiligenceUpdateSchema), async (req, res) => {
  try {
    const { status, admin_notes, rejection_reason } = req.body || {};
    const update = {
      verified_by: req.user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // La colonne réelle est verification_status (lue côté porteur)
    if (status !== undefined) update.verification_status = status;
    if (admin_notes !== undefined) update.admin_notes = admin_notes;
    if (rejection_reason !== undefined) update.rejection_reason = rejection_reason;

    const { data, error } = await supabase
      .from('due_diligence_documents')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, document: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// =====================================================================
// PHASE 7 — Sponsoring + Sector matching
// =====================================================================
// =====================================================================

router.get('/admin/sponsorships', requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_sponsorships')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, sponsorships: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/sponsorships', requireAdmin, validateBody(sponsorshipSchema), async (req, res) => {
  try {
    const { campaign_name, description, credits_offered, total_budget, target_sectors, ends_at, status } = req.body || {};
    if (!campaign_name || !credits_offered || !total_budget) {
      return res.status(400).json({ success: false, error: 'campaign_name, credits_offered, total_budget requis' });
    }
    const { data, error } = await supabase
      .from('bceg_sponsorships')
      .insert({
        campaign_name,
        description,
        credits_offered,
        total_budget,
        target_sectors,
        ends_at,
        status: status || 'active',
      })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, sponsorship: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/sponsorships/:id/grant', requireAdmin, validateBody(grantSchema), async (req, res) => {
  try {
    const { user_id, reason } = req.body || {};
    if (!user_id) return res.status(400).json({ success: false, error: 'user_id requis' });
    const { data: campaign } = await supabase.from('bceg_sponsorships').select('*').eq('id', req.params.id).single();
    if (!campaign) return res.status(404).json({ success: false, error: 'Campagne non trouvée' });
    if (campaign.status !== 'active') return res.status(400).json({ success: false, error: 'Campagne non active' });
    if (campaign.credits_used + campaign.credits_offered > campaign.total_budget) {
      return res.status(400).json({ success: false, error: 'Budget de la campagne épuisé' });
    }

    const { data, error } = await supabase
      .from('bceg_sponsorship_grants')
      .insert({
        sponsorship_id: req.params.id,
        user_id,
        credits_granted: campaign.credits_offered,
        reason,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from('bceg_sponsorships')
      .update({ credits_used: campaign.credits_used + campaign.credits_offered })
      .eq('id', req.params.id);

    res.json({ success: true, grant: data });
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ success: false, error: 'User déjà sponsorisé sur cette campagne' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/sector-preferences', requireAuth, validateBody(sectorPrefSchema), async (req, res) => {
  try {
    const { sectors = [], whatsapp_phone, notify_via_whatsapp = true, notify_via_email = false } = req.body || {};
    const { data, error } = await supabase
      .from('user_sector_preferences')
      .upsert({
        user_id: req.user.id,
        sectors,
        whatsapp_phone,
        notify_via_whatsapp,
        notify_via_email,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, preferences: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sector-preferences', requireAuth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('user_sector_preferences')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();
    res.json({ success: true, preferences: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/cron/sector-match', async (req, res) => {
  try {
    const key = req.query.key || req.headers['x-cron-secret'];
    const valid = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
    if (!key || !valid.includes(key)) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const { data: prefs } = await supabase
      .from('user_sector_preferences')
      .select('*')
      .eq('notify_via_whatsapp', true)
      .not('whatsapp_phone', 'is', null);

    if (!prefs || prefs.length === 0) {
      return res.json({ success: true, sent: 0, message: 'Aucun user avec préfs WhatsApp' });
    }

    const sinceIso = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data: recentArticles } = await supabase
      .from('articles')
      .select('id, title, category, summary_ai, url, source')
      .gte('created_at', sinceIso)
      .not('summary_ai', 'is', null);

    if (!recentArticles || recentArticles.length === 0) {
      return res.json({ success: true, sent: 0, message: 'Aucun article récent' });
    }

    let sentCount = 0;
    let whapiService = null;
    try { whapiService = require('../services/whapiService'); } catch { /* ignore */ }

    for (const pref of prefs) {
      const userSectors = (pref.sectors || []).map(s => String(s).toLowerCase());
      if (userSectors.length === 0) continue;

      for (const article of recentArticles) {
        const haystack = `${article.title || ''} ${article.category || ''} ${article.summary_ai || ''}`.toLowerCase();
        const matched = userSectors.find(s => haystack.includes(s));
        if (!matched) continue;

        const { data: existing } = await supabase
          .from('user_sector_matches_sent')
          .select('id')
          .eq('user_id', pref.user_id)
          .eq('article_id', article.id)
          .maybeSingle();
        if (existing) continue;

        if (whapiService?.sendWhatsAppMessage && pref.whatsapp_phone) {
          const msg = `🔔 *Opportunité dans ton secteur "${matched}"*\n\n📰 ${article.title}\n\n${(article.summary_ai || '').slice(0, 200)}…\n\n👉 ${article.url || ''}\n\n_Reçue via Gabon Insight × BCEG_`;
          try {
            const r = await whapiService.sendWhatsAppMessage(pref.whatsapp_phone, msg);
            if (r?.success) {
              await supabase.from('user_sector_matches_sent').insert({
                user_id: pref.user_id, article_id: article.id, matched_sector: matched,
              });
              sentCount++;
            }
          } catch {}
        }
      }
    }

    res.json({ success: true, sent: sentCount, users_checked: prefs.length, articles_checked: recentArticles.length });
  } catch (error) {
    console.error('Erreur /cron/sector-match:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// =====================================================================
// API PARTENAIRE BCEG — intégration app/back-office BCEG (niveaux 1→4)
// Auth machine-to-machine par clé API (header x-bceg-api-key) ou, à défaut,
// par le code portail existant (x-bceg-code). Aucune session utilisateur.
// =====================================================================
// =====================================================================

function requirePartnerKey(req, res, next) {
  const apiKey = req.get('x-bceg-api-key') || req.query.api_key;
  const portalCode = req.get('x-bceg-code') || req.query.code;
  const expectedKey = process.env.BCEG_PARTNER_API_KEY;
  const expectedCode = process.env.BCEG_PORTAL_CODE;

  if (!expectedKey && !expectedCode) {
    return res.status(503).json({ success: false, error: 'Intégration partenaire non configurée (BCEG_PARTNER_API_KEY manquante).' });
  }
  const ok = (expectedKey && apiKey && apiKey === expectedKey)
    || (expectedCode && portalCode && portalCode === expectedCode);
  if (!ok) return res.status(401).json({ success: false, error: 'Clé API partenaire invalide.' });

  req.partner = true;
  next();
}

// Identité du porteur (best-effort, depuis la candidature formation)
async function applicantsByUsers(userIds) {
  const map = {};
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return map;
  try {
    const { data } = await supabase
      .from('formation_candidates')
      .select('user_id, full_name, email, phone, province')
      .in('user_id', ids);
    (data || []).forEach(c => { if (c.user_id && !map[c.user_id]) map[c.user_id] = c; });
  } catch (e) {
    console.warn('⚠️ applicantsByUsers:', e.message);
  }
  return map;
}

// Fiche consolidée (résumé) d'un dossier pour le gestionnaire BCEG
function partnerFiche(s, formationPassed, applicant) {
  const risk = assessRisk({ score: s.bceg_score, montant: s.montant_demande, formationPassed });
  const sp = s.saved_projects || {};
  return {
    id: s.id,
    reference: s.bceg_reference || null,
    status: s.status,
    titre: sp.proposition_titre || sp.article_title || null,
    secteur: sp.secteur_selectionne || null,
    ville: sp.ville || null,
    montant_demande: s.montant_demande,
    financing_tier: financingTier(s.montant_demande),
    score: s.bceg_score,
    risk: { level: risk.level, label: risk.label, recommendation: risk.recommendation },
    formation: { passed: risk.formation_passed, total: risk.formation_total, ok: risk.formation_ok },
    applicant: applicant
      ? { name: applicant.full_name, email: applicant.email, phone: applicant.phone, province: applicant.province }
      : { user_id: s.user_id },
    pdf_url: s.pdf_url || null,
    submitted_at: s.submitted_at,
    decision_at: s.decision_at,
    created_at: s.created_at,
  };
}

// GET /api/bceg/partner/ping — test d'intégration / vérif de clé
router.get('/partner/ping', requirePartnerKey, (_req, res) => {
  res.json({ success: true, service: 'gabon-insight', partner: 'bceg', ts: new Date().toISOString() });
});

// GET /api/bceg/partner/deep-link — URLs pour intégration niveaux 1-2 (bouton / webview)
router.get('/partner/deep-link', requirePartnerKey, (_req, res) => {
  const base = (process.env.FRONTEND_URL || 'https://gaboninsight.com').replace(/\/$/, '');
  res.json({
    success: true,
    urls: {
      home: base,
      formations: `${base}/formations`,
      mes_projets: `${base}/business/mes-projets`,
    },
    note: 'Niveau 1 : ouvrir "home"/"formations" dans le navigateur. Niveau 2 : charger ces URLs dans une webview.',
  });
});

// GET /api/bceg/partner/submissions — liste des dossiers (fiches consolidées)
//   filtres: ?status=submitted,in_review,accepted &secteur= &tier=1|2|3 &since=ISO &limit=
router.get('/partner/submissions', requirePartnerKey, async (req, res) => {
  try {
    const { status, secteur, tier, since, limit } = req.query;

    let query = supabase
      .from('bceg_submissions')
      .select(`*, saved_projects(article_title, proposition_titre, secteur_selectionne, ville)`)
      .order('submitted_at', { ascending: false, nullsFirst: false });

    if (status && typeof status === 'string') {
      const list = status.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length) query = query.in('status', list);
    } else {
      query = query.in('status', ['submitted', 'in_review', 'accepted']);
    }
    if (since) query = query.gte('created_at', String(since));
    query = query.limit(Math.min(parseInt(limit, 10) || 100, 500));

    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];
    if (secteur) rows = rows.filter(s => (s.saved_projects?.secteur_selectionne || '') === secteur);
    if (tier) rows = rows.filter(s => String(financingTier(s.montant_demande) || '') === String(tier));

    const [passedMap, applicantMap] = await Promise.all([
      formationPassedByUsers(rows.map(s => s.user_id)),
      applicantsByUsers(rows.map(s => s.user_id)),
    ]);

    const submissions = rows.map(s => partnerFiche(s, passedMap[s.user_id] || 0, applicantMap[s.user_id]));
    res.json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    console.error('Erreur /partner/submissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/partner/submissions/:id — dossier complet (fiche + projet + simulation + score live)
router.get('/partner/submissions/:id', requirePartnerKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_submissions')
      .select(`*, saved_projects(*), bceg_simulations(*)`)
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    const formation = await computeFormationScore(data.user_id);
    const applicantMap = await applicantsByUsers([data.user_id]);

    // Score live = part projet (dernier score stocké) + formation actuelle
    let projectScore = data.bceg_score ?? 0;
    const { data: scoreRow } = await supabase
      .from('bceg_scores').select('breakdown, score').eq('project_id', data.project_id)
      .order('computed_at', { ascending: false }).limit(1).maybeSingle();
    if (scoreRow?.breakdown && typeof scoreRow.breakdown.project_score === 'number') projectScore = scoreRow.breakdown.project_score;
    else if (scoreRow?.score != null) projectScore = scoreRow.score;
    const liveScore = Math.round(SCORE_WEIGHTS.project * projectScore + SCORE_WEIGHTS.formation * formation.score);

    const fiche = partnerFiche(data, formation.meta.passed, applicantMap[data.user_id]);

    res.json({
      success: true,
      dossier: {
        ...fiche,
        score_live: { score: liveScore, color: colorFor(liveScore), project_score: projectScore, formation_score: formation.score, formation_breakdown: formation.breakdown },
        admin_notes: data.admin_notes || null,
        project: data.saved_projects || null,
        simulation: data.bceg_simulations || null,
      },
    });
  } catch (error) {
    console.error('Erreur /partner/submissions/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/bceg/partner/submissions/:id — retour de décision BCEG
//   body: { status: in_review|accepted|rejected, bceg_reference?, decision_note? }
router.patch('/partner/submissions/:id', requirePartnerKey, async (req, res) => {
  try {
    const { status, bceg_reference, decision_note } = req.body || {};
    const valid = ['in_review', 'accepted', 'rejected'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, error: `status doit être l'un de ${valid.join(', ')}` });
    }
    const update = { status, updated_at: new Date().toISOString() };
    if (bceg_reference !== undefined) update.bceg_reference = bceg_reference;
    if (decision_note !== undefined) update.admin_notes = decision_note;
    if (status === 'accepted' || status === 'rejected') update.decision_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('bceg_submissions').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Commission si accepté + notification du porteur (best-effort)
    if (status === 'accepted') await recordCommissionForAccepted(data);
    const notified = await notifyApplicantOfDecision({ submission: data, status });
    console.log(`🤝 [partner] Submission ${req.params.id} → ${status}`);
    res.json({ success: true, submission: data, notified });
  } catch (error) {
    console.error('Erreur PATCH /partner/submissions/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// COMMISSIONS BCEG — suivi des commissions sur dossiers financés
// =====================================================================

// GET /api/bceg/admin/commissions — liste + résumé
router.get('/admin/commissions', requireBcegAccess, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('bceg_commissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const sum = (key, pred = () => true) => rows.filter(pred).reduce((s, r) => s + Number(r[key] || 0), 0);
    res.json({
      success: true,
      commissions: rows,
      summary: {
        count: rows.length,
        rate_default: Number(process.env.BCEG_COMMISSION_RATE || 0.03),
        total_finance: sum('montant_finance'),
        total_commission: sum('montant_commission'),
        pending_commission: sum('montant_commission', r => r.status === 'pending'),
        paid_commission: sum('montant_commission', r => r.status === 'paid'),
      },
    });
  } catch (error) {
    console.error('Erreur /admin/commissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/bceg/admin/commissions/:id — changer le statut (pending/invoiced/paid/cancelled)
router.patch('/admin/commissions/:id', requireBcegAccess, async (req, res) => {
  try {
    const { status } = req.body || {};
    const valid = ['pending', 'invoiced', 'paid', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ success: false, error: `status doit être l'un de ${valid.join(', ')}` });
    }
    const { data, error } = await supabase
      .from('bceg_commissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, commission: data });
  } catch (error) {
    console.error('Erreur PATCH /admin/commissions/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================================
// SSO BCEG (niveau 3) — pont d'authentification par jeton signé HMAC
// La BCEG signe un jeton { email, name?, exp } avec un secret partagé
// (BCEG_SSO_SECRET, à défaut BCEG_PARTNER_API_KEY) au format :
//   base64url(payload) + "." + base64url(HMAC_SHA256(payload, secret))
// puis ouvre : GET /api/bceg/sso?token=...  → l'utilisateur arrive connecté.
// =====================================================================

function ssoSecret() {
  return process.env.BCEG_SSO_SECRET || process.env.BCEG_PARTNER_API_KEY || null;
}

function verifySsoToken(token) {
  const secret = ssoSecret();
  if (!secret) return { error: 'SSO non configuré (BCEG_SSO_SECRET manquant).' };
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return { error: 'Jeton mal formé.' };
  const [p, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { error: 'Signature invalide.' };
  let payload;
  try { payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); }
  catch { return { error: 'Payload illisible.' }; }
  if (!payload?.email) return { error: 'email requis dans le jeton.' };
  if (payload.exp && Date.now() / 1000 > Number(payload.exp)) return { error: 'Jeton expiré.' };
  return { payload };
}

// GET /api/bceg/sso?token=...&redirect=... — connexion via jeton BCEG
router.get('/sso', async (req, res) => {
  try {
    const { token, redirect } = req.query;
    const { payload, error } = verifySsoToken(token);
    if (error) return res.status(401).json({ success: false, error });

    const email = String(payload.email).toLowerCase().trim();
    const base = (process.env.FRONTEND_URL || 'https://gaboninsight.com').replace(/\/$/, '');
    const redirectTo = (redirect && String(redirect).startsWith(base)) ? String(redirect) : `${base}/business/mes-projets`;

    // Crée le compte s'il n'existe pas (ignore l'erreur "déjà inscrit")
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: payload.name || null, source: 'bceg_sso' },
    }).catch(() => {});

    // Génère un magic link qui connecte puis redirige vers l'app
    const { data, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink', email, options: { redirectTo },
    });
    if (linkErr) throw linkErr;
    const actionLink = data?.properties?.action_link || data?.action_link;
    if (!actionLink) throw new Error('Lien de connexion non généré.');

    return res.redirect(302, actionLink);
  } catch (e) {
    console.error('Erreur /bceg/sso:', e);
    res.status(500).json({ success: false, error: 'Échec de la connexion SSO.' });
  }
});

// GET /api/bceg/sso/test-token?email=...&name=...  (ADMIN) — pour tester l'intégration
router.get('/sso/test-token', requireAdmin, (req, res) => {
  const secret = ssoSecret();
  if (!secret) return res.status(503).json({ success: false, error: 'SSO non configuré.' });
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, error: 'email requis' });
  const payload = { email, name: req.query.name || null, exp: Math.floor(Date.now() / 1000) + 300 };
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(p).digest('base64url');
  const token = `${p}.${sig}`;
  const apiBase = `${req.protocol}://${req.get('host')}`;
  res.json({ success: true, token, sso_url: `${apiBase}/api/bceg/sso?token=${token}`, expires_in: 300 });
});

module.exports = router;
