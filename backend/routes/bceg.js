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
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
