-- Migration: Corriger la colonne language dans audio_summaries
-- Problème: language est CHAR(1) au lieu de VARCHAR(5)
-- Solution: Recréer la colonne avec la bonne taille

-- Vérifier si la colonne existe et la supprimer si nécessaire
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'audio_summaries' 
        AND column_name = 'language'
    ) THEN
        ALTER TABLE audio_summaries DROP COLUMN language;
    END IF;
END $$;

-- Ajouter la colonne language avec la bonne définition
ALTER TABLE audio_summaries 
ADD COLUMN language VARCHAR(5) DEFAULT 'fr' CHECK (language IN ('fr', 'en', 'zh'));

-- Ajouter les autres colonnes manquantes
ALTER TABLE audio_summaries 
ADD COLUMN IF NOT EXISTS voice_used VARCHAR(50),
ADD COLUMN IF NOT EXISTS time_slot VARCHAR(20) CHECK (time_slot IN ('morning', 'afternoon', 'evening', 'test'));

-- Créer index pour recherche par langue et time_slot
CREATE INDEX IF NOT EXISTS idx_audio_summaries_language ON audio_summaries(language);
CREATE INDEX IF NOT EXISTS idx_audio_summaries_time_slot ON audio_summaries(time_slot);

-- Commentaire
COMMENT ON COLUMN audio_summaries.language IS 'Langue du résumé: fr (français), en (anglais), zh (chinois)';
COMMENT ON COLUMN audio_summaries.voice_used IS 'Voix TTS utilisée pour générer l audio';
COMMENT ON COLUMN audio_summaries.time_slot IS 'Créneau horaire du résumé: morning, afternoon, evening, test';
