-- Migration: Ajouter le support des deux modes de jeu (Quota et Horaire)
-- Date: 2024-12-08

-- Ajouter les nouvelles colonnes pour les modes de jeu
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'quota' CHECK (game_mode IN ('quota', 'hourly'));

-- Colonne pour l'heure de lancement programmée (mode horaire)
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

-- Colonne pour l'heure programmée (0-23 pour mode horaire)
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS scheduled_hour INTEGER CHECK (scheduled_hour >= 0 AND scheduled_hour <= 23);

-- Colonne pour le prix minimum garanti (mode horaire)
ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS min_prize INTEGER DEFAULT 0;

-- Modifier max_players pour permettre NULL (illimité pour mode horaire)
ALTER TABLE game_sessions 
ALTER COLUMN max_players DROP NOT NULL;

-- Ajouter un commentaire sur la table
COMMENT ON COLUMN game_sessions.game_mode IS 'Mode de jeu: quota (remplissage requis) ou hourly (lancement à heure fixe)';
COMMENT ON COLUMN game_sessions.starts_at IS 'Date/heure de lancement pour le mode horaire';
COMMENT ON COLUMN game_sessions.scheduled_hour IS 'Heure programmée (0-23) pour le mode horaire';
COMMENT ON COLUMN game_sessions.min_prize IS 'Prix minimum garanti pour le mode horaire';

-- Index pour optimiser les requêtes par mode
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_mode ON game_sessions(game_mode);
CREATE INDEX IF NOT EXISTS idx_game_sessions_starts_at ON game_sessions(starts_at) WHERE starts_at IS NOT NULL;

-- Mettre à jour les sessions existantes en mode quota par défaut
UPDATE game_sessions SET game_mode = 'quota' WHERE game_mode IS NULL;
