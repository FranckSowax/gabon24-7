const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const geminiService = require('../services/gemini-service');
const { trackAIUsage } = require('../utils/track-ai-usage');
const { requireAuth } = require('../middleware/auth');

// Utiliser le client Supabase partagé avec toutes les configurations
const supabase = supabaseService.supabase;

// Génération courriers IA = coût € → auth obligatoire
router.use(requireAuth);

// Service Gemini 3 Pro - Plus performant et contextuel

/**
 * POST /api/generate-letter
 * Génère un courrier professionnel adapté au destinataire et au contexte
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      projectId,
      recipientType,
      recipientName,
      recipientAddress,
      recipientContact,
      recipientPosition,
      letterSubject,
      letterPurpose,
      specificContext,
      specificRequests
    } = req.body;

    console.log('📝 Génération courrier pour projet:', projectId);
    console.log('🔍 userId:', userId);

    // 1. Récupérer les informations du projet
    const { data: project, error: projectError } = await supabase
      .from('saved_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('❌ Erreur récupération projet:', projectError);
    }
    
    if (!project) {
      console.log('⚠️  Aucun projet trouvé avec ID:', projectId);
    } else {
      console.log('✅ Projet trouvé:', project.title || project.id);
    }

    if (projectError || !project) {
      return res.status(404).json({
        success: false,
        error: 'Projet non trouvé',
        debug: {
          projectId,
          error: projectError?.message
        }
      });
    }

    // 2. Récupérer les informations utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('full_name, email, phone')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // 3. Construire le prompt pour l'IA
    const prompt = buildLetterPrompt({
      project,
      user,
      recipientType,
      recipientName,
      recipientAddress,
      recipientContact,
      recipientPosition,
      letterSubject,
      letterPurpose,
      specificContext,
      specificRequests
    });

    console.log('🚀 Appel Gemini 3 Pro pour génération courrier...');

    // 4. Générer le courrier avec Gemini 3
    const generatedContent = await geminiService.generateText(prompt, {
      systemPrompt: `Tu es un expert en rédaction de courriers professionnels au Gabon. 
Tu dois rédiger des courriers formels, respectueux et adaptés au contexte gabonais.
Le ton doit être professionnel mais cordial, en utilisant les formules de politesse appropriées.
Structure toujours le courrier avec : en-tête (coordonnées), objet, corps du texte, formule de politesse, signature.`,
      temperature: 0.7
    });

    const tokensUsed = Math.ceil(generatedContent.length / 4); // Estimation approximative

    console.log('✅ Courrier généré, taille:', generatedContent.length);

    // 5. Sauvegarder le courrier dans la base de données
    const { data: savedLetter, error: saveError } = await supabase
      .from('generated_letters')
      .insert({
        user_id: userId,
        project_id: projectId,
        recipient_type: recipientType,
        recipient_name: recipientName,
        recipient_address: recipientAddress,
        recipient_contact: recipientContact,
        recipient_position: recipientPosition,
        letter_subject: letterSubject,
        letter_purpose: letterPurpose,
        specific_context: specificContext,
        specific_requests: specificRequests,
        generated_content: generatedContent,
        generation_model: 'gemini-3-pro',
        generation_tokens: tokensUsed,
        document_type: 'custom-letter',
        status: 'draft'
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Erreur sauvegarde:', saveError);
      throw saveError;
    }

    // 6. Ajouter également dans project_documents pour l'onglet Contexte & Bibliothèque
    const { data: document, error: docError } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        user_id: userId,
        document_type: 'custom-letter',
        title: `Courrier - ${recipientName}`,
        description: letterSubject,
        content: generatedContent,
        metadata: {
          letter_id: savedLetter.id,
          recipient_type: recipientType,
          recipient_name: recipientName,
          letter_purpose: letterPurpose
        }
      })
      .select()
      .single();

    if (docError) {
      console.error('❌ Erreur ajout document:', docError);
      throw docError;
    }

    console.log('📄 Document créé avec ID:', document.id);

    // 7. Créer une action dans project_actions pour l'historique
    const { error: actionError } = await supabase
      .from('project_actions')
      .insert({
        project_id: projectId,
        user_id: userId,
        action_type: 'generate-letter',
        action_reference_id: savedLetter.id,
        action_status: 'completed',
        document_id: document.id,
        metadata: {
          letter_id: savedLetter.id,
          document_id: document.id,
          recipient_type: recipientType,
          recipient_name: recipientName,
          letter_subject: letterSubject,
          tokens_used: tokensUsed,
          description: `Courrier généré pour ${recipientName}`
        }
      });

    if (actionError) {
      console.warn('⚠️ Erreur création action:', actionError);
    } else {
      console.log('✅ Action IA créée dans l\'historique');
    }

    // Track AI usage
    await trackAIUsage({
      userId: userId || null,
      serviceName: 'generate-letter',
      description: `Courrier: ${letterSubject || recipientName}`,
      creditsUsed: 0,
      model: 'gemini-3-pro',
      metadata: { letterId: savedLetter.id, projectId, recipientType, letterPurpose }
    });

    console.log('💾 Courrier sauvegardé avec ID:', savedLetter.id);

    // 8. Créer une notification pour l'utilisateur
    try {
      const notificationHelper = require('../utils/notificationHelper');
      await notificationHelper.notifyLetterGenerated(
        userId,
        projectId,
        savedLetter.id,
        recipientName
      );
      console.log('✅ Notification envoyée');
    } catch (notifError) {
      console.warn('⚠️ Erreur notification:', notifError);
      // Ne pas bloquer la réponse si la notification échoue
    }

    res.json({
      success: true,
      letter: savedLetter,
      document: document,
      message: 'Courrier généré avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur génération courrier:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération du courrier'
    });
  }
});

/**
 * Construit le prompt pour générer le courrier
 */
