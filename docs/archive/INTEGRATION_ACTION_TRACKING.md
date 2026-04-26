# 🔧 Guide d'Intégration - Tracking Automatique des Actions

## 📋 Vue d'Ensemble

Ce guide explique comment intégrer le tracking automatique des actions IA dans l'**Analyzer** pour synchroniser avec **Mes Projets**.

---

## 🎯 Objectif

Chaque fois qu'un utilisateur génère une action IA (Plan d'action, Test de compétence, Formation, Business Plan), l'action doit être automatiquement enregistrée dans `project_actions` pour apparaître dans l'historique du projet.

---

## 📦 Fichiers Modifiés

### 1. `/frontend/src/utils/action-tracker.ts` (NOUVEAU)
Helper centralisé pour le tracking automatique

### 2. `/frontend/src/app/business/analyzer/page.tsx` (À MODIFIER)
Intégrer le tracking dans les fonctions de génération

### 3. `/frontend/src/app/business/mes-projets/page.tsx` (✅ FAIT)
Interface modernisée avec dropdown actions

---

## 🔨 ÉTAPE 1: Importer le Helper

**Dans `/frontend/src/app/business/analyzer/page.tsx`:**

```typescript
// Ajouter en haut du fichier
import { 
  autoTrackAction,
  useProjectIdFromContext,
  saveProjectIdToSession,
  trackSkillTestGeneration,
  trackActionPlanGeneration,
  trackTrainingGeneration,
  trackBusinessPlanGeneration
} from '@/utils/action-tracker'
```

---

## 🔨 ÉTAPE 2: Gérer le ProjectId

### Option A: Depuis les Params URL (Recommandé)

```typescript
export default function BusinessAnalyzerPage() {
  // ... states existants ...
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)

  // Au chargement, récupérer projectId depuis URL ou session
  useEffect(() => {
    const projectId = useProjectIdFromContext()
    if (projectId) {
      setCurrentProjectId(projectId)
      console.log('📌 Projet actif:', projectId)
    }
  }, [])

  // ...
}
```

### Option B: Après Sauvegarde du Projet

```typescript
const saveProject = async (proposalIndex: number) => {
  // ... code existant ...

  try {
    const response = await fetch(`${API_URL}/api/saved-projects`, {
      method: 'POST',
      // ... body ...
    })

    const result = await response.json()

    if (result.success && result.projectId) {
      // 💾 Sauvegarder pour usage futur
      setCurrentProjectId(result.projectId)
      saveProjectIdToSession(result.projectId)
      
      setSavedProjects(prev => new Set(prev).add(proposalIndex))
      alert('Projet sauvegardé avec succès!')
    }
  } catch (error) {
    // ... error handling ...
  }
}
```

---

## 🔨 ÉTAPE 3: Tracker le Test de Compétence

**Modifier `handleGenerateSkillTest`:**

