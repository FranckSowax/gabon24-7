const express = require('express');
const supabaseService = require('../../supabase-config');
const geminiService = require('../../services/gemini-service');
const router = express.Router();

const { supabase } = supabaseService;

// Service de génération de documents (Gemini 3 Pro)
// Remplace Replicate GPT-5 Nano

// Créer un nouveau document de projet
router.post('/', async (req, res) => {
  try {
    const { 
      projectId, 
      userId, 
      documentType, 
      title, 
      content, 
      promptUsed,
      contextAdded,
      metadata 
    } = req.body;

    if (!projectId || !userId || !documentType || !title || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Champs requis manquants' 
      });
    }

    const { data, error } = await supabase
      .from('project_documents')
      .insert([{
        project_id: projectId,
        user_id: userId,
        document_type: documentType,
        title,
        content,
        prompt_used: promptUsed,
        context_added: contextAdded,
        metadata
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création document:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log('✅ Document créé:', data.id);
    res.json({ success: true, document: data });

  } catch (error) {
    console.error('❌ Erreur endpoint create document:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer tous les documents d'un projet
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération documents:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, documents: data || [] });

  } catch (error) {
    console.error('❌ Erreur endpoint get documents:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer un document spécifique
router.get('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('❌ Erreur récupération document:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, document: data });

  } catch (error) {
    console.error('❌ Erreur endpoint get document:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Mettre à jour un document (pour ajouter contexte et régénérer)
router.put('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { content, contextAdded, promptUsed } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (content) updateData.content = content;
    if (contextAdded) updateData.context_added = contextAdded;
    if (promptUsed) updateData.prompt_used = promptUsed;

    const { data, error } = await supabase
      .from('project_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour document:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log('✅ Document mis à jour:', documentId);
    res.json({ success: true, document: data });

  } catch (error) {
    console.error('❌ Erreur endpoint update document:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Supprimer un document
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId requis' });
    }

    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur suppression document:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log('✅ Document supprimé:', documentId);
    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur endpoint delete document:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Générer un document à partir d'une étape du plan d'action
router.post('/generate-from-step', async (req, res) => {
  try {
    const {
      projectId,
      userId,
      step, // { step: number, title: string, description: string }
      answers, // { [questionId]: answer }
      projectData // { titre, secteur, budget, description }
    } = req.body;

    if (!projectId || !userId || !step || !answers || !projectData) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        required: ['projectId', 'userId', 'step', 'answers', 'projectData']
      });
    }

    console.log(`📄 Génération du document pour l'étape ${step.step}: ${step.title}`);

    // Construire le contexte à partir des réponses
    const answersText = Object.entries(answers)
      .map(([questionId, answer]) => `- ${questionId}: ${answer}`)
      .join('\n');

    // Déterminer le type de document basé sur l'étape
    const documentTypeMap = {
      1: 'etude-marche',
      2: 'faisabilite',
      3: 'business-plan',
      4: 'plan-financement',
      5: 'guide-administratif',
      6: 'strategie-partenariat',
      7: 'plan-infrastructure',
      8: 'plan-recrutement',
      9: 'plan-test-pilote',
      10: 'plan-lancement'
    };

    const documentType = documentTypeMap[step.step] || 'document-etape';

    // Prompt pour générer le document
    const prompt = `Tu es un expert en entrepreneuriat au Gabon. Génère un document professionnel complet pour l'étape "${step.title}" du projet suivant :

**Projet** : ${projectData.titre}
**Secteur** : ${projectData.secteur}
**Budget** : ${projectData.budget}
**Description** : ${projectData.description}

**Étape** : ${step.title}
**Description de l'étape** : ${step.description}

**Réponses aux questions clés** :
${answersText}

**CONSIGNE** : Génère un document professionnel et structuré pour cette étape. Le document doit :
1. Avoir un titre clair
2. Être bien organisé avec des sections
3. Être concret et actionnable
4. Utiliser les réponses fournies pour créer un contenu détaillé
5. Être formaté en Markdown
6. Inclure des recommandations spécifiques pour le Gabon

Le document doit être complet, professionnel et directement utilisable par l'entrepreneur.`;

    const systemMessage = 'Tu es un expert en entrepreneuriat au Gabon. Tu génères des documents professionnels, structurés et actionnables pour aider les entrepreneurs à concrétiser leurs projets.';

    console.log('🤖 Appel Gemini 3 Pro pour génération document...');
    
    const documentContent = await geminiService.generateText(prompt, {
      systemPrompt: systemMessage,
      temperature: 0.7
    });

    // Sauvegarder le document dans la base de données
    const { data: document, error: insertError } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        user_id: userId,
        document_type: documentType,
        title: `${step.title} - ${projectData.titre}`,
        content: documentContent,
        prompt_used: prompt,
        context_added: true,
        metadata: {
          step_number: step.step,
          step_title: step.title,
          answers: answers,
          generated_from_step: true
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur sauvegarde document:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la sauvegarde du document'
      });
    }

    console.log('✅ Document d\'étape généré et sauvegardé:', document.id);

    res.json({
      success: true,
      document,
      message: `Document "${step.title}" généré avec succès`
    });

  } catch (error) {
    console.error('❌ Erreur génération document d\'étape:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération du document'
    });
  }
});

