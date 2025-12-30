-- Mise à jour de la contrainte CHECK pour accepter le type 'series'
-- Supprimer l'ancienne contrainte
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_poll_type_check;

-- Ajouter la nouvelle contrainte avec 'series'
ALTER TABLE polls ADD CONSTRAINT polls_poll_type_check 
CHECK (poll_type IN ('yes_no', 'mcq', 'series'));
