-- ============================================
-- Migration: Création des sessions de jeu payantes
-- Date: 2026-01-03
-- Description: Crée les 4 sessions horaires payantes
-- ============================================

-- Supprimer les anciennes sessions payantes si elles existent (pour éviter les doublons)
DELETE FROM game_sessions
WHERE session_type IN ('midi-express', 'after-work', 'prime-time', 'night-owl');

-- Créer les sessions payantes
INSERT INTO game_sessions (
    session_type,
    name,
    entry_fee,
    max_players,
    status,
    game_mode,
    scheduled_hour,
    min_prize,
    created_at
) VALUES
-- Midi Express - 12h00 - 500 FCFA
(
    'midi-express',
    'Midi Express',
    500,
    NULL,  -- illimité pour mode hourly
    'waiting',
    'hourly',
    12,
    10000,
    NOW()
),
-- After Work - 18h00 - 1000 FCFA
(
    'after-work',
    'After Work',
    1000,
    NULL,
    'waiting',
    'hourly',
    18,
    25000,
    NOW()
),
-- Prime Time - 20h00 - 2000 FCFA
(
    'prime-time',
    'Prime Time',
    2000,
    NULL,
    'waiting',
    'hourly',
    20,
    25000,
    NOW()
),
-- Night Owl - 22h00 - 5000 FCFA
(
    'night-owl',
    'Night Owl',
    5000,
    NULL,
    'waiting',
    'hourly',
    22,
    50000,
    NOW()
);

-- Vérification
SELECT id, session_type, name, entry_fee, status, game_mode, scheduled_hour, min_prize
FROM game_sessions
WHERE session_type IN ('midi-express', 'after-work', 'prime-time', 'night-owl')
ORDER BY scheduled_hour;
