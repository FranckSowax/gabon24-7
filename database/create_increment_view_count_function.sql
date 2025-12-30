-- Fonction pour incrémenter le compteur de vues d'un article
CREATE OR REPLACE FUNCTION increment_view_count(article_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    -- Incrémenter le compteur de vues et mettre à jour last_viewed_at
    UPDATE articles 
    SET 
        view_count = COALESCE(view_count, 0) + 1,
        last_viewed_at = NOW()
    WHERE id = article_id
    RETURNING view_count INTO new_count;
    
    -- Retourner le nouveau compteur
    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;
