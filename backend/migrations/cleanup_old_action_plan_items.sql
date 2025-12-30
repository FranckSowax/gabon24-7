-- Migration: Nettoyer les anciens items de plan d'action avec des IDs invalides
-- Date: 2025-01-08
-- Problème: Des items avec des IDs comme "step5_task2" existent en base mais ne sont pas dans ACTION_PLAN_STEPS

-- Liste des IDs valides pour chaque étape (selon action-plan-checklist.ts)
-- Étape 1: validation_contacts, validation_reglementation, validation_budget, validation_emplacement, validation_concurrence
-- Étape 2: juridique_forme, juridique_statuts, juridique_anpi, juridique_cnss
-- Étape 3: operationnel_local, operationnel_equipements, operationnel_recrutement
-- Étape 4: marketing_identite, marketing_digital, marketing_prospects
-- Étape 5: lancement_evenement, lancement_kpis, lancement_tresorerie

-- Créer une table temporaire avec les IDs valides
CREATE TEMP TABLE valid_item_ids (
  step_number INTEGER,
  item_id TEXT
);

-- Insérer les IDs valides
INSERT INTO valid_item_ids (step_number, item_id) VALUES
  -- Étape 1
  (1, 'validation_contacts'),
  (1, 'validation_reglementation'),
  (1, 'validation_budget'),
  (1, 'validation_emplacement'),
  (1, 'validation_concurrence'),
  -- Étape 2
  (2, 'juridique_forme'),
  (2, 'juridique_statuts'),
  (2, 'juridique_anpi'),
  (2, 'juridique_cnss'),
  -- Étape 3
  (3, 'operationnel_local'),
  (3, 'operationnel_equipements'),
  (3, 'operationnel_recrutement'),
  -- Étape 4
  (4, 'marketing_identite'),
  (4, 'marketing_digital'),
  (4, 'marketing_prospects'),
  -- Étape 5
  (5, 'lancement_evenement'),
  (5, 'lancement_kpis'),
  (5, 'lancement_tresorerie');

-- Afficher les items invalides qui vont être supprimés
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO invalid_count
  FROM action_plan_checklist_items apci
  JOIN action_plan_checklists apc ON apci.checklist_id = apc.id
  WHERE NOT EXISTS (
    SELECT 1 FROM valid_item_ids v
    WHERE v.step_number = apc.step_number
      AND v.item_id = apci.item_id
  );
  
  RAISE NOTICE 'Nombre d''items invalides trouvés: %', invalid_count;
  
  IF invalid_count > 0 THEN
    RAISE NOTICE 'Ces items seront supprimés car ils ne correspondent pas aux IDs définis dans ACTION_PLAN_STEPS';
  END IF;
END $$;

-- Supprimer les items avec des IDs invalides
DELETE FROM action_plan_checklist_items
WHERE id IN (
  SELECT apci.id
  FROM action_plan_checklist_items apci
  JOIN action_plan_checklists apc ON apci.checklist_id = apc.id
  WHERE NOT EXISTS (
    SELECT 1 FROM valid_item_ids v
    WHERE v.step_number = apc.step_number
      AND v.item_id = apci.item_id
  )
);

-- Afficher un résumé
DO $$
DECLARE
  total_items INTEGER;
  total_checklists INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_items FROM action_plan_checklist_items;
  SELECT COUNT(*) INTO total_checklists FROM action_plan_checklists;
  
  RAISE NOTICE '✅ Nettoyage terminé';
  RAISE NOTICE 'Items restants: %', total_items;
  RAISE NOTICE 'Checklists actives: %', total_checklists;
END $$;

-- Nettoyer la table temporaire
DROP TABLE valid_item_ids;

-- Recalculer la progression de toutes les checklists
UPDATE action_plan_checklists apc
SET progress_percentage = (
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND((COUNT(*) FILTER (WHERE is_completed = TRUE)::DECIMAL / COUNT(*)) * 100)
  END
  FROM action_plan_checklist_items
  WHERE checklist_id = apc.id
),
status = CASE
  WHEN (
    SELECT COUNT(*) FILTER (WHERE is_completed = TRUE)
    FROM action_plan_checklist_items
    WHERE checklist_id = apc.id
  ) = 0 THEN 'not_started'
  WHEN (
    SELECT COUNT(*) FILTER (WHERE is_completed = TRUE)
    FROM action_plan_checklist_items
    WHERE checklist_id = apc.id
  ) = (
    SELECT COUNT(*)
    FROM action_plan_checklist_items
    WHERE checklist_id = apc.id
  ) THEN 'completed'
  ELSE 'in_progress'
END;

RAISE NOTICE '✅ Progression recalculée pour toutes les checklists';
