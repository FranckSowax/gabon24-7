-- Ajouter la colonne player_name si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_registrations' AND column_name = 'player_name') THEN
        ALTER TABLE public.game_registrations ADD COLUMN player_name TEXT;
    END IF;
END $$;
