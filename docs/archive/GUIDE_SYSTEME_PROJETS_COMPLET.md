# 📊 Guide du Système de Projets Complet - Gabon24/7

## 🎯 Vue d'ensemble

Système complet de sauvegarde et tracking des projets business avec historique des actions effectuées.

---

## 🐛 Problème Résolu

### Avant
```typescript
// ❌ userId hardcodé
const userId = '550e8400-e29b-41d4-a716-446655440000'

// ❌ Pas de contexte utilisateur sauvegardé
// ❌ Pas de tracking des actions
// ❌ Pas de redirection intelligente
```

### Après
```typescript
// ✅ Vrai utilisateur connecté
userId: user.id

// ✅ Contexte complet sauvegardé
userContext: { age, experience, capital, objectives }

// ✅ Tracking automatique des actions
// ✅ Navigation vers les bons onglets
```

---

## 🗄️ Architecture de la Base de Données

### Table `saved_projects` (Enrichie)

```sql
CREATE TABLE saved_projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Article source
  article_title TEXT,
  article_summary TEXT,
  article_url TEXT,
  article_image_url TEXT,
  article_source TEXT,
  article_published_at TIMESTAMPTZ,
  
  -- Analyse contextuelle
  problematique_centrale TEXT,
  secteur_principal TEXT,
  acteurs_impactes TEXT,
  urgence_score INTEGER,
  
  -- Choix utilisateur
  secteur_selectionne TEXT,
  budget_selectionne TEXT,
  
  -- Proposition sauvegardée
  proposition_titre TEXT,
  proposition_description TEXT,
  proposition_investissement TEXT,
  proposition_rentabilite TEXT,
  proposition_revenus_mensuels TEXT,
  proposition_actions_immediates JSONB,
  proposition_avantages_concurrentiels JSONB,
  proposition_score_faisabilite INTEGER,
  
  -- NOUVEAU: Contexte utilisateur complet
  user_context JSONB, -- {age, experience, capital, objectifs}
  
  -- NOUVEAU: Tracking
  actions_count INTEGER DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table `project_actions` (Nouvelle)

```sql
CREATE TABLE project_actions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES saved_projects(id),
  user_id UUID NOT NULL,
  
  action_type TEXT NOT NULL,
  -- 'action-plan', 'skill-test', 'custom-training', 'business-plan'
  
  action_status TEXT DEFAULT 'pending',
  -- 'pending', 'in_progress', 'completed'
  
  action_reference_id UUID,
  -- ID de l'objet créé (plan_id, test_id, etc.)
  
  metadata JSONB,
  -- Données supplémentaires
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📋 Parcours Utilisateur Complet

### 1️⃣ Analyser un article

```
Analyzer → Sélectionner article
         → Analyser les opportunités
         → Choisir secteur + budget
         → Voir propositions
```

### 2️⃣ Sauvegarder une proposition

```typescript
// Sur chaque proposition
[Sauvegarder] ← Bouton à côté de "Aller + Loin"

// Données sauvegardées:
{
  userId: user.id, // ✅ Utilisateur réel
  article: { title, url, summary, image, source },
  analysis: { problematique, secteur, acteurs },
  secteurSelectionne: "Agriculture",
  budgetSelectionne: "500k - 2M XAF",
  proposition: { titre, description, investissement... },
  userContext: { // ✅ NOUVEAU
    age: 30,
    experience_entrepreneuriale: "2 ans",
    capital_disponible: "1M XAF",
    objectifs: "Créer emplois"
  }
}
```

### 3️⃣ Effectuer des actions (Dropdown "Aller + Loin")

#### Plan d'Action (25 crédits)
```typescript
// Action
Clic → Génération plan → Sauvegardé dans action_plans

// Tracking automatique
{
  projectId: "uuid",
  actionType: "action-plan",
  actionReferenceId: plan_id,
  actionStatus: "completed"
}

// Redirection
→ /business/mes-projets?tab=plans
```

#### Test de Compétence (30 crédits)
```typescript
// Action
Clic → Génération test → Sauvegardé dans skill_tests

// Tracking
{
  actionType: "skill-test",
  actionReferenceId: test_id
}

// Redirection
→ /business/mes-projets?tab=tests
```

