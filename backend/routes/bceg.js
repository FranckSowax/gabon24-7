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

const supabase = supabaseService.supabase;

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

module.exports = router;
