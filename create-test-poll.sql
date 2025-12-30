-- Créer un sondage manuel temporaire directement en base
-- Ce sondage sera automatiquement supprimé lors de la prochaine génération à 19h UTC

-- D'abord archiver les anciens sondages
UPDATE polls 
SET status = 'archived', is_active = false 
WHERE status = 'published';

-- Créer le sondage temporaire
INSERT INTO polls (
  question,
  poll_type,
  options,
  expires_at,
  status,
  published_at,
  is_active,
  is_manual,
  total_votes,
  created_at,
  updated_at
) VALUES (
  'Quelle devrait être la priorité du gouvernement gabonais pour améliorer la vie des citoyens ?',
  'mcq',
  ARRAY[
    'Amélioration des infrastructures routières',
    'Développement de l''emploi des jeunes', 
    'Renforcement du système de santé',
    'Modernisation de l''éducation'
  ],
  CASE 
    WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC') >= 19 
    THEN (CURRENT_DATE + INTERVAL '1 day' + TIME '19:00:00') AT TIME ZONE 'UTC'
    ELSE (CURRENT_DATE + TIME '19:00:00') AT TIME ZONE 'UTC'
  END,
  'published',
  NOW(),
  true,
  true,
  0,
  NOW(),
  NOW()
);

-- Vérifier le sondage créé
SELECT 
  id,
  question,
  poll_type,
  options,
  expires_at,
  status,
  is_active,
  is_manual,
  created_at
FROM polls 
WHERE status = 'published' 
ORDER BY created_at DESC 
LIMIT 1;
