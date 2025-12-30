# Système de Catégorisation Temporelle des Trajets

## Vue d'ensemble

Le système de catégorisation temporelle permet d'organiser les itinéraires de trafic en fonction de leur direction et du moment de la journée, améliorant l'expérience utilisateur dans le widget de trafic.

## Catégories Définies

### 🌅 **Matinée (morning)**
- **Description** : Trajets vers Libreville
- **Usage** : Routes utilisées le matin pour se rendre en centre-ville
- **Exemples** : 
  - Owendo → Libreville
  - PK5 → Centre-ville
  - Aéroport → Libreville

### 🌆 **Soir (evening)**
- **Description** : Trajets depuis Libreville  
- **Usage** : Routes utilisées le soir pour rentrer du centre-ville
- **Exemples** :
  - Libreville → Owendo
  - Centre-ville → PK5
  - Libreville → Aéroport

### ❓ **Non catégorisé**
- **Description** : Routes sans catégorie spécifique
- **Usage** : Trajets inter-quartiers ou routes spéciales

## Implémentation Technique

### Base de Données

```sql
-- Colonne ajoutée à la table map_routes
ALTER TABLE map_routes ADD COLUMN category route_category;

-- Enum pour les catégories
CREATE TYPE route_category AS ENUM ('morning', 'evening');
```

### Interface Admin

L'interface d'administration `/admin/routes` permet de :

1. **Visualiser** les catégories avec des badges colorés :
   - 🌅 Matinée (badge amber)
   - 🌆 Soir (badge indigo)

2. **Configurer** la catégorie via un dropdown :
   - Non catégorisé (valeur par défaut)
   - 🌅 Matinée (vers Libreville)
   - 🌆 Soir (depuis Libreville)

3. **Comprendre** l'impact via l'explication contextuelle dans le formulaire

### Widget de Trafic

Le widget utilise la catégorisation pour :

1. **Regrouper** les routes dans la dropdown :
   - Section "Matinée → Libreville"
   - Section "Soir → Retour" 
   - Section "Autres Routes"

2. **Améliorer** la navigation utilisateur avec une logique temporelle claire

## Règles de Catégorisation

### Détection Automatique
Le système peut détecter automatiquement certaines catégories basées sur :

```sql
-- Mise à jour automatique pour les routes existantes
UPDATE map_routes SET category = 'morning' 
WHERE title ILIKE '%→ libreville%' OR title ILIKE '%centre-ville%' OR title ILIKE '%→ aéroport%';

UPDATE map_routes SET category = 'evening' 
WHERE title ILIKE '%libreville →%' OR title ILIKE '%aéroport →%' OR title ILIKE '%→ owendo%';
```

### Critères de Classification

**Pour "morning" :**
- Titre contient "→ Libreville"
- Destination est le centre-ville
- Sens vers l'aéroport (arrivées)

**Pour "evening" :**
- Titre contient "Libreville →"  
- Origine est le centre-ville
- Sens depuis l'aéroport (départs)

## API et Intégration

### Endpoints Mis à Jour

1. **GET /.netlify/functions/get-routes**
   - Inclut maintenant le champ `category`
   - Utilisé par le widget de trafic

2. **POST/PUT /.netlify/functions/admin-routes** 
   - Accepte le paramètre `category`
   - Validation des valeurs enum

### Structure de Données

```typescript
interface Route {
  id: string
  title: string
  subtitle?: string
  google_maps_url?: string
  embed_url?: string
  html_content?: string
  display_order: number
  is_active: boolean
  created_at: string
  category?: 'morning' | 'evening'  // Nouveau champ
}
```

## Avantages Utilisateur

1. **Navigation intuitive** : Regroupement logique par période de la journée
2. **Recherche facilitée** : L'utilisateur trouve rapidement son trajet selon le contexte
3. **UX cohérente** : Logique temporelle alignée avec les habitudes de déplacement
4. **Flexibilité** : Possibilité de routes non catégorisées pour cas spéciaux

## Maintenance

### Ajout de Nouvelles Routes
1. Accéder à `/admin/routes`
2. Créer un nouveau trajet
3. Sélectionner la catégorie appropriée
4. La route apparaîtra automatiquement dans la bonne section du widget

### Modification des Catégories
1. Éditer la route existante dans l'admin
2. Changer la catégorie via le dropdown
3. Sauvegarder - la mise à jour est immédiate dans le widget

Cette documentation assure une compréhension complète du système pour les futurs développements et la maintenance.
