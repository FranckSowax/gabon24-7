-- Migration: Ajouter la colonne question_type pour différencier Training vs Payant
-- Date: 2025-12-31
-- Description: Séparer les pools de questions pour éviter que les joueurs Training
--              connaissent les réponses des sessions payantes

-- Ajouter la colonne question_type si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_questions' AND column_name = 'question_type'
  ) THEN
    ALTER TABLE game_questions ADD COLUMN question_type VARCHAR(20) DEFAULT 'paid';
    RAISE NOTICE '✅ Colonne question_type ajoutée à game_questions';
  END IF;
END $$;

-- Mettre à jour les questions existantes: 50% training, 50% paid
-- On utilise un hash de l'ID pour répartir de manière déterministe
UPDATE game_questions
SET question_type = CASE
  WHEN (('x' || substr(md5(id::text), 1, 8))::bit(32)::int % 2) = 0 THEN 'training'
  ELSE 'paid'
END
WHERE question_type IS NULL OR question_type = 'paid';

-- Index pour filtrer rapidement par type
CREATE INDEX IF NOT EXISTS idx_game_questions_type ON game_questions(question_type);

-- Index composite pour requêtes fréquentes (type + difficulté + date)
CREATE INDEX IF NOT EXISTS idx_game_questions_type_diff ON game_questions(question_type, difficulty, created_at DESC);

-- Afficher la distribution
SELECT question_type, COUNT(*) as count
FROM game_questions
GROUP BY question_type;
