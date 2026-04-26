# 🎯 VISION : BUSINESS TRACKER DOPÉ À L'IA

## 🎬 CONCEPT GLOBAL

Transformer "Mes Projets" en **véritable outil de suivi d'idées business** de l'idée initiale jusqu'à la réalisation concrète.

---

## 📊 LOGIQUE CHRONOLOGIQUE DE BUSINESSMAN

### **Phases du projet** :

```
1. 💡 IDÉE INITIALE
   └─ Opportunité détectée depuis un article
   └─ Première analyse IA générée

2. 🔍 ANALYSE & CONTEXTE
   └─ Ajout de contexte cumulatif
   └─ Ré-analyse avec contexte enrichi
   └─ Documents parsés intégrés

3. 📋 PLANIFICATION
   └─ Plan d'action généré (10 étapes)
   └─ Barre de progression activée
   └─ Actions "Aller + loin" disponibles

4. 🎓 PRÉPARATION
   └─ Formation sur mesure
   └─ Test de compétences
   └─ Acquisition des compétences clés

5. 📊 BUSINESS PLAN
   └─ Business plan complet généré
   └─ Validation financière
   └─ Préparation au lancement

6. 🚀 LANCEMENT
   └─ Étapes du plan d'action complétées
   └─ Structure créée
   └─ Projet opérationnel

7. ✅ RÉUSSITE
   └─ Projet réalisé
   └─ Objectifs atteints
   └─ Suivi post-lancement
```

---

## 🎨 INTERFACE UTILISATEUR

### **Carte Projet (Vue liste)** :

```
┌─────────────────────────────────────────┐
│ 📊 Plan d'action - Agriculture          │
│ ⚡ 125 crédits consommés                │
│                                          │
│ ████████████░░░░░░░░ 60% Progression    │
│ 6/10 étapes complétées                  │
│                                          │
│ 💡 Phase actuelle: PLANIFICATION        │
│ 🔄 Contexte actualisé le: 13 oct 2025   │
│                                          │
│ [Ajouter contexte] [Ré-analyser]        │
└─────────────────────────────────────────┘
```

### **Vue détaillée projet** :

```
╔════════════════════════════════════════════╗
║  📊 Projet: Agriculture Bio - Mangues      ║
╠════════════════════════════════════════════╣
║                                            ║
║  🎯 PROGRESSION GLOBALE                    ║
║  ████████████████░░░░░░░░ 65%             ║
║                                            ║
║  Phase: 3/7 - PLANIFICATION                ║
║  ⚡ Crédits consommés: 125                 ║
║  🔄 Dernière actualisation: 13 oct 2025    ║
║                                            ║
╠════════════════════════════════════════════╣
║  📋 PLAN D'ACTION (6/10 complétées)        ║
║  ✅ 1. Étude de marché (complété)          ║
║  ✅ 2. Analyse concurrence (complété)      ║
║  ✅ 3. Validation idée (complété)          ║
║  ⏸️ 4. Formation agriculture (en cours)    ║
║  ⬜ 5. Recherche financement               ║
║  ⬜ 6. ...                                 ║
║                                            ║
║  [Marquer comme complété]                  ║
╠════════════════════════════════════════════╣
║  📄 CONTEXTE CUMULATIF                     ║
║  🔄 Actualisé le: 13 oct 2025              ║
║                                            ║
║  • Budget: 500 000 FCFA                    ║
║  • Terrain disponible: 2 hectares          ║
║  • Partenaire trouvé: ONG locale           ║
║  • Formation suivie: Agriculture bio       ║
║                                            ║
║  [+ Ajouter élément]                       ║
║  [📤 Ré-analyser avec IA] (25 ⚡)         ║
╠════════════════════════════════════════════╣
║  🚀 ACTIONS DISPONIBLES                    ║
║  📋 Plan d'action ✅ (fait - 25⚡)         ║
║  🎯 Test compétences ⏸️ (en cours - 30⚡) ║
║  🎓 Formation ⬜ (50⚡)                    ║
║  📊 Business Plan ⬜ (100⚡)               ║
║                                            ║
║  [Lancer action avec contexte actuel]      ║
╚════════════════════════════════════════════╝
```

---

## 💾 STRUCTURE DONNÉES

### **Table `saved_projects` enrichie** :

```sql
ALTER TABLE saved_projects ADD COLUMN IF NOT EXISTS
  current_phase TEXT DEFAULT 'idea', -- idea, analysis, planning, preparation, business_plan, launch, success
  progress_percentage INTEGER DEFAULT 0,
  total_credits_used INTEGER DEFAULT 0,
  context_updated_at TIMESTAMP,
  plan_action_steps JSONB, -- [{step: 1, title: '...', status: 'completed'|'in_progress'|'todo'}]
  cumulative_context JSONB; -- [{date, type, content}]
```