#### Formation sur Mesure (50 crédits)
```typescript
// Action
Clic → Génération formation → Sauvegardé dans custom_trainings

// Tracking
{
  actionType: "custom-training",
  actionReferenceId: training_id
}

// Redirection
→ /business/formations?id=training_id
```

#### Business Plan (100 crédits)
```typescript
// Action
Clic → Génération BP → Sauvegardé dans saved_documents

// Tracking
{
  actionType: "business-plan",
  actionReferenceId: doc_id
}

// Redirection
→ /business/mes-projets?tab=docs
```

---

## 🔧 API Endpoints

### Sauvegarder un projet

```bash
POST /api/save-project

Body:
{
  "userId": "user-uuid",
  "article": {...},
  "analysis": {...},
  "secteurSelectionne": "Agriculture",
  "budgetSelectionne": "500k-2M",
  "proposition": {...},
  "userContext": { // NOUVEAU
    "age": 30,
    "experience_entrepreneuriale": "2 ans",
    "capital_disponible": "1M XAF"
  }
}

Response:
{
  "success": true,
  "project": {...},
  "projectId": "uuid"
}
```

### Tracker une action

```bash
POST /api/project-actions/track

Body:
{
  "projectId": "project-uuid",
  "userId": "user-uuid",
  "actionType": "action-plan",
  "actionReferenceId": "plan-uuid",
  "metadata": {
    "creditsUsed": 25,
    "generationTime": 15000
  }
}

Response:
{
  "success": true,
  "action": {...}
}
```

### Récupérer les actions d'un projet

```bash
GET /api/project-actions/:projectId

Response:
{
  "success": true,
  "actions": [
    {
      "id": "uuid",
      "action_type": "action-plan",
      "action_status": "completed",
      "action_reference_id": "plan-uuid",
      "created_at": "2025-01-05T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Résumé des actions par utilisateur

```bash
GET /api/project-actions/user/:userId/summary

Response:
{
  "success": true,
  "summary": {
    "total": 15,
    "byType": {
      "action-plan": 5,
      "skill-test": 4,
      "custom-training": 3,
      "business-plan": 3
    },
    "completed": 12,
    "pending": 3
  }
}
```

---

## 🎨 Composant Historique

### Utilisation Simple

```tsx
import ProjectActionsHistory from '@/components/project/ProjectActionsHistory'

// Dans saved_projects detail view
<ProjectActionsHistory 
  projectId={project.id}
  compact={false} // Affichage complet
/>
```

### Mode Compact

```tsx
// Dans la card du projet
<ProjectActionsHistory 
  projectId={project.id}
  compact={true} // Affiche seulement 3 dernières actions
/>
```

### Affichage

```
📊 Historique des actions (4)

┌────────────────────────────────────┐
│ 🚀 Plan d'action                   │
│ Il y a 2h        [✓ Complété]      │
│ → Voir le résultat                 │
├────────────────────────────────────┤
│ 🎯 Test de compétence              │
│ Il y a 5h        [✓ Complété]      │
│ → Voir le résultat                 │
├────────────────────────────────────┤
│ 🎓 Formation sur mesure            │
│ Il y a 1j        [○ En cours]      │
├────────────────────────────────────┤
│ 📊 Business Plan                   │
│ Il y a 3j        [○ En attente]    │
└────────────────────────────────────┘
```

---

## 🔄 Flux de Tracking Automatique

### Plan d'Action

```typescript
// 1. Génération du plan
const response = await fetch('/api/action-plans/generate', {
  method: 'POST',
  body: JSON.stringify({ userId, proposal, articleId })
})

const { plan } = await response.json()

// 2. Tracking automatique (si projectId fourni)
if (projectId) {
  await trackProjectAction({
    projectId,
    userId,
    actionType: 'action-plan',
    actionReferenceId: plan.id,
    metadata: { creditsUsed: 25 }
  })
}

// 3. Redirection
window.location.href = '/business/mes-projets?tab=plans'
```

### Test de Compétence

```typescript
// Même logique
actionType: 'skill-test'
→ /business/mes-projets?tab=tests
```

### Formation

```typescript
actionType: 'custom-training'
→ /business/formations?id=training_id
```

---

## 📊 Page Mes Projets Enrichie

### Onglets avec Compteurs

```tsx
┌─────────────────────────────────────────────┐
│ [Projets (12)] [Plans (5)] [Tests (4)]      │
│ [Formations (3)]                             │
└─────────────────────────────────────────────┘

