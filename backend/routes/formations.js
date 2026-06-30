/**
 * 🎓 Formations Entrepreneur BCEG — Phase 1
 * Candidature publique + gestion/sélection admin.
 */
const express = require('express');
const supabaseService = require('../supabase-config');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const { supabase } = supabaseService;

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

module.exports = router;