function buildLetterPrompt(params) {
  const {
    project,
    user,
    recipientType,
    recipientName,
    recipientAddress,
    recipientContact,
    recipientPosition,
    letterSubject,
    letterPurpose,
    specificContext,
    specificRequests
  } = params;

  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return `Rédige un courrier professionnel formel pour le contexte suivant :

**INFORMATIONS EXPÉDITEUR:**
Nom: ${user.full_name}
Email: ${user.email}
Téléphone: ${user.phone || 'Non renseigné'}

**PROJET:**
Titre: ${project.project_name}
Secteur: ${project.sector || 'Non spécifié'}
Description: ${project.project_description || 'Non spécifié'}
Budget estimé: ${project.budget ? project.budget + ' FCFA' : 'Non spécifié'}

**DESTINATAIRE:**
Type: ${recipientType}
Nom: ${recipientName}
${recipientPosition ? `Fonction: ${recipientPosition}` : ''}
${recipientAddress ? `Adresse: ${recipientAddress}` : ''}
${recipientContact ? `Contact: ${recipientContact}` : ''}

**OBJET DU COURRIER:**
${letterSubject}

**OBJECTIF DU COURRIER:**
${getLetterPurposeDescription(letterPurpose)}

${specificContext ? `**CONTEXTE SPÉCIFIQUE:**\n${specificContext}\n` : ''}
${specificRequests ? `**DEMANDES SPÉCIFIQUES À INCLURE:**\n${specificRequests}\n` : ''}

**INSTRUCTIONS:**
1. Utilise la date du jour: ${today}
2. Commence par les coordonnées de l'expéditeur en haut à gauche
3. Ajoute les coordonnées du destinataire en haut à droite
4. Inclus l'objet du courrier
5. Rédige un corps de texte professionnel avec :
   - Introduction et contexte
   - Présentation du projet et de sa pertinence
   - Demande claire et argumentée
   - Bénéfices pour le destinataire / l'institution
6. Termine avec une formule de politesse appropriée au contexte gabonais
7. Ajoute la signature avec nom et coordonnées de l'expéditeur

**IMPORTANT:**
- Adapte le ton selon le type de destinataire (administration = très formel, partenaire = professionnel cordial)
- Utilise les expressions et formules de politesse appropriées au contexte gabonais
- Sois précis et convaincant sans être excessif
- Structure le texte de manière claire et professionnelle

Rédige maintenant le courrier complet:`;
}

/**
 * Retourne une description de l'objectif du courrier
 */
function getLetterPurposeDescription(purpose) {
  const purposes = {
    'demande_financement': 'Demande de financement pour le projet',
    'demande_autorisation': 'Demande d\'autorisation administrative',
    'proposition_partenariat': 'Proposition de partenariat commercial',
    'demande_soutien': 'Demande de soutien institutionnel',
    'presentation_projet': 'Présentation officielle du projet',
    'demande_rdv': 'Demande de rendez-vous',
    'remerciement': 'Lettre de remerciement',
    'relance': 'Lettre de relance',
    'autres': 'Autre objectif spécifique'
  };

  return purposes[purpose] || purpose;
}

/**
 * GET /api/generate-letter/:projectId
 * Récupère tous les courriers d'un projet
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    const { data: letters, error } = await supabase
      .from('generated_letters')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      letters
    });

  } catch (error) {
    console.error('❌ Erreur récupération courriers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/generate-letter/:letterId
 * Supprime un courrier
 */
router.delete('/:letterId', async (req, res) => {
  try {
    const { letterId } = req.params;
    const { userId } = req.query;

    const { error } = await supabase
      .from('generated_letters')
      .delete()
      .eq('id', letterId)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Courrier supprimé'
    });

  } catch (error) {
    console.error('❌ Erreur suppression courrier:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
