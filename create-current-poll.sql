-- Archiver les anciens sondages
UPDATE polls SET status = 'archived' WHERE status = 'published';
DELETE FROM poll_responses WHERE poll_id IN (SELECT id FROM polls WHERE status = 'archived');
DELETE FROM poll_stats WHERE poll_id IN (SELECT id FROM polls WHERE status = 'archived');

-- Créer le sondage du jour basé sur l'actualité du 12 septembre 2025
INSERT INTO polls (question, poll_type, options, expires_at, status, created_at) 
VALUES (
  'Sondage du jour - Actualité gabonaise',
  'series',
  '[]'::jsonb,
  '2025-09-13 19:00:00+00'::timestamptz,
  'published',
  NOW()
) RETURNING id;

-- Insérer les 4 questions basées sur l'actualité du jour
WITH new_poll AS (
  SELECT id FROM polls WHERE status = 'published' ORDER BY created_at DESC LIMIT 1
)
INSERT INTO poll_questions (poll_id, question_text, question_type, options, question_order)
SELECT 
  new_poll.id,
  question_text,
  question_type,
  options::jsonb,
  question_order
FROM new_poll,
(VALUES
  ('Le président Oligui Nguema veut arrêter les exportations de matières premières brutes. Pensez-vous que cette stratégie va réussir ?', 'yes_no', '[]', 1),
  ('Quelle priorité devrait avoir le Gabon pour développer la transformation locale ?', 'mcq', '["Industries agroalimentaires", "Transformation du bois", "Raffinage pétrolier", "Mines et métallurgie"]', 2),
  ('La reprise des classes 2025-2026 se fait sous tension. Quel est le principal défi du système éducatif gabonais ?', 'mcq', '["Infrastructures scolaires", "Formation des enseignants", "Calendrier scolaire", "Financement de l''éducation"]', 3),
  ('Les élections locales approchent (27 septembre). Êtes-vous optimiste sur la transparence du processus électoral ?', 'yes_no', '[]', 4)
) AS questions(question_text, question_type, options, question_order);