// Projets
foreach (project in projects) {
  Card Projet {
    - Titre proposition
    - Secteur + Budget
    - Score faisabilité
    - Actions count: 3 actions
    - Last action: Il y a 2h
    
    [Voir détails] → Affiche historique complet
  }
}

// Détail Projet Modal
Modal {
  - Infos article
  - Contexte utilisateur
  - Proposition complète
  - 📊 Historique des actions (4)
    → Chaque action avec lien de redirection
}
```

---

## 🧪 Tests

### 1. Test Sauvegarde avec Contexte

```bash
# 1. Se connecter
# 2. Analyzer → Choisir article
# 3. Remplir formulaire contexte (âge, expérience, capital)
# 4. Analyser → Voir propositions
# 5. Cliquer "Sauvegarder" sur une proposition

# Vérifier en DB:
SELECT user_context FROM saved_projects 
WHERE id = 'project-uuid';

# Résultat attendu:
{
  "age": 30,
  "experience_entrepreneuriale": "2 ans",
  "capital_disponible": "1M XAF",
  "objectifs": "Créer emplois locaux"
}
```

### 2. Test Tracking Actions

```bash
# 1. Projet sauvegardé
# 2. Clic "Aller + Loin" → "Plan d'action"
# 3. Génération réussie

# Vérifier:
SELECT * FROM project_actions 
WHERE project_id = 'project-uuid';

# Attendu:
{
  "action_type": "action-plan",
  "action_status": "completed",
  "action_reference_id": "plan-uuid"
}

# Vérifier project:
SELECT actions_count, last_action_at 
FROM saved_projects 
WHERE id = 'project-uuid';

# Attendu:
{
  "actions_count": 1,
  "last_action_at": "2025-01-05T12:00:00Z"
}
```

### 3. Test Navigation

```bash
# Sur page Mes Projets
# Clic projet → Voir historique
# Clic "Voir le résultat" sur action Plan d'action

# Attendu: Redirection vers
/business/mes-projets?tab=plans

# L'onglet "Plans d'action" s'ouvre automatiquement
```

---

## 🎯 Bénéfices

### Pour l'Utilisateur

✅ **Historique complet** - Voir toutes les actions effectuées  
✅ **Navigation facile** - Liens directs vers les résultats  
✅ **Contexte préservé** - Budget, objectifs sauvegardés  
✅ **Suivi progression** - Compteurs et timestamps  

### Pour le Système

✅ **Analytics précis** - Tracking de toutes les actions  
✅ **Optimisation UX** - Comprendre le parcours utilisateur  
✅ **Monétisation** - Suivi des crédits par type d'action  
✅ **Référencement** - Lier projets, plans, tests, formations  

---

## 📈 Métriques Disponibles

### Par Utilisateur

```typescript
{
  total_projects: 12,
  total_actions: 45,
  byType: {
    'action-plan': 15,
    'skill-test': 12,
    'custom-training': 10,
    'business-plan': 8
  },
  completed: 38,
  pending: 7,
  credits_used: 1850
}
```

### Par Projet

```typescript
{
  project_id: "uuid",
  actions_count: 4,
  actions: [
    { type: 'action-plan', status: 'completed' },
    { type: 'skill-test', status: 'completed' },
    { type: 'custom-training', status: 'in_progress' },
    { type: 'business-plan', status: 'pending' }
  ],
  last_activity: "Il y a 2h"
}
```

---

## 🚀 Prochaines Évolutions

### Phase 2 (Optionnel)

- [ ] Dashboard analytics global
- [ ] Graphiques de progression
- [ ] Comparaison inter-projets
- [ ] Export PDF du projet complet
- [ ] Partage de projet avec équipe
- [ ] Notifications sur actions en attente

---

## 📝 Résumé

Vous avez maintenant un **système complet et structuré** :

1. ✅ **Sauvegarde** avec vrai userId + contexte utilisateur
2. ✅ **Tracking** automatique de toutes les actions
3. ✅ **Historique** visible dans Mes Projets
4. ✅ **Navigation** intelligente vers les bons onglets
5. ✅ **Analytics** sur l'usage des fonctionnalités
6. ✅ **Référencement** entre projets et actions

Le système est **production-ready** et **évolutif** ! 🎉
