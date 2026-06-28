-- =====================================================
-- Audio du résumé par article (bouton ▶️ gratuit)
-- Cache l'URL de l'audio TTS généré une seule fois.
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================

ALTER TABLE articles ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN articles.audio_url IS 'URL publique de l''audio TTS du résumé (généré à la demande, mutualisé entre lecteurs).';