### **Table `ai_actions_history`** :

```sql
CREATE TABLE ai_actions_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES saved_projects(id),
  user_id UUID,
  action_type TEXT, -- 'initial_analysis', 're_analysis', 'action_plan', 'skill_test', etc.
  credits_consumed INTEGER,
  context_snapshot JSONB, -- Snapshot du contexte au moment de l'action
  result_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 FLUX UTILISATEUR

### **1. Création du projet (Idée initiale)** :

```
User analyse un article
  ↓
IA génère opportunité (25 ⚡)
  ↓
Projet créé en phase "IDÉE"
  ↓
Progression: 0%
  ↓
Message: "🎯 Générez un plan d'action pour activer le suivi de progression!"
```

### **2. Ajout de contexte cumulatif** :

```
User clique [+ Ajouter élément]
  ↓
Modal s'ouvre:
┌────────────────────────────────┐
│ Ajouter un élément de contexte │
│                                │
│ Type:                          │
│ [Budget] [Ressource] [Contact] │
│ [Compétence] [Autre]          │
│                                │
│ Description:                   │
│ [Textarea]                     │
│                                │
│ [Annuler] [Ajouter]           │
└────────────────────────────────┘
  ↓
Élément ajouté au contexte cumulatif
  ↓
context_updated_at = NOW()
  ↓
Badge "🔄 Contexte actualisé" affiché
```

### **3. Ré-analyse avec contexte** :

```
User clique [Ré-analyser avec IA]
  ↓
Vérification crédits (25 ⚡)
  ↓
Construction prompt enrichi:
  - Analyse initiale
  - Contexte cumulatif complet
  - Documents générés (parsés)
  - Notes et commentaires
  ↓
Appel IA
  ↓
Nouvelle analyse générée
  ↓
Crédits débités (25 ⚡)
  ↓
total_credits_used += 25
  ↓
context_updated_at = NOW()
  ↓
Notification: "✅ Analyse actualisée avec succès!"
```

### **4. Génération Plan d'action** :

```
User lance action "Plan d'action"
  ↓
Vérification crédits (25 ⚡)
  ↓
IA génère plan 10 étapes
  ↓
plan_action_steps sauvegardé en JSONB
  ↓
current_phase = 'planning'
  ↓
Barre de progression activée ✅
  ↓
Message: "🎉 Suivi de progression activé!"
```

### **5. Complétion d'étapes** :

```
User clique "Marquer comme complété" sur étape
  ↓
plan_action_steps[step].status = 'completed'
  ↓
Calcul progression:
progress = (étapes_complétées / total_étapes) * 100
  ↓
Si 100% → current_phase = 'success'
  ↓
Badge progression mis à jour
```

---

## ⚡ SYSTÈME DE CRÉDITS

### **Consommation par action** :

| Action | Crédits | Quand |
|--------|---------|-------|
| Analyse initiale | 25 ⚡ | Création projet |
| Ré-analyse | 25 ⚡ | Avec contexte enrichi |
| Plan d'action | 25 ⚡ | Génération 10 étapes |
| Test compétences | 30 ⚡ | Évaluation personnalisée |
| Formation | 50 ⚡ | Contenu sur mesure |
| Business Plan | 100 ⚡ | Document complet |

### **Affichage crédits** :

```tsx
<div className="flex items-center gap-2">
  <Zap className="w-4 h-4 text-yellow-400" />
  <span className="text-sm">
    {project.total_credits_used} ⚡ consommés
  </span>
