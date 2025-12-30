/**
 * 📄 ROUTES DOCUMENTS - Gestion des documents sauvegardés
 *
 * ⚠️ SÉCURITÉ: Toutes les routes requièrent une authentification
 * et vérifient que l'utilisateur accède uniquement à ses propres documents
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/docs
 * Récupère tous les documents sauvegardés de l'utilisateur connecté
 * 🔒 SÉCURISÉ: Authentification requise, accès uniquement aux propres documents
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // Utiliser l'ID de l'utilisateur authentifié (pas de paramètre query!)
    const userId = req.user.id;

    const { data: docs, error } = await supabaseService.supabase
      .from('saved_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      docs: docs || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/docs/:id
 * Supprime un document appartenant à l'utilisateur connecté
 * 🔒 SÉCURISÉ: Authentification requise, vérification du propriétaire
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Utiliser l'ID de l'utilisateur authentifié
    const userId = req.user.id;

    const { error } = await supabaseService.supabase
      .from('saved_documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Vérifie que le document appartient à l'utilisateur

    if (error) throw error;

    res.json({
      success: true,
      message: 'Document supprimé'
    });

  } catch (error) {
    console.error('❌ Erreur suppression document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