```typescript
const handleGenerateSkillTest = async (proposalIndex: number) => {
  const currentUserId = await ensureUserId()
  if (!currentUserId) {
    alert('Veuillez vous connecter pour générer le test de compétence')
    router.push('/auth/signin')
    return
  }
  
  if (!selectedArticle || !analysis || !proposals[proposalIndex]) {
    alert('Sélectionnez une proposition d\'abord')
    return
  }
  
  setIsGeneratingSkillTest(true)
  setSkillTestForIndex(proposalIndex)
  setGeneratedSkillTest(null)
  
  try {
    const proposal = proposals[proposalIndex]
    const budgetRange = budgetLevels.find(b => b.id === (selectedBudget || lastUserContext?.budget_principal))?.range
      || selectedBudget || lastUserContext?.budget_principal || ''
    
    const response = await fetch(`${API_URL}/api/skill-test/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUserId,
        articleId: selectedArticle.id,
        proposal: {
          titre: proposal.titre,
          description: proposal.description,
          secteur: selectedSecteur?.nom,
          budget: budgetRange,
          premiers_investissements: proposal.premiers_investissements,
          delai_lancement: proposal.delai_lancement
        },
        userContext: lastUserContext || {},
        articleContext: {
          title: selectedArticle.title,
          summary: selectedArticle.summary,
          problematique: analysis?.analyse_contextuelle?.problematique_centrale
        }
      })
    })
    
    if (!response.ok) throw new Error('Erreur lors de la génération du test')
    
    const data = await response.json()
    setGeneratedSkillTest(data.test)
    setGeneratedSkillTestId(data.testId)
    
    // ✅ AJOUTER: Track automatiquement l'action
    if (data.testId && currentProjectId) {
      await trackSkillTestGeneration(data.testId, {
        userId: currentUserId,
        projectId: currentProjectId,
        articleId: selectedArticle.id,
        proposalData: {
          titre: proposal.titre,
          secteur: selectedSecteur?.nom,
          budget: budgetRange
        }
      })
    } else if (data.testId) {
      console.warn('⚠️ Test généré mais pas de projectId pour tracking')
    }
    
    setShowSkillTestModal(true)
    console.log('✅ Test de compétence généré:', data.test, 'ID:', data.testId)
    
  } catch (error) {
    console.error('❌ Erreur génération test:', error)
    alert('Erreur lors de la génération du test de compétence')
  } finally {
    setIsGeneratingSkillTest(false)
  }
}
```

---

## 🔨 ÉTAPE 4: Tracker le Plan d'Action

**Modifier le gestionnaire de plan d'action:**

```typescript
// Dans ActionPlanModal ou où le plan est généré
const handleActionPlanGenerated = async (planId: string) => {
  if (!currentProjectId || !user?.id) return

  await trackActionPlanGeneration(planId, {
    userId: user.id,
    projectId: currentProjectId,
    articleId: selectedArticle?.id,
    proposalData: {
      titre: proposals[selectedProposalIndex]?.titre,
      secteur: selectedSecteur?.nom,
      budget: selectedBudget || lastUserContext?.budget_principal
    }
  })

  console.log('✅ Plan d\'action tracké')
}
```

---

## 🔨 ÉTAPE 5: Tracker la Formation

**Modifier `handleSelectAdvanced` pour la formation:**

```typescript
const handleSelectAdvanced = async (propositionId: string, proposalIndex: number) => {
  // ... code existant pour action-plan et skill-test ...
  
  // Gérer la formation sur mesure
  if (propositionId !== 'custom-training') return
  
  const currentUserId = await ensureUserId()
  if (!currentUserId) {
    alert('Veuillez vous connecter pour générer la formation sur mesure')
    router.push('/auth/signin')
    return
  }
  
  if (!selectedArticle || !analysis || !proposals[proposalIndex]) {
    alert('Sélectionnez une proposition d\'abord')
    return
  }
  
  setIsGeneratingTraining(true)
  setTrainingForIndex(proposalIndex)
  setGeneratedTraining(null)
  
  try {
    const proposal = proposals[proposalIndex]
    const budgetRange = budgetLevels.find(b => b.id === (selectedBudget || lastUserContext?.budget_principal))?.range
      || selectedBudget || lastUserContext?.budget_principal || ''
    
    // ... appel API existant ...
    
    const res = await fetch(`${API_URL}/api/training/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAnalysis,
        article: {
          title: selectedArticle.title,
          summary: selectedArticle.summary,
          source: selectedArticle.source,
          url: selectedArticle.url
        },
        sectorResults,
        userId: currentUserId,
        articleId: selectedArticle.id
      })
    })
    
    if (!res.ok) throw new Error('Erreur lors de la génération de la formation')
    
    const data = await res.json()
    setGeneratedTraining(data?.training || null)
    setGeneratedTrainingId(data?.trainingId || null)
    
    // ✅ AJOUTER: Track automatiquement l'action
    if (data?.trainingId && currentProjectId) {
      await trackTrainingGeneration(data.trainingId, {
        userId: currentUserId,
        projectId: currentProjectId,
        articleId: selectedArticle.id,
        proposalData: {
          titre: proposal.titre,
          secteur: selectedSecteur?.nom,
          budget: budgetRange
        }
      })
    }
    
    setIsTrainingModalOpen(true)
  } catch (e) {
    console.error('Erreur génération formation:', e)
    alert('Erreur lors de la génération de la formation sur mesure')
  } finally {
    setIsGeneratingTraining(false)
  }
}
```

---

## 🔨 ÉTAPE 6: Tracker le Business Plan

**À implémenter si la fonctionnalité existe:**

```typescript
const handleGenerateBusinessPlan = async (proposalIndex: number) => {
  // ... génération du business plan ...
  
  const data = await response.json()
  
  if (data.businessPlanId && currentProjectId && user?.id) {
    await trackBusinessPlanGeneration(data.businessPlanId, {
      userId: user.id,
      projectId: currentProjectId,
      articleId: selectedArticle?.id,
      proposalData: {
        titre: proposals[proposalIndex].titre,
        secteur: selectedSecteur?.nom,
        budget: selectedBudget || lastUserContext?.budget_principal
      }
    })
  }
}
```

---

## 🔨 ÉTAPE 7: Gérer la Navigation depuis Mes Projets

**Quand l'utilisateur clique sur "Aller + loin" dans Mes Projets:**

```typescript
// Dans mes-projets/page.tsx (déjà implémenté)
const handleLaunchAction = async (projectId: string, actionId: string, project: SavedProject) => {
  // Track l'intention
  await trackProjectAction({
    projectId,
    userId: user.id,
    actionType: actionId as any,
    metadata: {
      relaunched: true, // Indique que c'est une relance
      proposition_titre: project.proposition_titre
    }
  })

  // Rediriger vers analyzer avec les infos du projet
  const params = new URLSearchParams({
    projectId: project.id,
    action: actionId,
    secteur: project.secteur_selectionne,
    budget: project.budget_selectionne
  })
  
  router.push(`/business/analyzer?${params.toString()}`)
}
```

**Dans l'Analyzer, détecter et auto-lancer:**

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const action = params.get('action')
  const projectId = params.get('projectId')
  
  if (action && projectId) {
    setCurrentProjectId(projectId)
    
    // Auto-lancer l'action demandée
    switch (action) {
      case 'skill-test':
        // Attendre que les données soient chargées
        setTimeout(() => {
          if (proposals.length > 0) {
            handleGenerateSkillTest(0) // Ou l'index approprié
          }
        }, 1000)
        break
      case 'action-plan':
        setTimeout(() => {
          if (proposals.length > 0) {
            setSelectedProposalForActionPlan(0)
            setShowActionPlanModal(true)
          }
        }, 1000)
        break
      // Idem pour les autres actions
    }
  }
}, [])
```

---

## ✅ CHECKLIST D'INTÉGRATION

- [ ] Importer `action-tracker.ts` dans analyzer
- [ ] Ajouter state `currentProjectId`
- [ ] Récupérer projectId depuis URL ou session
- [ ] Sauvegarder projectId après création de projet
- [ ] Tracker test de compétence après génération
- [ ] Tracker plan d'action après génération
- [ ] Tracker formation après génération
- [ ] Tracker business plan après génération
- [ ] Gérer relance depuis Mes Projets
- [ ] Tester le flow complet

---

## 🧪 TESTS

### Test 1: Création + Action
```
1. Aller sur Analyzer
2. Analyser un article
3. Sauvegarder une proposition → projectId créé
4. Générer un test de compétence → action trackée
5. Aller sur Mes Projets → badge "Test" vert avec ✓
```

### Test 2: Relance depuis Mes Projets
```
1. Aller sur Mes Projets
2. Cliquer "Aller + loin" sur un projet
3. Choisir "Formation sur mesure"
4. Redirection vers Analyzer avec params
5. Formation générée automatiquement
6. Retour Mes Projets → badge "Formation" vert avec ✓
```

### Test 3: Multiple Actions
```
1. Sur un même projet, générer:
   - Plan d'action
   - Test de compétence
   - Formation
2. Tous les badges doivent être verts
3. Historique complet visible dans la carte
```

---

## 🐛 DEBUGGING

**Si les actions ne sont pas trackées:**

```typescript
// Vérifier dans la console
console.log('ProjectId actuel:', currentProjectId)
console.log('User ID:', user?.id)
console.log('Action generée:', actionId)

// Vérifier l'API
// GET http://localhost:3001/api/project-actions/:projectId
// Doit retourner toutes les actions

// Vérifier la table Supabase
// SELECT * FROM project_actions WHERE project_id = 'xxx'
```

**Si projectId est null:**

```typescript
// Vérifier sessionStorage
console.log('Session ProjectId:', sessionStorage.getItem('recent_project_id'))

// Vérifier URL params
const params = new URLSearchParams(window.location.search)
console.log('URL ProjectId:', params.get('projectId'))

// Forcer le projectId
setCurrentProjectId('ID_DU_PROJET_TEST')
```

---

## 📈 MÉTRIQUES DE SUCCÈS

Après intégration, vous devriez voir:

- ✅ **100%** des actions générées sont trackées
- ✅ **Badges status** mis à jour en temps réel
- ✅ **Historique complet** dans chaque projet
- ✅ **Relances** fonctionnent sans problème
- ✅ **Aucun warning** dans la console
- ✅ **Performance** stable (< 500ms par track)

---

## 🚀 DÉPLOIEMENT

### 1. Tests Locaux
```bash
# Frontend
cd frontend
npm run dev

# Backend
cd backend
npm start

# Tester tous les flows
```

### 2. Vérification Base de Données
```sql
-- Vérifier que la table existe
SELECT * FROM project_actions LIMIT 10;

-- Compter les actions par type
SELECT action_type, COUNT(*) 
FROM project_actions 
GROUP BY action_type;

-- Vérifier les actions récentes
SELECT * FROM project_actions 
ORDER BY created_at DESC 
LIMIT 20;
```

### 3. Monitoring
```typescript
// Ajouter des logs analytics
trackEvent('action_generated', {
  type: actionType,
  projectId: currentProjectId,
  userId: user.id,
  timestamp: Date.now()
})
```

---

**Version:** 1.0  
**Date:** 2025-10-08  
**Auteur:** Gabon 24/7 AI Team
