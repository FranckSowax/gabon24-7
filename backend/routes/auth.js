/**
 * Routes d'authentification - Sécurité anti-bot
 *
 * Inclut:
 * - Validation Cloudflare Turnstile
 * - Rate limiting sur les endpoints sensibles
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

// ==================== SCHÉMAS DE VALIDATION ====================
const verifyTurnstileSchema = z.object({
  token: z.string().min(1, 'token requis').max(4096),
});

const createProfileSchema = z.object({
  userId: z.string().uuid('userId invalide'),
  email: z.string().email('email invalide').max(255),
  fullName: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  whatsappNumber: z.string().max(40).optional().nullable(),
  subscriptionType: z.string().max(50).optional().nullable(),
});

const uploadAvatarSchema = z.object({
  userId: z.string().uuid('userId invalide'),
  imageData: z.string().min(1, 'imageData requis').max(15_000_000), // base64, ~10MB max
  fileName: z.string().min(1).max(255).optional().nullable(),
});

// Clé secrète Turnstile (obligatoire en production)
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
if (!TURNSTILE_SECRET_KEY) {
  console.warn('⚠️ TURNSTILE_SECRET_KEY non configurée - la vérification CAPTCHA sera désactivée');
}

// Rate limiting simple en mémoire (pour production, utiliser Redis)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 tentatives par minute

/**
 * Middleware de rate limiting pour les endpoints d'auth
 */
function authRateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const now = Date.now();

  // Nettoyer les anciennes entrées
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }

  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return next();
  }

  if (now - record.timestamp > RATE_LIMIT_WINDOW) {
    // Nouvelle fenêtre
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: 'Trop de tentatives. Veuillez réessayer dans une minute.',
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - record.timestamp)) / 1000)
    });
  }

  record.count++;
  next();
}

/**
 * POST /api/auth/verify-turnstile
 * Vérifie un token Turnstile avec l'API Cloudflare
 */
router.post('/verify-turnstile', authRateLimit, validateBody(verifyTurnstileSchema), async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token de vérification manquant'
      });
    }

    // Obtenir l'IP du client
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Vérifier le token avec l'API Cloudflare Turnstile
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (data.success) {
      // Token valide
      console.log(`✅ Turnstile vérifié pour IP: ${ip}`);
      return res.json({
        success: true,
        message: 'Vérification réussie'
      });
    } else {
      // Token invalide
      console.warn(`⚠️ Turnstile échoué pour IP: ${ip}`, data['error-codes']);
      return res.status(400).json({
        success: false,
        message: 'Échec de la vérification de sécurité',
        errors: data['error-codes']
      });
    }

  } catch (error) {
    console.error('❌ Erreur vérification Turnstile:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
});

/**
 * POST /api/auth/create-profile
 * Crée le profil utilisateur après inscription Supabase Auth
 * Utilise service_role pour bypass RLS
 */
router.post('/create-profile', authRateLimit, validateBody(createProfileSchema), async (req, res) => {
  try {
    const { userId, email, fullName, phone, whatsappNumber, subscriptionType } = req.body;

    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        error: 'userId et email sont requis'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      // L'utilisateur existe déjà, mettre à jour
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          phone: phone,
          whatsapp_number: whatsappNumber,
          subscription_type: subscriptionType || 'free',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Erreur mise à jour profil:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de la mise à jour du profil'
        });
      }

      return res.json({ success: true, message: 'Profil mis à jour' });
    }

    // Créer le nouvel utilisateur
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        phone: phone,
        whatsapp_number: whatsappNumber,
        subscription_type: subscriptionType || 'free',
        subscription_status: 'active',
        subscription_start_date: new Date().toISOString(),
        preferred_language: 'fr',
        notification_preferences: {
          sms: false,
          email: true,
          whatsapp: true
        },
        is_active: true,
        journalist_verified: false,
        credits_balance: 0
      });

    if (insertError) {
      console.error('❌ Erreur création profil:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Database error saving new user'
      });
    }

    // Créer aussi l'entrée user_credits
    await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        balance: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    console.log(`✅ Profil créé pour: ${email}`);
    return res.json({ success: true, message: 'Profil créé avec succès' });

  } catch (error) {
    console.error('❌ Erreur create-profile:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/upload-avatar
 * Upload d'avatar utilisateur via le backend (bypass RLS)
 */
router.post('/upload-avatar', validateBody(uploadAvatarSchema), async (req, res) => {
  try {
    const { userId, imageData, fileName } = req.body;

    if (!userId || !imageData) {
      return res.status(400).json({
        success: false,
        error: 'userId et imageData sont requis'
      });
    }

    // Décoder l'image base64
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Vérifier la taille (max 5MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'Image trop grande (max 5MB)'
      });
    }

    // Créer le chemin du fichier
    const fileExt = fileName?.split('.').pop() || 'jpg';
    const uniqueFileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${uniqueFileName}`;

    // Upload vers Supabase Storage avec service_role
    const { data, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, imageBuffer, {
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Erreur upload avatar:', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'upload de l\'image'
      });
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    // Mettre à jour le profil utilisateur
    const { error: updateError } = await supabase
      .from('users')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Erreur mise à jour avatar_url:', updateError);
      // Continuer quand même - l'image est uploadée
    }

    console.log(`✅ Avatar uploadé pour user: ${userId}`);
    return res.json({
      success: true,
      url: publicUrl,
      message: 'Avatar uploadé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur upload-avatar:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auth/security-status
 * Retourne le statut de sécurité (pour debug/monitoring)
 */
router.get('/security-status', (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const record = rateLimitMap.get(ip);

  res.json({
    success: true,
    turnstileEnabled: !!TURNSTILE_SECRET_KEY && TURNSTILE_SECRET_KEY !== '1x0000000000000000000000000000000AA',
    rateLimiting: {
      windowMs: RATE_LIMIT_WINDOW,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      currentCount: record ? record.count : 0,
      remaining: record ? Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count) : RATE_LIMIT_MAX_REQUESTS
    }
  });
});

module.exports = router;
