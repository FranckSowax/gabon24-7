const express = require('express');
const OpenAI = require('openai');
const supabaseService = require('../../supabase-config');
const aiConfigService = require('../../services/ai-config-service');
const { checkUserCredits, deductCredits } = require('../../middleware/ai-validation');
const pricingService = require('../../services/pricing-service');
const router = express.Router();

const { supabase } = supabaseService;

// Initialiser OpenAI GPT-4.1-mini
let openai = null;
const OPENAI_MODEL = 'gpt-4.1-mini';
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn('⚠️ OPENAI_API_KEY non configurée - Routes project-chat désactivées');
}

// Envoyer un message et obtenir réponse
router.post('/send-message', async (req, res) => {
  try {
    const { 
      conversationId, 
      projectId, 
      userId, 
      modelType, 
      message, 
      contextData 
    } = req.body;

    if (!projectId || !userId || !modelType || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Paramètres manquants' 
      });
    }

    if (!openai) {
      return res.status(503).json({
        success: false,
        error: 'Service IA non disponible'
      });
    }

    const configuredModel = await aiConfigService.getModel('chat_message');
    const creditsNeeded = await pricingService.getServiceCost('chat_message');

    // Vérifier crédits utilisateur avec le nouveau système
    const creditCheck = await checkUserCredits(userId, 'chat_message');

    if (!creditCheck.allowed) {
      return res.status(402).json({
        success: false,
        error: creditCheck.message || 'Crédits insuffisants',
        balance: creditCheck.details?.available || 0,
        required: creditCheck.details?.required || creditsNeeded,
        missing: creditCheck.details?.missing || 0
      });
    }

    // Vérifier que le projet existe
    const { data: project, error: projectError } = await supabase
      .from('saved_projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Projet non trouvé:', projectId);
      return res.status(404).json({ 
        success: false, 
        error: 'Projet non trouvé. Veuillez sauvegarder le projet avant d\'utiliser le chat.' 
      });
    }

    let currentConversationId = conversationId;

    // Créer nouvelle conversation si nécessaire
    if (!currentConversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('project_chat_conversations')
        .insert([{
          project_id: projectId,
          user_id: userId,
          model_type: modelType,
          context_snapshot: contextData
        }])
        .select()
        .single();

      if (convError) {
        console.error('Erreur création conversation:', convError);
        return res.status(500).json({ success: false, error: convError.message });
      }

      currentConversationId = newConv.id;
    }

    // Récupérer historique messages
    const { data: previousMessages } = await supabase
      .from('project_chat_messages')
      .select('*')
      .eq('conversation_id', currentConversationId)
      .order('created_at', { ascending: true });

    // Construire le contexte pour l'IA
    const systemPrompt = `Tu es un assistant IA expert en business et entrepreneuriat.
Tu aides l'utilisateur avec son projet business spécifique.

CONTEXTE DU PROJET:
Titre: ${contextData.project.titre}
Description: ${contextData.project.description}
Secteur: ${contextData.project.secteur}
Budget: ${contextData.project.budget}
Phase actuelle: ${contextData.project.phase}
Progression: ${contextData.project.progression}%

CONTEXTE CUMULATIF:
${contextData.cumulativeContext?.map(c => `- [${c.type}] ${c.content}`).join('\n') || 'Aucun'}

DOCUMENTS GÉNÉRÉS:
${contextData.documents?.map(d => `- ${d.type}: ${d.title}\n  ${d.summary}`).join('\n') || 'Aucun'}

${contextData.planActionSteps ? `PLAN D'ACTION:
${contextData.planActionSteps.map(s => `${s.step}. ${s.title} (${s.status})`).join('\n')}` : ''}

${contextData.notes?.length > 0 ? `NOTES:
${contextData.notes.map(n => `- ${n.content}`).join('\n')}` : ''}

INSTRUCTIONS:
- Réponds de manière précise et concise
- Utilise le contexte du projet pour personnaliser tes réponses
- Donne des conseils actionnables
- Sois encourageant et professionnel
- Si tu ne sais pas, dis-le honnêtement`;

    // Construire l'historique pour l'IA
    const conversationHistory = [
      { role: 'system', content: systemPrompt },
      ...(previousMessages || []).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    // Appel à OpenAI avec le modèle configuré
    let aiResponse;
    try {
      console.log(`🤖 Appel OpenAI ${OPENAI_MODEL}`);

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: conversationHistory,
        max_tokens: 800,
        temperature: 0.7
      });

      aiResponse = completion.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

      console.log(`✅ Réponse OpenAI reçue`);
    } catch (aiError) {
      console.error('Erreur appel Kimi:', aiError);
      aiResponse = "Désolé, je rencontre une difficulté technique. Pouvez-vous reformuler votre question ?";
    }

    // Sauvegarder message utilisateur
    await supabase
      .from('project_chat_messages')
      .insert([{
        conversation_id: currentConversationId,
        role: 'user',
        content: message,
        credits_consumed: 0
      }]);

    // Sauvegarder réponse assistant
    const { data: assistantMessage, error: msgError } = await supabase
      .from('project_chat_messages')
      .insert([{
        conversation_id: currentConversationId,
        role: 'assistant',
        content: aiResponse,
        credits_consumed: creditsNeeded
      }])
      .select()
      .single();

    if (msgError) {
      console.error('Erreur sauvegarde message:', msgError);
    }

    // Mettre à jour conversation
    // Récupérer credits actuels
    const { data: convData } = await supabase
      .from('project_chat_conversations')
      .select('total_credits_used')
      .eq('id', currentConversationId)
      .single();

    const currentCredits = convData?.total_credits_used || 0;

    await supabase
      .from('project_chat_conversations')
      .update({
        total_messages: (previousMessages?.length || 0) + 2,
        total_credits_used: currentCredits + creditsNeeded
      })
      .eq('id', currentConversationId);

    // Débiter crédits utilisateur avec le nouveau système
    const deductResult = await deductCredits(
      userId,
      'chat_message',
      currentConversationId,
      { conversationId: currentConversationId, projectId }
    );

    if (!deductResult.success) {
      console.error('⚠️ Erreur débit crédits:', deductResult.error);
    }

    res.json({
      success: true,
      conversationId: currentConversationId,
      message: assistantMessage,
      creditsUsed: creditsNeeded,
      balance: deductResult?.newBalance
    });

  } catch (error) {
    console.error('❌ Erreur send-message:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Terminer conversation et générer rapport
router.post('/end-conversation', async (req, res) => {
  try {
    const { conversationId, projectId } = req.body;

    if (!conversationId || !projectId) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    // Récupérer tous les messages
    const { data: messages } = await supabase
      .from('project_chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Récupérer la conversation (user_id + idempotence)
    const { data: conversation } = await supabase
      .from('project_chat_conversations')
      .select('user_id, ended_at')
      .eq('id', conversationId)
      .single();

    // Idempotence : déjà terminée → ne pas recréer de document
    if (conversation?.ended_at) {
      return res.json({ success: true, alreadyEnded: true, message: 'Conversation déjà archivée' });
    }

    const userId = conversation?.user_id;
    const now = new Date().toISOString();

    // Conversation vide → rien à archiver (on marque juste comme terminée)
    if (!messages || messages.length === 0) {
      await supabase
        .from('project_chat_conversations')
        .update({ ended_at: now })
        .eq('id', conversationId);
      return res.json({ success: true, empty: true, message: 'Conversation vide, rien à archiver' });
    }

    const conversationDate = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Transcript complet (conservé)
    const transcript = messages
      .map(m => `**${m.role === 'user' ? 'Vous' : 'Gabon Insight'}:** ${m.content}`)
      .join('\n\n');

    // Résumé IA structuré de la conversation
    let aiSummary = '';
    if (openai) {
      try {
        const summaryPrompt = `Voici une conversation entre un entrepreneur gabonais et son conseiller IA "Gabon Insight".\n\n${messages.map(m => `${m.role === 'user' ? 'Entrepreneur' : 'Conseiller'}: ${m.content}`).join('\n')}\n\nRédige un RÉSUMÉ structuré et actionnable en français (markdown) avec ces sections :\n## 🎯 Sujets abordés\n## 💡 Conseils clés donnés\n## ✅ Décisions / points validés\n## 👉 Prochaines actions recommandées\n\nSois concis et concret. Contexte gabonais, montants en FCFA.`;
        const completion = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: summaryPrompt }],
          temperature: 0.4,
          max_tokens: 800,
        });
        aiSummary = completion.choices?.[0]?.message?.content?.trim() || '';
      } catch (e) {
        console.error('⚠️ Résumé IA échoué, fallback sur le transcript:', e.message);
      }
    }

    // Contenu du document : résumé IA + transcript replié
    const documentContent = aiSummary
      ? `${aiSummary}\n\n---\n\n### 📝 Transcript complet\n\n${transcript}`
      : transcript;
    const shortSummary = (aiSummary || transcript).substring(0, 600);

    // 1. Créer document dans project_documents (Bibliothèque)
    const { data: document, error: docError } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        user_id: userId,
        document_type: 'conversation-ai',
        title: `Résumé conversation IA — ${conversationDate}`,
        content: documentContent,
        metadata: {
          conversation_id: conversationId,
          message_count: messages.length,
          date: now,
          type: 'gabon-insight',
          has_ai_summary: !!aiSummary
        },
        created_at: now
      })
      .select()
      .single();

    if (docError) {
      console.error('❌ Erreur création document:', docError);
    } else {
      console.log('✅ Document résumé conversation créé:', document.id);
    }

    // 2. Créer un rapport contextuel
    const conversationReport = {
      date: now,
      type: 'conversation_ai',
      content: `Conversation avec Gabon Insight (${messages?.length || 0} messages):\n\n${shortSummary.substring(0, 500)}...`,
      author: 'Gabon Insight',
      document_id: document?.id
    };

    // 3. Récupérer projet actuel
    const { data: project } = await supabase
      .from('saved_projects')
      .select('cumulative_context')
      .eq('id', projectId)
      .single();

    const currentContext = project?.cumulative_context || [];

    // 4. Ajouter rapport au contexte cumulatif
    await supabase
      .from('saved_projects')
      .update({
        cumulative_context: [...currentContext, conversationReport],
        context_updated_at: now
      })
      .eq('id', projectId);

    // 5. Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: projectId,
        user_id: userId,
        event_type: 'conversation_completed',
        event_description: `Conversation avec Gabon Insight terminée (${messages?.length || 0} messages échangés). Rapport ajouté à la bibliothèque.`,
        created_at: now
      });

    // 6. Mettre à jour conversation
    await supabase
      .from('project_chat_conversations')
      .update({
        ended_at: now,
        conversation_summary: shortSummary
      })
      .eq('id', conversationId);

    console.log('✅ Conversation terminée:', {
      conversationId,
      projectId,
      messageCount: messages?.length || 0,
      documentId: document?.id
    });

    res.json({ 
      success: true,
      message: 'Conversation terminée et rapport ajouté au contexte & bibliothèque',
      documentId: document?.id
    });

  } catch (error) {
    console.error('❌ Erreur end-conversation:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Générer une réponse rapide sans conversation
router.post('/generate-quick-response', async (req, res) => {
  try {
    const { userId, projectId, prompt, modelType } = req.body;

    if (!userId || !projectId || !prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Paramètres manquants' 
      });
    }

    console.log(`🤖 Génération réponse rapide Kimi ${OPENAI_MODEL}...`);

    // Générer réponse avec Kimi K2.5
    let aiResponse = '';
    try {
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Tu es un conseiller business expert au Gabon. Réponds de manière professionnelle, concise et précise.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      aiResponse = completion.choices[0]?.message?.content || "Je rencontre une difficulté technique.";

      console.log('✅ Réponse OpenAI générée');
    } catch (aiError) {
      console.error('Erreur appel Kimi:', aiError);
      aiResponse = "Je rencontre une difficulté technique. Veuillez reformuler votre question.";
    }

    res.json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('❌ Erreur génération rapide:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer historique conversations d'un projet
router.get('/conversations/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('project_chat_conversations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, conversations: data || [] });

  } catch (error) {
    console.error('❌ Erreur get conversations:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
