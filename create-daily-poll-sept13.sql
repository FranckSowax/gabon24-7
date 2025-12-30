-- Archiver les anciens sondages actifs
UPDATE polls SET status = 'archived', is_active = false WHERE status = 'published' AND is_active = true;

-- Créer le sondage du jour basé sur l'actualité du 13 septembre 2025
INSERT INTO polls (question, poll_type, options, expires_at, status, is_active, created_at) 
VALUES (
  'Sondage du jour - Actualité gabonaise du 13 septembre 2025',
  'series',
  '[]'::jsonb,
  '2025-09-14 19:00:00+00'::timestamptz,
  'published',
  true,
  NOW()
) RETURNING id;

-- Insérer les 4 questions basées sur l'actualité du jour
WITH new_poll AS (
  SELECT id FROM polls WHERE status = 'published' AND is_active = true ORDER BY created_at DESC LIMIT 1
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
  ('Le scandale sexuel impliquant le représentant de l''ONU Abdou Abarry à Libreville vous choque-t-il ?', 'yes_no', '[]', 1),
  ('La refondation du Conseil Supérieur de la Magistrature par le président Oligui Nguema est-elle une priorité pour vous ?', 'yes_no', '[]', 2),
  ('Que pensez-vous du projet de transport fluvial par radeaux flottants pour le développement économique du Gabon ?', 'mcq', '["Très prometteur", "Intéressant mais risqué", "Peu convaincant", "Inutile"]', 3),
  ('La délégation de signature présidentielle pour "fluidifier l''action administrative" vous semble-t-elle appropriée ?', 'mcq', '["Nécessaire pour l''efficacité", "Risque de dérive du pouvoir", "Mesure technique normale", "Je ne sais pas"]', 4)
) AS questions(question_text, question_type, options, question_order);
