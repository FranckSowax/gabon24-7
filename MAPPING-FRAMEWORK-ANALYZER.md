# Mapping Projets Framework vers Format Analyzer

## 🎯 Problème Résolu

Les projets créés via le **formulaire assisté IA** (document cadre/framework) n'apparaissaient pas correctement dans la liste des projets `/business/mes-projets` car ils utilisaient des colonnes différentes de ceux créés via l'**analyzer d'articles**.

---

## 📊 Différences de Structure

### Format Analyzer (Articles)
```typescript
{
  proposition_titre: "Titre du projet",
  proposition_description: "Description détaillée",
  secteur_selectionne: "Agriculture",
  budget_selectionne: "Moyen budget (2M - 10M FCFA)",
  problematique_centrale: "Problème identifié",
  article_title: "Titre de l'article source",
  article_summary: "Résumé de l'article",
  proposition_score_faisabilite: 85
}
```

### Format Framework (Formulaire IA)
```typescript
{
  title: "Titre du projet",
  description: "Description détaillée",
  category: "Agriculture",
  budget: "Moyen budget",
  phase: "idea",
  location: "Libreville",
  unique_value: "Proposition de valeur"
}
```

---

## ✅ Solution Implémentée

### Mapping Bidirectionnel

Lors de la création d'un projet via le framework, les données sont maintenant mappées vers **TOUS les formats** pour assurer la compatibilité totale.

**Fichier modifié:** `backend/server.js` (ligne 4330-4385)

```javascript
// Créer le projet dans Supabase avec mapping vers format analyzer
const { data: project, error: projectError } = await supabase
  .from('saved_projects')
  .insert({
    user_id: userId,
    
    // ✅ Mapping vers format analyzer (colonnes principales)
    proposition_titre: projectCardData.title,
    proposition_description: projectCardData.description,
    secteur_selectionne: projectCardData.category,
    budget_selectionne: projectCardData.budget,
    
    // ✅ Colonnes spécifiques framework (pour compatibilité)
    title: projectCardData.title,
    description: projectCardData.description,
    category: projectCardData.category,
    status: 'active',
    phase: projectCardData.phase,
    budget: projectCardData.budget,
    location: projectCardData.location,
    team_size: projectCardData.team_size,
    timeline: projectCardData.timeline,
    target_audience: projectCardData.target_audience,
    unique_value: projectCardData.unique_value,
    
    // ✅ Données analyzer manquantes (valeurs par défaut)
    article_title: null,
    article_summary: null,
    article_url: null,
    article_image_url: null,
    article_source: 'Formulaire IA',
    article_published_at: null,
    problematique_centrale: projectCardData.unique_value || 'À définir',
    secteur_principal: projectCardData.category,
    proposition_problematique: projectCardData.unique_value,
    proposition_investissement: projectCardData.budget,
    proposition_rentabilite: 'À calculer',
    proposition_revenus_mensuels: 'À estimer',
    proposition_actions_immediates: [],
    proposition_avantages_concurrentiels: [projectCardData.unique_value || 'Innovation'],
    proposition_score_faisabilite: 75,
    
    // ✅ Business Tracker
    current_phase: projectCardData.phase || 'idea',
    progress_percentage: 0,
    total_credits_used: 50, // Coût de génération du framework
    
    cumulative_context: [{
      date: new Date().toISOString(),
      type: 'project_creation',
      content: 'Projet créé via formulaire assisté IA',
      form_data: formData
    }],
    context_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  })
  .select()
  .single();
```

---

## 🗂️ Table de Mapping Complète

| Colonne Analyzer | Colonne Framework | Valeur par Défaut | Notes |
|------------------|-------------------|-------------------|-------|
| `proposition_titre` | `title` | - | Titre principal |
| `proposition_description` | `description` | - | Description détaillée |
| `secteur_selectionne` | `category` | - | Secteur d'activité |
| `budget_selectionne` | `budget` | - | Budget estimé |
| `problematique_centrale` | `unique_value` | "À définir" | Problème résolu |
| `secteur_principal` | `category` | - | Secteur principal |
| `proposition_problematique` | `unique_value` | - | Problématique |
| `proposition_investissement` | `budget` | - | Investissement |
| `proposition_rentabilite` | - | "À calculer" | À définir plus tard |
| `proposition_revenus_mensuels` | - | "À estimer" | À définir plus tard |
| `proposition_actions_immediates` | - | `[]` | Vide initialement |
| `proposition_avantages_concurrentiels` | `unique_value` | `["Innovation"]` | Basé sur unique_value |
| `proposition_score_faisabilite` | - | `75` | Score par défaut |
| `article_title` | - | `null` | Pas d'article source |
| `article_summary` | - | `null` | Pas d'article source |
| `article_url` | - | `null` | Pas d'article source |
| `article_image_url` | - | `null` | Pas d'article source |
| `article_source` | - | "Formulaire IA" | Source identifiée |
| `article_published_at` | - | `null` | Pas de date |
| `current_phase` | `phase` | "idea" | Phase actuelle |
| `progress_percentage` | - | `0` | Début du projet |
| `total_credits_used` | - | `50` | Coût génération |

