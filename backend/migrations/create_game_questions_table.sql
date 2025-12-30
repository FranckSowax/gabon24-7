-- Table pour stocker les questions générées par l'IA
CREATE TABLE IF NOT EXISTS public.game_questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    answers JSONB NOT NULL, -- Tableau de 4 réponses
    correct_index INTEGER NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Facile', 'Moyen', 'Difficile', 'Expert')),
    category TEXT,
    source_url TEXT,
    source_title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_count INTEGER DEFAULT 0 -- Pour suivre la répétition globale si besoin
);

-- Index pour la recherche rapide par difficulté
CREATE INDEX IF NOT EXISTS idx_game_questions_difficulty ON public.game_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_game_questions_created_at ON public.game_questions(created_at);

-- RLS (Row Level Security)
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire (pour le jeu)
CREATE POLICY "Public read access" ON public.game_questions
    FOR SELECT USING (true);

-- Seul le service backend peut écrire (via clé service_role)
CREATE POLICY "Service role write access" ON public.game_questions
    FOR INSERT WITH CHECK (true);
