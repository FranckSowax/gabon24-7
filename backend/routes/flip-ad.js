/**
 * Routes pour la configuration de la Flip Ad sur la sidebar profil.
 * - GET  /api/flip-ad           → public, renvoie la config active (cache 60s)
 * - PUT  /api/flip-ad           → admin, met à jour la config
 * - POST /api/flip-ad/sign-upload → admin, signed URL pour upload image
 * - GET  /api/flip-ad/history   → admin, 10 dernières snapshots
 * - POST /api/flip-ad/restore/:historyId → admin, restaure une ancienne config
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const supabase = supabaseService.supabase;

function sanitizeText(input, maxLen) {
  if (input == null) return null;
  const s = String(input).replace(/<[^>]*>/g, '').trim();
  return s.length === 0 ? null : s.slice(0, maxLen);
}

function isValidRedirectUrl(url) {
  if (!url) return true;
  if (typeof url !== 'string') return false;
  return /^https:\/\/|^\//.test(url);
}

function isValidColorGradient(css) {
  if (!css) return true;
  return /^(linear|radial)-gradient\(.+\)$/i.test(css)
    && !css.includes('expression(')
    && !css.includes('javascript:');
}

// ----- GET public -----
router.get('/', async (_req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('flip_ad_config')
      .select('*')
      .eq('enabled', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    res.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');
    res.json({ success: true, config: data || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----- PUT admin -----
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const update = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      duration_ms: Math.max(500, Math.min(15000, parseInt(body.duration_ms, 10) || 4000)),
      redirect_url: isValidRedirectUrl(body.redirect_url) ? sanitizeText(body.redirect_url, 500) : null,
      redirect_mode: ['none', 'after_flip', 'on_back_click'].includes(body.redirect_mode) ? body.redirect_mode : 'after_flip',
      image_url: sanitizeText(body.image_url, 1000),
      title: sanitizeText(body.title, 60),
      subtitle: sanitizeText(body.subtitle, 160),
      cta_label: sanitizeText(body.cta_label, 40),
      background_css: isValidColorGradient(body.background_css) ? body.background_css : null,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('flip_ad_config')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('flip_ad_config')
        .update(update)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('flip_ad_config')
        .insert(update)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json({ success: true, config: result });
  } catch (error) {
    console.error('Erreur PUT /api/flip-ad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----- POST signed upload URL pour image -----
router.post('/sign-upload', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { file_name } = req.body || {};
    if (!file_name) {
      return res.status(400).json({ success: false, error: 'file_name requis' });
    }
    const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage
      .from('flip-ads')
      .createSignedUploadUrl(path);
    if (error) throw error;

    const { data: pub } = supabase.storage.from('flip-ads').getPublicUrl(path);
    res.json({
      success: true,
      signedUrl: data.signedUrl,
      path: data.path,
      publicUrl: pub.publicUrl,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----- GET history admin -----
router.get('/history', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('flip_ad_config_history')
      .select('*')
      .order('saved_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    res.json({ success: true, history: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----- POST restore -----
router.post('/restore/:historyId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: snap } = await supabase
      .from('flip_ad_config_history')
      .select('snapshot, config_id')
      .eq('id', req.params.historyId)
      .maybeSingle();
    if (!snap) return res.status(404).json({ success: false, error: 'Snapshot introuvable' });

    const s = snap.snapshot || {};
    const update = {
      enabled: s.enabled,
      duration_ms: s.duration_ms,
      redirect_url: s.redirect_url,
      redirect_mode: s.redirect_mode,
      image_url: s.image_url,
      title: s.title,
      subtitle: s.subtitle,
      cta_label: s.cta_label,
      background_css: s.background_css,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      updated_by: req.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('flip_ad_config')
      .update(update)
      .eq('id', snap.config_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, config: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