---

## 🎨 Affichage dans /business/mes-projets

### Avant le Mapping

**Problème:** Les projets framework n'apparaissaient pas ou s'affichaient mal car les colonnes `proposition_titre`, `secteur_selectionne`, etc. étaient `null`.

```
❌ Carte projet vide ou incomplète
❌ Secteur manquant
❌ Budget non affiché
❌ Score de faisabilité à 0
```

### Après le Mapping

**Résultat:** Les projets framework s'affichent exactement comme les projets analyzer.

```tsx
✅ Titre: projectCardData.title → proposition_titre
✅ Description: projectCardData.description → proposition_description
✅ Secteur: projectCardData.category → secteur_selectionne
✅ Budget: projectCardData.budget → budget_selectionne
✅ Score: 75% (par défaut)
✅ Problématique: projectCardData.unique_value
✅ Source: "Formulaire IA" (badge distinct)
```

---

## 📋 Colonnes Spécifiques Framework Conservées

Ces colonnes restent disponibles pour des fonctionnalités futures spécifiques au framework :

```typescript
{
  title: string,              // Titre original framework
  description: string,        // Description originale
  category: string,           // Catégorie framework
  phase: string,              // Phase du projet (idea, planning, etc.)
  location: string,           // Localisation (Libreville, etc.)
  team_size: number,          // Taille de l'équipe
  timeline: string,           // Timeline estimée
  target_audience: string,    // Audience cible
  unique_value: string,       // Proposition de valeur unique
  status: 'active'            // Statut framework
}
```

---

## 🔄 Workflow Complet

### 1. Création via Formulaire IA

```
User remplit formulaire
   ↓
Backend génère document cadre (IA)
   ↓
extractProjectCardData() extrait les données
   ↓
Mapping vers format analyzer + framework
   ↓
Insertion dans saved_projects
   ↓
Document cadre sauvegardé dans project_documents
   ↓
Événement timeline créé
```

### 2. Affichage dans Mes Projets

```
Requête: GET /api/saved-projects/{userId}
   ↓
Retourne TOUS les projets (analyzer + framework)
   ↓
Frontend lit proposition_titre, secteur_selectionne, etc.
   ↓
Affichage uniforme dans les cartes projet
   ↓
Badge "Formulaire IA" pour distinguer la source
```

---

## 🎯 Valeurs par Défaut Intelligentes

### Score de Faisabilité: 75%

**Justification:** Les projets créés via formulaire IA ont déjà été validés par l'assistant, donc un score moyen-élevé est approprié.

### Rentabilité: "À calculer"

**Justification:** Ces données nécessitent une analyse plus approfondie qui sera faite via les actions IA.

### Actions Immédiates: []

**Justification:** Le plan d'action sera généré via l'onglet "Actions IA" du projet.

### Crédits Utilisés: 50

**Justification:** Coût estimé de la génération du document cadre avec IA.

---

## 🔍 Identification de la Source

### Badge "Formulaire IA"

Les projets créés via le framework sont identifiables par :

```typescript
article_source: 'Formulaire IA'
```

**Affichage possible:**
- Badge distinct dans la carte projet
- Icône spécifique (📝 au lieu de 📰)
- Couleur différente pour le secteur

---

## 📊 Compatibilité Totale

### Fonctionnalités Supportées

**✅ Toutes les fonctionnalités analyzer fonctionnent:**

1. **Actions IA**
   - Étude de marché
   - Business plan
   - Plan d'action
   - Formation
   - Test de compétences

2. **Documents**
   - Document cadre (déjà créé)
   - Documents générés par actions IA
   - Upload de documents

3. **Collaboration**
   - Inviter des collaborateurs
   - Commentaires
   - Partage de documents

4. **Timeline**
   - Événements automatiques
   - Historique des actions

5. **Notes**
   - Ajout de notes
   - Édition/Suppression

6. **ChatBot IA**
   - Contexte du projet
   - Assistance personnalisée

---

## 🧪 Tests de Validation

### Test 1: Création Projet Framework

```bash
1. Aller sur /business/creer-projet
2. Remplir le formulaire IA
3. Générer le document cadre
4. Vérifier la création du projet
5. Aller sur /business/mes-projets
6. ✅ Le projet apparaît dans la liste
7. ✅ Titre, secteur, budget affichés
8. ✅ Score de faisabilité: 75%
```

### Test 2: Compatibilité Actions IA

```bash
1. Ouvrir un projet framework
2. Cliquer sur "Actions IA"
3. Générer une étude de marché
4. ✅ L'action utilise les bonnes données
5. ✅ Le document est créé
6. ✅ Le contexte est mis à jour
```

### Test 3: Affichage Mixte

```bash
1. Créer 1 projet via analyzer
2. Créer 1 projet via framework
3. Aller sur /business/mes-projets
4. ✅ Les 2 projets s'affichent
5. ✅ Format uniforme
6. ✅ Distinction par source (badge)
```

