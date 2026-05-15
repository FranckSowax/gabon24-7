/**
 * BCEG Project — endpoints Phase 2
 *
 *   POST /api/bceg/simulate    Calcule mensualité crédit BCEG
 *   POST /api/bceg/score       Calcule le BCEG Score (0-100) d'un projet
 *   GET  /api/bceg/stats       Stats globales pour les compteurs landing
 *   GET  /api/bceg/my-score    Dernier score connu d'un projet user
 *   GET  /api/bceg/leaderboard Top projets anonymisés (Phase 5 — placeholder ici)
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { generateBcegDossier } = require('../services/bcegPdfService');

const supabase = supabaseService.supabase;
const BCEG_TARGET_EMAIL = process.env.BCEG_TARGET_EMAIL || 'commercial@bceg.ga';

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
// POST /api/bceg/simulate
// =====================================================================
router.post('/simulate', async (req, res) => {
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
router.post('/score', async (req, res) => {
  try {
    const { project_id = null, step = 1, persist = false, ...formData } = req.body || {};

    const result = computeBcegScore(formData);

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
    res.json({ success: true, score: data });
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
router.post('/submit', requireAuth, async (req, res) => {
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
router.get('/admin/submissions', requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase
      .from('bceg_submissions')
      .select(`
        *,
        saved_projects(article_title, proposition_titre, secteur_selectionne, problematique_centrale, proposition_description),
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
        (s.bceg_reference || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Erreur /admin/submissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/admin/submissions/:id — détail complet d'une soumission
router.get('/admin/submissions/:id', requireAdmin, async (req, res) => {
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

    res.json({ success: true, submission: data, last_score: lastScore });
  } catch (error) {
    console.error('Erreur /admin/submissions/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/bceg/admin/submissions/:id/status — changer statut + notes
router.patch('/admin/submissions/:id/status', requireAdmin, async (req, res) => {
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

    // TODO Phase 4 bis : envoyer notification WhatsApp à l'user
    // (via whapiService.sendWhatsAppMessage si le user a un phone)
    // Pour l'instant on log juste
    console.log(`📋 Submission ${id} → ${status} (admin: ${req.user.id})`);

    res.json({ success: true, submission: data });
  } catch (error) {
    console.error('Erreur PATCH /admin/submissions/:id/status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bceg/admin/stats — stats globales pour le header dashboard
router.get('/admin/stats', requireAdmin, async (_req, res) => {
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
router.get('/admin/export', requireAdmin, async (_req, res) => {
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
router.post('/generate-dossier', requireAuth, async (req, res) => {
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

// =====================================================================
// POST /api/bceg/submit-full — soumission complète : PDF + email BCEG + DB
// =====================================================================
router.post('/submit-full', requireAuth, async (req, res) => {
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

    const montant_demande = simulation?.montant_demande || null;
    if (!montant_demande) {
      return res.status(400).json({ success: false, error: 'Une simulation BCEG est requise avant de soumettre' });
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
router.post('/mentor-chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [], project_context = null } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'message requis' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'Service Gemini non configuré' });
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

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

    const chatHistory = (Array.isArray(history) ? history : [])
      .slice(-8)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '').slice(0, 2000) }],
      }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    });
    const result = await chat.sendMessage(message.slice(0, 2000));
    const reply = result.response.text();

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

router.post('/appointments', requireAuth, async (req, res) => {
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

router.patch('/admin/appointments/:id', requireAdmin, async (req, res) => {
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

router.post('/due-diligence/sign-upload', requireAuth, async (req, res) => {
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

router.post('/due-diligence', requireAuth, async (req, res) => {
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

router.patch('/admin/due-diligence/:id', requireAdmin, async (req, res) => {
  try {
    const update = {
      ...req.body,
      verified_by: req.user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
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

router.post('/admin/sponsorships', requireAdmin, async (req, res) => {
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

router.post('/admin/sponsorships/:id/grant', requireAdmin, async (req, res) => {
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

router.put('/sector-preferences', requireAuth, async (req, res) => {
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

module.exports = router;