// Générer une section du business plan
router.post('/generate-business-plan-section', async (req, res) => {
  try {
    const {
      projectId,
      userId,
      section, // { section: number, title: string, objective: string }
      answers, // { [questionId]: answer }
      projectData // { titre, secteur, budget, description }
    } = req.body;

    if (!projectId || !userId || !section || !answers || !projectData) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        required: ['projectId', 'userId', 'section', 'answers', 'projectData']
      });
    }

    console.log(`📊 Génération de la section ${section.section}/10 du Business Plan: ${section.title}`);

    // Construire le contexte à partir des réponses
    const answersText = Object.entries(answers)
      .map(([questionId, answer], index) => `${index + 1}. ${answer}`)
      .join('\n\n');

    // Prompt professionnel pour générer la section du business plan
    const prompt = `Agis comme un expert en stratégie et en création de business plans au Gabon.

**CONTEXTE DU PROJET**
- Nom du projet : ${projectData.titre}
- Secteur d'activité : ${projectData.secteur}
- Budget : ${projectData.budget}
- Description : ${projectData.description}
- Localisation : Gabon

**SECTION À RÉDIGER**
Section ${section.section}/10 : ${section.title}
Objectif : ${section.objective}

**RÉPONSES AUX QUESTIONS STRATÉGIQUES**
${answersText}

**CONSIGNE**
Rédige la section "${section.title}" de ce business plan de manière professionnelle et structurée.

Le document doit :
1. Être rédigé en français professionnel, clair et convaincant
2. Être formaté en Markdown avec des titres, sous-titres et listes
3. Utiliser la devise FCFA pour toutes les données financières
4. Être adapté au contexte économique et réglementaire gabonais
5. Intégrer toutes les réponses fournies de manière cohérente
6. Être destiné à des investisseurs, banques ou organismes publics/privés
7. Être concret, actionnable et mesurable
8. Inclure des recommandations spécifiques au marché gabonais

Structure recommandée :
- Introduction de la section
- Développement détaillé basé sur les réponses
- Données chiffrées en FCFA quand pertinent
- Conclusion et points clés

Génère un contenu professionnel de qualité, prêt à être présenté.`;

    const systemMessage = 'Tu es un expert en stratégie d\'entreprise et en création de business plans au Gabon. Tu génères des documents professionnels, structurés et actionnables, adaptés au contexte gabonais, en utilisant la devise FCFA.';

    console.log('🤖 Appel Gemini 3 Pro pour génération section BP...');
    
    const sectionContent = await geminiService.generateText(prompt, {
      systemPrompt: systemMessage,
      temperature: 0.7
    });

    // Sauvegarder la section dans la base de données
    const { data: document, error: insertError } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        user_id: userId,
        document_type: 'business-plan-section',
        title: `${section.section}. ${section.title} - ${projectData.titre}`,
        content: sectionContent,
        prompt_used: prompt,
        context_added: true,
        metadata: {
          section_number: section.section,
          section_title: section.title,
          section_objective: section.objective,
          answers: answers,
          is_business_plan: true,
          total_sections: 10
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur sauvegarde section:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la sauvegarde de la section'
      });
    }

    console.log(`✅ Section ${section.section}/10 "${section.title}" générée et sauvegardée`);

    // 🔔 VÉRIFIER SI BUSINESS PLAN COMPLET
    try {
      // Compter les sections business plan pour ce projet
      const { count } = await supabase
        .from('project_documents')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('document_type', 'business-plan-section');

      console.log(`📊 Sections complétées: ${count}/10`);

      // Si toutes les 10 sections sont complètes, envoyer notification
      if (count === 10) {
        const notificationHelper = require('../../utils/notificationHelper');
        await notificationHelper.notifyBusinessPlanReady(
          userId,
          projectId,
          projectData.titre || 'Votre projet'
        );
        console.log('🎉 Business plan complet - Notification envoyée !');
      }
    } catch (notifError) {
      console.warn('⚠️ Erreur vérification/notification:', notifError.message);
    }

    res.json({
      success: true,
      document,
      message: `Section "${section.title}" générée avec succès`
    });

  } catch (error) {
    console.error('❌ Erreur génération section business plan:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération de la section'
    });
  }
});