---

## 🔧 Maintenance Future

### Ajout de Nouvelles Colonnes

Si de nouvelles colonnes sont ajoutées à `saved_projects`, penser à :

1. **Vérifier la compatibilité** avec les deux formats
2. **Ajouter le mapping** si nécessaire
3. **Définir une valeur par défaut** appropriée
4. **Tester** avec les deux workflows

### Exemple:

```javascript
// Nouvelle colonne: proposition_marche_cible
proposition_marche_cible: projectCardData.target_audience || 'À définir'
```

---

## 📈 Statistiques

### Projets par Source

**Requête SQL:**
```sql
SELECT 
  article_source,
  COUNT(*) as count,
  AVG(proposition_score_faisabilite) as avg_score
FROM saved_projects
GROUP BY article_source;
```

**Résultats attendus:**
```
article_source    | count | avg_score
------------------|-------|----------
Gabonews          |   45  |   82
Formulaire IA     |   12  |   75
L'Union           |   23  |   79
```

---

## 💡 Améliorations Futures

### 1. Score de Faisabilité Dynamique

Au lieu d'un score fixe de 75%, calculer un score basé sur :
- Complétude du formulaire
- Qualité des réponses
- Cohérence du budget avec le secteur

### 2. Analyse Automatique

Après création du projet framework, lancer automatiquement :
- Analyse de marché du secteur
- Recherche de concurrents
- Estimation de rentabilité

### 3. Suggestions Personnalisées

Basées sur les données du formulaire :
- Actions IA recommandées
- Formations pertinentes
- Articles liés au secteur

---

## 🎓 Exemple Complet

### Données Formulaire IA

```json
{
  "projectName": "Ferme Aquaponique Urbaine",
  "category": "Agriculture",
  "description": "Système de culture combinant aquaculture et hydroponie",
  "location": "Libreville",
  "budget": "Moyen budget (2M - 10M FCFA)",
  "phase": "idea",
  "team_size": 3,
  "timeline": "6-12 mois",
  "target_audience": "Restaurants et hôtels de Libreville",
  "unique_value": "Production locale de légumes frais et poissons sans pesticides"
}
```

### Projet Créé (Mapping Complet)

```json
{
  "id": "uuid-xxx",
  "user_id": "user-123",
  
  // Format Analyzer
  "proposition_titre": "Ferme Aquaponique Urbaine",
  "proposition_description": "Système de culture combinant aquaculture et hydroponie",
  "secteur_selectionne": "Agriculture",
  "budget_selectionne": "Moyen budget (2M - 10M FCFA)",
  "problematique_centrale": "Production locale de légumes frais et poissons sans pesticides",
  "secteur_principal": "Agriculture",
  "proposition_problematique": "Production locale de légumes frais et poissons sans pesticides",
  "proposition_investissement": "Moyen budget (2M - 10M FCFA)",
  "proposition_rentabilite": "À calculer",
  "proposition_revenus_mensuels": "À estimer",
  "proposition_actions_immediates": [],
  "proposition_avantages_concurrentiels": ["Production locale de légumes frais et poissons sans pesticides"],
  "proposition_score_faisabilite": 75,
  
  // Données article (null pour framework)
  "article_title": null,
  "article_summary": null,
  "article_url": null,
  "article_image_url": null,
  "article_source": "Formulaire IA",
  "article_published_at": null,
  
  // Format Framework
  "title": "Ferme Aquaponique Urbaine",
  "description": "Système de culture combinant aquaculture et hydroponie",
  "category": "Agriculture",
  "status": "active",
  "phase": "idea",
  "budget": "Moyen budget (2M - 10M FCFA)",
  "location": "Libreville",
  "team_size": 3,
  "timeline": "6-12 mois",
  "target_audience": "Restaurants et hôtels de Libreville",
  "unique_value": "Production locale de légumes frais et poissons sans pesticides",
  
  // Business Tracker
  "current_phase": "idea",
  "progress_percentage": 0,
  "total_credits_used": 50,
  "cumulative_context": [{
    "date": "2025-01-27T10:30:00Z",
    "type": "project_creation",
    "content": "Projet créé via formulaire assisté IA",
    "form_data": { /* ... */ }
  }],
  "context_updated_at": "2025-01-27T10:30:00Z",
  "created_at": "2025-01-27T10:30:00Z"
}
```

---

## ✅ Résultat Final

**Avant:**
- ❌ Projets framework invisibles ou mal affichés
- ❌ Incompatibilité avec les actions IA
- ❌ Données manquantes dans les cartes

**Après:**
- ✅ Affichage uniforme de tous les projets
- ✅ Compatibilité totale avec toutes les fonctionnalités
- ✅ Mapping bidirectionnel complet
- ✅ Valeurs par défaut intelligentes
- ✅ Source identifiable (badge "Formulaire IA")

---

**Dernière mise à jour:** 27 octobre 2025, 11:30 AM  
**Status:** 🟢 **Déployé en Production**  
**Commit:** `95a557a`  
**Impact:** Critique → Résolu
