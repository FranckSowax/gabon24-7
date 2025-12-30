import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ProjectDocument {
  id: string;
  project_id: string;
  type: 'action-plan' | 'skill-test' | 'custom-training' | 'business-plan';
  document_type?: string;
  title: string;
  content: string;
  status: 'draft' | 'generated' | 'validated';
  prompt_used?: string;
  context_added?: string;
  created_at: string;
  metadata?: {
    score?: number;
    difficulty?: string;
    questionCount?: number;
    correctAnswers?: number;
    timeSpent?: number;
    [key: string]: any;
  };
}

export function useProjectDocuments(userId?: string) {
  const [projectDocuments, setProjectDocuments] = useState<Record<string, ProjectDocument[]>>({});
  const [loadingDocs, setLoadingDocs] = useState(false);
  
  // États pour l'ajout de contexte
  const [newContext, setNewContext] = useState('');
  const [showContextForm, setShowContextForm] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null);

  // Charger les documents pour un projet
  const fetchDocuments = useCallback(async (projectId: string) => {
    if (!userId) return;
    try {
      setLoadingDocs(true);
      const response = await fetch(`${API_URL}/api/project-documents/project/${projectId}`);
      const data = await response.json();
      if (data.success) {
        setProjectDocuments(prev => ({
          ...prev,
          [projectId]: data.documents
        }));
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  }, [userId]);

  // Ajouter du contexte et régénérer (Logique IA intégrée)
  const addContextAndRegenerate = async (
    documentId: string, 
    projectId: string, 
    projectNotes: any[] = [] // Passer les notes si nécessaire
  ) => {
    if (!userId || !newContext.trim()) {
      alert('Veuillez ajouter du contexte');
      return;
    }

    try {
      // 1. Récupérer le document actuel
      const docResponse = await fetch(`${API_URL}/api/project-documents/${documentId}`);
      const { document } = await docResponse.json();

      // 2. Récupérer les notes du projet comme contexte supplémentaire
      const notesContext = projectNotes.map(note => note.note_content).join('\n\n');

      // 3. Construire le contexte enrichi
      const enrichedContext = [
        document.context_added,
        '--- Notes et commentaires du projet ---',
        notesContext,
        '--- Nouveau contexte ---',
        newContext
      ].filter(Boolean).join('\n\n');

      // 4. Construire le prompt enrichi
      const enhancedPrompt = `${document.prompt_used}\n\nCONTEXTE ADDITIONNEL:\n${enrichedContext}\n\nVeuillez régénérer le document complet en tenant compte de ces nouveaux éléments. Gardez le même format de sortie que précédemment.`;

      // Appel à l'IA pour régénérer
      let newContent = null;
      try {
        const aiRes = await fetch(`${API_URL}/api/ai/regenerate-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: enhancedPrompt })
        });
        const aiData = await aiRes.json();
        if (aiData.success) {
            newContent = aiData.content;
        }
      } catch (e) {
        console.error('Erreur régénération IA:', e);
      }

      // 5. Mettre à jour avec le contexte et le nouveau contenu
      const updatePayload: any = {
        contextAdded: enrichedContext,
        promptUsed: enhancedPrompt
      };
      
      if (newContent) {
        updatePayload.content = newContent;
      }

      const updateResponse = await fetch(`${API_URL}/api/project-documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      const { document: updatedDoc } = await updateResponse.json();
      
      // 6. Mettre à jour localement
      setProjectDocuments(prev => ({
        ...prev,
        [projectId]: prev[projectId].map(doc => 
          doc.id === documentId ? updatedDoc : doc
        )
      }));

      setNewContext('');
      setShowContextForm(false);
      return { success: true, regenerated: !!newContent };

    } catch (error) {
      console.error('Error adding context:', error);
      throw error;
    }
  };

  const deleteDocument = async (documentId: string, projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await fetch(`${API_URL}/api/project-documents/${documentId}`, {
        method: 'DELETE'
      });

      setProjectDocuments(prev => ({
        ...prev,
        [projectId]: prev[projectId].filter(doc => doc.id !== documentId)
      }));
    } catch (error) {
      console.error('Erreur suppression document:', error);
      alert('Impossible de supprimer le document');
    }
  };

  // Helpers UI
  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'action-plan': return '📋';
      case 'skill-test': return '🎯';
      case 'custom-training': return '🎓';
      case 'business-plan': return '📊';
      default: return '📄';
    }
  };

  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'action-plan': return 'from-blue-500 to-cyan-600';
      case 'skill-test': return 'from-purple-500 to-violet-600';
      case 'custom-training': return 'from-orange-500 to-red-600';
      case 'business-plan': return 'from-green-500 to-emerald-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return {
    projectDocuments,
    setProjectDocuments,
    loadingDocs,
    newContext,
    setNewContext,
    showContextForm,
    setShowContextForm,
    selectedDocument,
    setSelectedDocument,
    fetchDocuments,
    addContextAndRegenerate,
    deleteDocument,
    getDocumentIcon,
    getDocumentColor
  };
}