// Générer une phase du plan d'action
router.post('/generate-action-plan-phase', async (req, res) => {
  try {
    const {
      projectId,
      userId,
      phase, // { phase: number, title: string, objective: string, duration: string }
      answers, // { [questionId]: answer }
      projectData // { titre, secteur, budget, description }
    } = req.body;

    if (!projectId || !userId || !phase || !answers || !projectData) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        required: ['projectId', 'userId', 'phase', 'answers', 'projectData']
      });
    }

    console.log(`📋 Génération de la phase ${phase.phase}/5 du Plan d'Action: ${phase.title}`);

    // Construire le contexte à partir des réponses (tâches)
    const tasksText = Object.entries(answers)
      .map(([questionId, answer], index) => `**Tâche ${index + 1}:**\n${answer}`)
      .join('\n\n');

    // Prompt professionnel pour générer la phase du plan d'action
    const prompt = `Agis comme un consultant en entrepreneuriat spécialisé dans le contexte gabonais.

**CONTEXTE DU PROJET**
- Nom du projet : ${projectData.titre}
- Secteur d'activité : ${projectData.secteur}
- Budget disponible : ${projectData.budget}
- Description : ${projectData.description}
- Localisation : Gabon (Libreville, Port-Gentil, ou autre ville gabonaise)

**PHASE À STRUCTURER**
Phase ${phase.phase}/5 : ${phase.title}
Objectif : ${phase.objective}
Durée estimée : ${phase.duration}

**TÂCHES IDENTIFIÉES**
${tasksText}

**CONSIGNE**
Transforme ces tâches en un plan d'action structuré, concret et actionnable pour cette phase.

Le document doit :
1. Être rédigé en français professionnel, clair et orienté action
2. Être formaté en Markdown avec des titres, sous-titres, listes et tableaux
3. Utiliser la devise FCFA pour tous les montants
4. Être 100% adapté au contexte gabonais (institutions, quartiers, réglementation)
5. Organiser les tâches de manière logique et chronologique
6. Inclure pour chaque tâche : description, responsable suggéré, délai, budget estimé en FCFA
7. Proposer des indicateurs de succès mesurables
8. Identifier les risques potentiels au Gabon et solutions
9. Lister les ressources nécessaires (contacts, documents, outils)
10. Être immédiatement applicable sur le terrain gabonais

Structure recommandée :
- Vue d'ensemble de la phase
- Tableau récapitulatif des tâches (Tâche | Responsable | Délai | Budget FCFA | Priorité)
- Détail de chaque tâche avec étapes concrètes
- Ressources et contacts utiles au Gabon
- Indicateurs de succès
- Risques et solutions
- Checklist de validation de la phase

Génère un plan d'action professionnel, prêt à être exécuté au Gabon.`;

    const systemMessage = 'Tu es un consultant en entrepreneuriat spécialisé dans le contexte gabonais. Tu génères des plans d\'action concrets, structurés et actionnables, adaptés aux réalités du terrain gabonais, en utilisant la devise FCFA.';

    console.log('🤖 Appel Gemini 3 Pro pour génération phase Plan d\'Action...');
    
    const phaseContent = await geminiService.generateText(prompt, {
      systemPrompt: systemMessage,
      temperature: 0.7
    });

    // Sauvegarder la phase dans la base de données
    const { data: document, error: insertError } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        user_id: userId,
        document_type: 'action-plan-phase',
        title: `Phase ${phase.phase}/5: ${phase.title} - ${projectData.titre}`,
        content: phaseContent,
        prompt_used: prompt,
        context_added: true,
        metadata: {
          phase_number: phase.phase,
          phase_title: phase.title,
          phase_objective: phase.objective,
          phase_duration: phase.duration,
          tasks: answers,
          is_action_plan: true,
          total_phases: 5
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur sauvegarde phase:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la sauvegarde de la phase'
      });
    }

    console.log(`✅ Phase ${phase.phase}/5 "${phase.title}" générée et sauvegardée`);

    res.json({
      success: true,
      document,
      message: `Phase "${phase.title}" générée avec succès`
    });

  } catch (error) {
    console.error('❌ Erreur génération phase plan d\'action:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération de la phase'
    });
  }
});

// Générer une réponse IA générique (pour checklist plan d'action)
router.post('/generate-ai-response', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt requis'
      });
    }

    console.log('🤖 Génération réponse IA pour checklist...');

    const systemMessage = 'Tu es un consultant en entrepreneuriat spécialisé dans le contexte gabonais. Tu génères des réponses concrètes, structurées et actionnables, adaptées aux réalités du terrain gabonais, en utilisant la devise FCFA.';

    const response = await geminiService.generateText(prompt, {
      systemPrompt: systemMessage,
      temperature: 0.7
    });

    res.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('❌ Erreur génération réponse IA:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération de la réponse'
    });
  }
});

module.exports = router;
