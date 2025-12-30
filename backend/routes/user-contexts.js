const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');

// GET /api/user-contexts - Récupérer les contextes sauvegardés d'un utilisateur
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId requis' 
      });
    }

    console.log('📋 Récupération contextes pour userId:', userId);

    const { data, error } = await supabaseService.supabase
      .from('user_contexts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log('✅ Contextes récupérés:', data?.length || 0);

    res.json({
      success: true,
      contexts: data || []
    });

  } catch (error) {
    console.error('❌ Erreur get user-contexts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/user-contexts - Sauvegarder un nouveau contexte
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      contextName,
      situation,
      competences,
      disponibilite,
      objectif_delai,
      experience_entrepreneuriale,
      contraintes,
      budget_principal
    } = req.body;

    if (!userId || !contextName) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId et contextName requis' 
      });
    }

    console.log('💾 Sauvegarde contexte:', contextName, 'pour userId:', userId);

    // Vérifier le nombre de contextes existants
    const { data: existing, error: countError } = await supabaseService.supabase
      .from('user_contexts')
      .select('id')
      .eq('user_id', userId);

    if (countError) {
      console.error('❌ Erreur comptage contextes:', countError);
      return res.status(500).json({ 
        success: false, 
        error: countError.message 
      });
    }

    // Limite de 3 contextes
    if (existing && existing.length >= 3) {
      return res.status(400).json({ 
        success: false, 
        error: 'Limite de 3 contextes atteinte. Supprimez-en un pour en ajouter un nouveau.',
        limit_reached: true
      });
    }

    // Insérer le nouveau contexte
    const { data, error } = await supabaseService.supabase
      .from('user_contexts')
      .insert([{
        user_id: userId,
        context_name: contextName,
        situation: situation || '',
        competences: competences || [],
        disponibilite: disponibilite || '',
        objectif_delai: objectif_delai || '',
        experience_entrepreneuriale: experience_entrepreneuriale || '',
        contraintes: contraintes || '',
        budget_principal: budget_principal || ''
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase insert:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log('✅ Contexte sauvegardé, ID:', data.id);

    res.json({
      success: true,
      message: 'Contexte sauvegardé avec succès',
      context: data
    });

  } catch (error) {
    console.error('❌ Erreur save user-context:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/user-contexts/:id - Supprimer un contexte
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId requis' 
      });
    }

    console.log('🗑️ Suppression contexte ID:', id, 'pour userId:', userId);

    const { error } = await supabaseService.supabase
      .from('user_contexts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur Supabase delete:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    console.log('✅ Contexte supprimé');

    res.json({
      success: true,
      message: 'Contexte supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur delete user-context:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
