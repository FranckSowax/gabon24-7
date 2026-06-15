const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const emailService = require('../services/emailService');
const { requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

// ==================== SCHÉMAS DE VALIDATION (.passthrough) ====================
const submitFeedbackSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  type: z.string().min(1).max(50),
  message: z.string().min(1, 'message requis').max(5000),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  userEmail: z.string().email().max(255).optional().nullable(),
  userName: z.string().max(200).optional().nullable(),
}).passthrough();

const feedbackStatusSchema = z.object({
  status: z.string().min(1).max(50),
}).passthrough();

// POST /api/feedback - Submit new feedback
router.post('/', validateBody(submitFeedbackSchema), async (req, res) => {
  try {
    const { userId, type, message, rating, userEmail, userName } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        message: 'Le type et le message sont requis'
      });
    }

    // 1. Save to Supabase
    const { data: feedback, error } = await supabaseService.supabase
      .from('feedbacks')
      .insert({
        user_id: userId || null,
        type,
        message,
        rating: rating || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Send email notification to admin
    // Don't block response for email sending
    emailService.sendFeedbackNotification({
      userEmail: userEmail || 'Anonyme',
      userName: userName || 'Utilisateur',
      feedbackType: type,
      message,
      rating: rating || 'N/A'
    }).catch(err => console.error('❌ Error sending feedback email:', err));

    res.json({
      success: true,
      feedback,
      message: 'Feedback envoyé avec succès'
    });

  } catch (error) {
    console.error('❌ Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du feedback',
      error: error.message
    });
  }
});

// GET /api/feedback - Get all feedbacks
// 🔒 SÉCURISÉ: Authentification admin requise (expose emails/noms utilisateurs)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { data: feedbacks, error } = await supabaseService.supabase
      .from('feedbacks')
      .select(`
        *,
        users:user_id (
          email,
          full_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      feedbacks
    });
  } catch (error) {
    console.error('❌ Error fetching feedbacks:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des feedbacks'
    });
  }
});

// PATCH /api/feedback/:id/status - Update feedback status
// 🔒 SÉCURISÉ: Authentification admin requise
router.patch('/:id/status', requireAdmin, validateBody(feedbackStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Statut invalide'
      });
    }

    const { data: feedback, error } = await supabaseService.supabase
      .from('feedbacks')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('❌ Error updating feedback status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

module.exports = router;
