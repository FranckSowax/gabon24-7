-- Ajouter la colonne html_content à la table map_routes
ALTER TABLE map_routes 
ADD COLUMN IF NOT EXISTS html_content TEXT;

-- Commentaire pour la colonne
COMMENT ON COLUMN map_routes.html_content IS 'Contenu HTML personnalisé pour les cartes (iframe, etc.)';
