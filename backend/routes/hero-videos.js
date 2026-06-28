/**
 * 🎬 Hero Videos — section vidéos d'accueil (21:9, autoplay en boucle)
 * Upload mp4 + compression serveur (ffmpeg, qualité conservée) + CRUD admin.
 */
const express = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const supabaseService = require('../supabase-config');
const { requireAdmin } = require('../middleware/auth');

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();
const { supabase } = supabaseService;
const BUCKET = 'hero-videos';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// Compresse une vidéo (H.264, qualité conservée, max 1920px de large, faststart, sans audio)
function compressVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-crf', '24',
        '-preset', 'medium',
        '-vf', "scale='min(1920,iw)':-2",
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-an', // banner muet en boucle → audio retiré (réduit fortement la taille)
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

// ---------- PUBLIC : vidéos actives ----------
router.get('/active', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('hero_videos')
      .select('id, title, description, cta_label, cta_url, video_url, order_index')
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ success: true, videos: data || [] });
  } catch (error) {
    console.error('❌ hero-videos/active:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur', videos: [] });
  }
});

// ---------- ADMIN : liste complète ----------
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('hero_videos')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ success: true, videos: data || [] });
  } catch (error) {
    console.error('❌ hero-videos list:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ---------- ADMIN : upload + compression ----------
router.post('/', requireAdmin, upload.single('video'), async (req, res) => {
  const tmpFiles = [];
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Fichier vidéo manquant' });
    }
    const { title, description, cta_label, cta_url, order_index } = req.body;

    const stamp = Date.now();
    const inputPath = path.join(os.tmpdir(), `hero-in-${stamp}.mp4`);
    const outputPath = path.join(os.tmpdir(), `hero-out-${stamp}.mp4`);
    tmpFiles.push(inputPath, outputPath);

    fs.writeFileSync(inputPath, req.file.buffer);

    // Compression (qualité conservée)
    console.log(`🎬 Compression vidéo hero (${(req.file.size / 1024 / 1024).toFixed(1)} Mo)…`);
    await compressVideo(inputPath, outputPath);
    const compressed = fs.readFileSync(outputPath);
    console.log(`✅ Compressé → ${(compressed.length / 1024 / 1024).toFixed(1)} Mo`);

    const fileName = `hero-${stamp}.mp4`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, compressed, { contentType: 'video/mp4', upsert: false });
    if (upErr) throw new Error(`Upload échoué: ${upErr.message}`);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const videoUrl = urlData.publicUrl;

    const { data: row, error: insErr } = await supabase
      .from('hero_videos')
      .insert({
        title: title || null,
        description: description || null,
        cta_label: cta_label || null,
        cta_url: cta_url || null,
        video_url: videoUrl,
        order_index: order_index ? parseInt(order_index, 10) : 0,
        is_active: true,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    res.json({ success: true, video: row });
  } catch (error) {
    console.error('❌ hero-videos upload:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur upload' });
  } finally {
    tmpFiles.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
  }
});

// ---------- ADMIN : mise à jour (titre, texte, CTA, ordre, actif) ----------
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, cta_label, cta_url, order_index, is_active } = req.body;
    const patch = { updated_at: new Date().toISOString() };
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (cta_label !== undefined) patch.cta_label = cta_label;
    if (cta_url !== undefined) patch.cta_url = cta_url;
    if (order_index !== undefined) patch.order_index = parseInt(order_index, 10) || 0;
    if (is_active !== undefined) patch.is_active = !!is_active;

    const { data, error } = await supabase
      .from('hero_videos')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, video: data });
  } catch (error) {
    console.error('❌ hero-videos update:', error);
    res.status(500).json({ success: false, error: 'Erreur mise à jour' });
  }
});

// ---------- ADMIN : suppression (ligne + fichier storage) ----------
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: row } = await supabase.from('hero_videos').select('video_url').eq('id', id).single();

    const { error } = await supabase.from('hero_videos').delete().eq('id', id);
    if (error) throw error;

    // Nettoyer le fichier du bucket (best-effort)
    if (row?.video_url) {
      const fileName = row.video_url.split(`/${BUCKET}/`).pop();
      if (fileName) { try { await supabase.storage.from(BUCKET).remove([fileName]); } catch {} }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('❌ hero-videos delete:', error);
    res.status(500).json({ success: false, error: 'Erreur suppression' });
  }
});

module.exports = router;