</div>
```

### **Vérification avant action** :

```tsx
const handleLaunchAction = async (actionId, creditsNeeded) => {
  // 1. Vérifier crédits utilisateur
  if (userCredits < creditsNeeded) {
    showModal('Crédits insuffisants')
    return
  }
  
  // 2. Lancer action
  const result = await generateAction(actionId, context)
  
  // 3. Débiter crédits
  await deductCredits(userId, creditsNeeded)
  
  // 4. Mettre à jour projet
  await updateProject({
    total_credits_used: project.total_credits_used + creditsNeeded
  })
}
```

---

## 📊 BARRE DE PROGRESSION

### **Calcul dynamique** :

```typescript
const calculateProgress = (project) => {
  // Si pas de plan d'action → 0%
  if (!project.plan_action_steps) {
    return 0
  }
  
  const steps = project.plan_action_steps
  const completed = steps.filter(s => s.status === 'completed').length
  const total = steps.length
  
  return Math.round((completed / total) * 100)
}
```

### **Composant ProgressBar** :

```tsx
function ProgressBar({ progress, totalSteps, completedSteps }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">
          Progression globale
        </span>
        <span className="text-sm font-bold text-yellow-400">
          {completedSteps}/{totalSteps} étapes
        </span>
      </div>
      
      <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="text-center">
        <span className="text-2xl font-bold text-white">{progress}%</span>
      </div>
    </div>
  )
}
```

---

## 🎯 INCITATION PLAN D'ACTION

### **Si pas de plan d'action** :

```tsx
{!project.plan_action_steps && (
  <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-6 border-2 border-yellow-500/50">
    <div className="text-center">
      <div className="text-5xl mb-4">📋</div>
      <h3 className="text-xl font-bold text-white mb-2">
        Activez le suivi de progression !
      </h3>
      <p className="text-gray-300 mb-4">
        Générez un plan d'action en 10 étapes pour suivre l'avancement de votre projet
      </p>
      <button
        onClick={() => handleLaunchAction('action-plan')}
        className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all"
      >
        🚀 Générer le plan d'action (25 ⚡)
      </button>
    </div>
  </div>
)}
```

---

## 📄 PARSING DE DOCUMENTS

### **Lors de la ré-analyse** :

```typescript
const reAnalyzeWithContext = async (projectId) => {
  // 1. Récupérer tous les documents du projet
  const documents = await fetchProjectDocuments(projectId)
  
  // 2. Parser le contenu
  const parsedDocs = documents.map(doc => ({
    type: doc.document_type,
    content: doc.content,
    summary: extractSummary(doc.content) // Résumé intelligent
  }))
  
  // 3. Construire le contexte enrichi
  const enrichedContext = {
    initialAnalysis: project.proposition_description,
    cumulativeContext: project.cumulative_context,
    documents: parsedDocs,
    notes: projectNotes,
    budget: project.budget_selectionne,
    sector: project.secteur_selectionne
  }
  
  // 4. Prompt pour IA
  const prompt = `
    CONTEXTE PROJET:
    ${JSON.stringify(enrichedContext, null, 2)}
    
    TÂCHE:
    Ré-analysez cette opportunité business en tenant compte de tous les éléments
    de contexte, documents générés, et notes ajoutées depuis l'analyse initiale.
    
    Fournissez une analyse actualisée et des recommandations concrètes.
  `
  
  // 5. Appel IA
  const newAnalysis = await callAI(prompt)
  
  return newAnalysis
}
```

---

## 🗓️ TIMESTAMPS "CONTEXTE ACTUALISÉ"

### **Affichage** :

```tsx
{project.context_updated_at && (
  <div className="flex items-center gap-2 text-sm text-blue-400">
    <RefreshCw className="w-4 h-4" />
    <span>
      Contexte actualisé le {formatDate(project.context_updated_at)}
    </span>
  </div>
)}
```

### **Mise à jour automatique** :

```typescript
// Chaque fois qu'on ajoute du contexte
await updateProject({
  cumulative_context: [...existingContext, newElement],
  context_updated_at: new Date().toISOString()
})
```

---

## 📋 IMPLÉMENTATION PRIORISÉE

### **Phase 1 : Structure de base** ⏳
- [ ] Migration BDD (phases, progression, crédits)
- [ ] Modèle de calcul progression
- [ ] Composant ProgressBar
- [ ] Affichage crédits consommés

### **Phase 2 : Contexte cumulatif** ⏳
- [ ] Formulaire ajout élément contexte
- [ ] Stockage JSONB cumulative_context
- [ ] Affichage timeline contexte
- [ ] Timestamp "actualisé le"

### **Phase 3 : Ré-analyse IA** ⏳
- [ ] Bouton "Ré-analyser"
- [ ] Parsing documents
- [ ] Construction contexte enrichi
- [ ] Débit crédits

### **Phase 4 : Plan d'action interactif** ⏳
- [ ] Stockage plan_action_steps JSONB
- [ ] Liste étapes avec statuts
- [ ] Boutons "Marquer complété"
- [ ] Calcul progression auto

### **Phase 5 : Incitations** ⏳
- [ ] Message si pas de plan
- [ ] Badges progression
- [ ] Phases visuelles
- [ ] Gamification

---

## 🎯 RÉSULTAT ATTENDU

### **Vision globale** :

Un **véritable pense-bête à idée de business dopé à l'IA** où :

1. ✅ Chaque projet suit une **progression chronologique claire**
2. ✅ Le contexte **s'enrichit continuellement** 
3. ✅ L'IA peut **ré-analyser avec tout le contexte**
4. ✅ Les **crédits sont trackés** pour chaque action
5. ✅ Une **barre de progression visuelle** motive l'avancement
6. ✅ Le **plan d'action est central** au suivi
7. ✅ Les **timestamps** montrent l'actualité du contexte
8. ✅ L'utilisateur est **guidé étape par étape** de l'idée à la réussite

**"De l'étincelle à l'entreprise" - Powered by AI** 🚀

---

**Date création** : 2025-10-13  
**Prochaine étape** : Migration BDD + Composant ProgressBar
