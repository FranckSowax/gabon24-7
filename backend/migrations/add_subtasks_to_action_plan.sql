-- Migration: Ajouter le support des sous-tâches cochées dans le plan d'action
-- Date: 2025-01-08

-- Ajouter une colonne pour stocker les sous-tâches cochées
-- Format: array de strings contenant les indices des sous-tâches cochées
ALTER TABLE action_plan_checklist_items 
ADD COLUMN IF NOT EXISTS checked_subtasks INTEGER[] DEFAULT '{}';

-- Ajouter un commentaire pour documentation
COMMENT ON COLUMN action_plan_checklist_items.checked_subtasks IS 
'Array des indices (0-based) des sous-tâches cochées dans le plan d''action généré par IA';

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_action_plan_checklist_items_checked_subtasks 
ON action_plan_checklist_items USING GIN (checked_subtasks);

-- Fonction pour calculer automatiquement is_completed basé sur les sous-tâches
-- Une tâche est complétée si toutes ses sous-tâches sont cochées
CREATE OR REPLACE FUNCTION auto_complete_task_on_subtasks()
RETURNS TRIGGER AS $$
DECLARE
  total_subtasks INTEGER;
  checked_count INTEGER;
BEGIN
  -- Si answer est vide, pas de sous-tâches, donc on ne fait rien
  IF NEW.answer IS NULL OR NEW.answer = '' THEN
    RETURN NEW;
  END IF;
  
  -- Compter le nombre total de sous-tâches dans answer
  -- (lignes commençant par un numéro ou une puce)
  SELECT COUNT(*)
  INTO total_subtasks
  FROM regexp_split_to_table(NEW.answer, E'\\n') AS line
  WHERE trim(line) ~ '^[\d•\-\*]'
    AND length(trim(line)) >= 10
    AND NOT (trim(line) ~ ':$')
    AND NOT (trim(line) ~ '^[A-Z\s]+:?$');
  
  -- Compter les sous-tâches cochées
  checked_count := COALESCE(array_length(NEW.checked_subtasks, 1), 0);
  
  -- Si toutes les sous-tâches sont cochées, marquer la tâche comme complétée
  IF total_subtasks > 0 AND checked_count >= total_subtasks THEN
    NEW.is_completed := TRUE;
    NEW.completed_at := NOW();
  ELSIF checked_count < total_subtasks THEN
    -- Si pas toutes cochées, s'assurer que la tâche n'est pas marquée comme complétée
    NEW.is_completed := FALSE;
    NEW.completed_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour auto-complétion
DROP TRIGGER IF EXISTS trigger_auto_complete_task_on_subtasks ON action_plan_checklist_items;
CREATE TRIGGER trigger_auto_complete_task_on_subtasks
  BEFORE UPDATE OF checked_subtasks ON action_plan_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_task_on_subtasks();

-- Nettoyer les anciennes données incorrectes dans document_urls
-- (qui étaient utilisées comme hack pour stocker les sous-tâches cochées)
UPDATE action_plan_checklist_items
SET document_urls = ARRAY(
  SELECT unnest(document_urls)
  WHERE NOT unnest(document_urls) LIKE '%substep%'
)
WHERE EXISTS (
  SELECT 1 FROM unnest(document_urls) AS url
  WHERE url LIKE '%substep%'
);

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE 'Migration terminée: colonne checked_subtasks ajoutée avec trigger auto-completion';
END $$;
