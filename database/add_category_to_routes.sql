-- Ajouter la colonne category à la table map_routes
ALTER TABLE map_routes ADD COLUMN category VARCHAR(20);

-- Créer un enum pour les catégories (optionnel mais recommandé)
CREATE TYPE route_category AS ENUM ('morning', 'evening');

-- Modifier la colonne pour utiliser l'enum
ALTER TABLE map_routes ALTER COLUMN category TYPE route_category USING category::route_category;

-- Ajouter un commentaire pour clarifier l'usage
COMMENT ON COLUMN map_routes.category IS 'Catégorisation temporelle des itinéraires : morning (vers Libreville), evening (depuis Libreville)';

-- Créer un index sur la catégorie pour optimiser les requêtes
CREATE INDEX idx_map_routes_category ON map_routes(category);

-- Mettre à jour quelques exemples de données si la table contient déjà des routes
UPDATE map_routes SET category = 'morning' WHERE title ILIKE '%→ libreville%' OR title ILIKE '%centre-ville%' OR title ILIKE '%→ aéroport%';
UPDATE map_routes SET category = 'evening' WHERE title ILIKE '%libreville →%' OR title ILIKE '%aéroport →%' OR title ILIKE '%→ owendo%';
