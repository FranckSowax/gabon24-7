-- Migration: Système de checklist pour le Plan d'Action avec upload documents

-- Table pour stocker les checklists de plan d'action
CREATE TABLE IF NOT EXISTS action_plan_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL, -- 1 à 5
  step_title TEXT NOT NULL,
  step_objective TEXT,
  step_duration TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, step_number)
);

-- Table pour stocker les items de checklist individuels
CREATE TABLE IF NOT EXISTS action_plan_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES action_plan_checklists(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL, -- Ex: "validation_contacts"
  task TEXT NOT NULL,
  description TEXT,
  ai_prompt TEXT,
  requires_document BOOLEAN DEFAULT FALSE,
  document_type TEXT,
  placeholder TEXT,
  estimated_time TEXT,
  priority TEXT CHECK (priority IN ('haute', 'moyenne', 'basse')),
  
  -- Réponse utilisateur
  answer TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  
  -- Documents uploadés
  document_urls TEXT[], -- Array d'URLs Supabase Storage
  document_names TEXT[], -- Noms originaux des fichiers
  
  -- Métadonnées
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(checklist_id, item_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_action_plan_checklists_project ON action_plan_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklists_user ON action_plan_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklists_status ON action_plan_checklists(status);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklist_items_checklist ON action_plan_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklist_items_completed ON action_plan_checklist_items(is_completed);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_action_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_action_plan_checklists_updated_at
  BEFORE UPDATE ON action_plan_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_action_plan_updated_at();

CREATE TRIGGER trigger_action_plan_checklist_items_updated_at
  BEFORE UPDATE ON action_plan_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_action_plan_updated_at();

-- Fonction pour calculer automatiquement le pourcentage de progression
CREATE OR REPLACE FUNCTION update_checklist_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
  new_progress INTEGER;
BEGIN
  -- Compter les items totaux et complétés
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_completed = TRUE)
  INTO total_items, completed_items
  FROM action_plan_checklist_items
  WHERE checklist_id = NEW.checklist_id;
  
  -- Calculer le pourcentage
  IF total_items > 0 THEN
    new_progress := ROUND((completed_items::DECIMAL / total_items) * 100);
  ELSE
    new_progress := 0;
  END IF;
  
  -- Mettre à jour la checklist parente
  UPDATE action_plan_checklists
  SET 
    progress_percentage = new_progress,
    status = CASE
      WHEN new_progress = 0 THEN 'not_started'
      WHEN new_progress = 100 THEN 'completed'
      ELSE 'in_progress'
    END,
    completed_at = CASE
      WHEN new_progress = 100 THEN NOW()
      ELSE NULL
    END
  WHERE id = NEW.checklist_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_checklist_progress
  AFTER INSERT OR UPDATE OF is_completed ON action_plan_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_progress();

-- Politiques RLS (Row Level Security)
ALTER TABLE action_plan_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plan_checklist_items ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs propres checklists
CREATE POLICY "Users can view own checklists"
  ON action_plan_checklists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent créer leurs propres checklists
CREATE POLICY "Users can create own checklists"
  ON action_plan_checklists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent modifier leurs propres checklists
CREATE POLICY "Users can update own checklists"
  ON action_plan_checklists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent supprimer leurs propres checklists
CREATE POLICY "Users can delete own checklists"
  ON action_plan_checklists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Politiques pour checklist_items (via la checklist parente)
CREATE POLICY "Users can view own checklist items"
  ON action_plan_checklist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own checklist items"
  ON action_plan_checklist_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own checklist items"
  ON action_plan_checklist_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own checklist items"
  ON action_plan_checklist_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

-- Vue pour faciliter les requêtes
CREATE OR REPLACE VIEW action_plan_checklist_summary AS
SELECT 
  c.id,
  c.project_id,
  c.user_id,
  c.step_number,
  c.step_title,
  c.status,
  c.progress_percentage,
  COUNT(i.id) as total_items,
  COUNT(i.id) FILTER (WHERE i.is_completed = TRUE) as completed_items,
  COUNT(i.id) FILTER (WHERE i.requires_document = TRUE) as items_requiring_docs,
  COUNT(i.id) FILTER (WHERE i.requires_document = TRUE AND array_length(i.document_urls, 1) > 0) as items_with_docs,
  c.started_at,
  c.completed_at,
  c.created_at,
  c.updated_at
FROM action_plan_checklists c
LEFT JOIN action_plan_checklist_items i ON c.id = i.checklist_id
GROUP BY c.id;

-- Commentaires pour documentation
COMMENT ON TABLE action_plan_checklists IS 'Checklists de plan d''action par étape pour chaque projet';
COMMENT ON TABLE action_plan_checklist_items IS 'Items individuels de checklist avec réponses et documents';
COMMENT ON COLUMN action_plan_checklist_items.document_urls IS 'URLs des documents uploadés dans Supabase Storage';
COMMENT ON COLUMN action_plan_checklist_items.requires_document IS 'Indique si un upload de document est nécessaire pour cette tâche';
