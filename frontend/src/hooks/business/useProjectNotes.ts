/**
 * 📝 HOOK: useProjectNotes
 * Gère la logique des notes de projet (fetch, add, update, delete)
 */

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ProjectNote {
  id: string;
  project_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_id?: string;
}

export function useProjectNotes() {
  const [projectNotes, setProjectNotes] = useState<{[key: string]: ProjectNote[]}>({});
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  const fetchProjectNotes = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-notes/${projectId}`);
      const data = await response.json();
      
      if (data.success && data.notes) {
        setProjectNotes(prev => ({
          ...prev,
          [projectId]: data.notes
        }));
      }
    } catch (error) {
      console.error('Erreur chargement notes:', error);
    }
  }, []);

  const addNote = useCallback(async (projectId: string, userId: string) => {
    if (!newNote.trim()) return { success: false, error: 'Note vide' };
    
    setIsAddingNote(true);
    
    try {
      const response = await fetch(`${API_URL}/api/project-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          user_id: userId,
          content: newNote.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNewNote('');
        await fetchProjectNotes(projectId);
        return { success: true, note: data.note };
      }
      
      return { success: false, error: data.error };
    } catch (error: any) {
      console.error('Erreur ajout note:', error);
      return { success: false, error: error.message };
    } finally {
      setIsAddingNote(false);
    }
  }, [newNote, fetchProjectNotes]);

  const updateNote = useCallback(async (noteId: string, projectId: string) => {
    if (!editingNoteContent.trim()) return { success: false, error: 'Note vide' };
    
    try {
      const response = await fetch(`${API_URL}/api/project-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingNoteContent.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setEditingNoteId(null);
        setEditingNoteContent('');
        await fetchProjectNotes(projectId);
        return { success: true };
      }
      
      return { success: false, error: data.error };
    } catch (error: any) {
      console.error('Erreur mise à jour note:', error);
      return { success: false, error: error.message };
    }
  }, [editingNoteContent, fetchProjectNotes]);

  const deleteNote = useCallback(async (noteId: string, projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-notes/${noteId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchProjectNotes(projectId);
        return { success: true };
      }
      
      return { success: false, error: data.error };
    } catch (error: any) {
      console.error('Erreur suppression note:', error);
      return { success: false, error: error.message };
    }
  }, [fetchProjectNotes]);

  const startEditing = useCallback((note: ProjectNote) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  }, []);

  const getNotesForProject = useCallback((projectId: string): ProjectNote[] => {
    return projectNotes[projectId] || [];
  }, [projectNotes]);

  return {
    projectNotes,
    newNote,
    setNewNote,
    isAddingNote,
    editingNoteId,
    editingNoteContent,
    setEditingNoteContent,
    fetchProjectNotes,
    addNote,
    updateNote,
    deleteNote,
    startEditing,
    cancelEditing,
    getNotesForProject
  };
}
