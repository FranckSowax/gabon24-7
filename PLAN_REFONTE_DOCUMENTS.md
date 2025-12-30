# 📋 PLAN REFONTE SYSTÈME DOCUMENTS PROJETS

## 🎯 OBJECTIFS

1. ✅ **Enregistrer les plans d'action** dans la BDD
2. ✅ **Section "Vos Documents"** remplace "Historique des actions IA"
3. ✅ **Afficher le plan d'action** au clic
4. ✅ **Actions grisées/bleues** quand effectuées
5. ✅ **Bouton "Ajouter contexte et refaire"** au lieu de crédits
6. ✅ **Régénération avec contexte** additionnel

---

## ✅ ÉTAPE 1 : STRUCTURE BDD (FAIT)

### **Table créée : `project_documents`**

```sql
CREATE TABLE project_documents (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES saved_projects,
    user_id UUID,
    document_type TEXT, -- 'action-plan', 'skill-test', etc.
    title TEXT,
    content TEXT, -- Le contenu généré
    prompt_used TEXT, -- Prompt utilisé
    context_added TEXT, -- Contexte additionnel
    metadata JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### **Colonne ajoutée : `project_actions.document_id`**

Pour lier une action à son document généré.

---

## 📋 ÉTAPE 2 : BACKEND API (EN COURS)

### **Routes créées** : `/backend/src/routes/project-documents.js`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/project-documents` | Créer un document |
| GET | `/api/project-documents/project/:projectId` | Tous les documents d'un projet |
| GET | `/api/project-documents/:documentId` | Un document spécifique |
| PUT | `/api/project-documents/:documentId` | Mettre à jour (ajouter contexte) |
| DELETE | `/api/project-documents/:documentId` | Supprimer |

### **À faire dans server.js** :

```javascript
// backend/server.js
const projectDocumentsRoutes = require('./src/routes/project-documents');
app.use('/api/project-documents', projectDocumentsRoutes);
```

---

## 🎨 ÉTAPE 3 : FRONTEND - NOUVELLE INTERFACE

### **3.1. Section "Vos Documents"**

Remplacer :
```tsx
// Historique des actions IA ❌
```

Par :
```tsx
// Vos Documents ✅
<div className="bg-white/5 rounded-xl p-6">
  <h3 className="text-xl font-bold text-white mb-4">
    📄 Vos Documents
  </h3>
  
  <div className="space-y-3">
    {documents.map(doc => (
      <DocumentCard
        key={doc.id}
        document={doc}
        onClick={() => setSelectedDocument(doc)}
      />
    ))}
  </div>
</div>
```

### **3.2. DocumentCard Component**

```tsx
interface Document {
  id: string
  document_type: string
  title: string
  content: string
  created_at: string
  context_added?: string
}

function DocumentCard({ document, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="p-4 bg-white/10 rounded-lg hover:bg-white/15 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-500 rounded-lg">
          📄
        </div>
        <div className="flex-1">
          <h4 className="text-white font-semibold">{document.title}</h4>
          <p className="text-gray-400 text-sm">
            {formatDate(document.created_at)}
          </p>
        </div>
        <ChevronRight className="text-gray-400" />
      </div>
    </div>
  )
}
```

### **3.3. Modal d'affichage du document**

```tsx
function DocumentModal({ document, onClose, onAddContext }) {
  const [showContextForm, setShowContextForm] = useState(false)
  const [context, setContext] = useState('')
  
  return (
    <Modal>
      <div className="max-w-4xl">
        <h2>{document.title}</h2>
        
        {/* Contenu du document */}
        <div className="prose">
          {document.content}
        </div>
        
        {/* Bouton Ajouter contexte */}
        {!showContextForm ? (
          <button onClick={() => setShowContextForm(true)}>
            🔄 Ajouter un contexte et refaire
          </button>
        ) : (
          <div>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ajoutez du contexte pour améliorer..."
            />
            <button onClick={() => onAddContext(context)}>
              Régénérer
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
```

---

## 🔧 ÉTAPE 4 : ACTIONS STATUS (GRISÉ/BLEU)

### **4.1. Modifier le style des actions effectuées**

```tsx
// Dans la carte projet
{advancedActions.map(action => {
  const status = getActionStatus(project.id, action.id)
  const ActionIcon = action.icon
  
  return (
    <div
      key={action.id}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
        status === 'done' 
          ? 'bg-blue-500/30 border-2 border-blue-500' // Bleu quand fait
          : 'bg-white/5 opacity-50' // Grisé par défaut
      }`}
    >
      <ActionIcon className="w-4 h-4" />
      <span>{action.title}</span>
      {status === 'done' && <span>✓</span>}
    </div>
  )
})}
```

### **4.2. Bouton au lieu de crédits**

```tsx
// Au lieu de :
<span>{action.credits} ⚡</span>

// Afficher :
{status === 'done' ? (
  <button
    onClick={() => handleAddContext(action)}
    className="text-xs bg-blue-500 px-2 py-1 rounded"
  >
    + Contexte
  </button>
) : (
  <button
    onClick={() => handleLaunchAction(action)}
    className="text-xs bg-green-500 px-2 py-1 rounded"
  >
    Lancer
  </button>
)}
```

---

## 🔄 ÉTAPE 5 : FLUX RÉGÉNÉRATION AVEC CONTEXTE

### **5.1. Fonction handleAddContext**

```tsx
const handleAddContext = async (documentId: string, newContext: string) => {
  // 1. Récupérer le document original
  const response = await fetch(`${API_URL}/api/project-documents/${documentId}`)
  const { document } = await response.json()
  
  // 2. Construire le nouveau prompt avec contexte additionnel
  const enhancedPrompt = `
    ${document.prompt_used}
    
    CONTEXTE ADDITIONNEL:
    ${newContext}
    
    Veuillez régénérer en tenant compte de ce contexte.
  `
  
  // 3. Appeler l'IA pour régénérer
  const aiResponse = await generateWithAI(enhancedPrompt, project)
  
  // 4. Mettre à jour le document
  await fetch(`${API_URL}/api/project-documents/${documentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      content: aiResponse.content,
      contextAdded: newContext,
      promptUsed: enhancedPrompt
    })
  })
  
  // 5. Recharger les documents
  await fetchDocuments()
}
```

### **5.2. Sauvegarder lors de la génération initiale**

```tsx
// Modifier handleLaunchAction pour sauvegarder
const handleLaunchAction = async (projectId, actionId, project) => {
  // 1. Générer le contenu (plan d'action, etc.)
  const aiResponse = await generateAction(actionId, project)
  
  // 2. Sauvegarder dans project_documents
  const docResponse = await fetch(`${API_URL}/api/project-documents`, {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      userId: user.id,
      documentType: actionId,
      title: getActionTitle(actionId, project),
      content: aiResponse.content,
      promptUsed: aiResponse.prompt,
      metadata: {
        secteur: project.secteur_selectionne,
        budget: project.budget_selectionne
      }
    })
  })
  
  const { document } = await docResponse.json()
  
  // 3. Créer/mettre à jour project_action avec document_id
  await trackProjectAction({
    projectId,
    userId: user.id,
    actionType: actionId,
    actionStatus: 'completed',
    actionReferenceId: document.id // Lien vers le document
  })
}
```

---

## 📝 ÉTAPE 6 : INTERFACES TYPESCRIPT

```typescript
// types/project-documents.ts

export interface ProjectDocument {
  id: string
  project_id: string
  user_id: string
  document_type: 'action-plan' | 'skill-test' | 'custom-training' | 'business-plan'
  title: string
  content: string
  prompt_used?: string
  context_added?: string
  metadata?: {
    secteur?: string
    budget?: string
    [key: string]: any
  }
  created_at: string
  updated_at: string
}

export interface DocumentCardProps {
  document: ProjectDocument
  onClick: () => void
}

export interface DocumentModalProps {
  document: ProjectDocument
  onClose: () => void
  onAddContext: (context: string) => Promise<void>
}
```

---

## 🎨 ÉTAPE 7 : UI/UX AMÉLIORATIONS

### **Icons par type de document**

```tsx
const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'action-plan':
      return '📋'
    case 'skill-test':
      return '🎯'
    case 'custom-training':
      return '🎓'
    case 'business-plan':
      return '📊'
    default:
      return '📄'
  }
}
```

### **Couleurs par type**

```tsx
const getDocumentColor = (type: string) => {
  switch (type) {
    case 'action-plan':
      return 'from-blue-500 to-cyan-600'
    case 'skill-test':
      return 'from-purple-500 to-violet-600'
    case 'custom-training':
      return 'from-orange-500 to-red-600'
    case 'business-plan':
      return 'from-green-500 to-emerald-600'
    default:
      return 'from-gray-500 to-gray-600'
  }
}
```

---

## ✅ CHECKLIST IMPLÉMENTATION

### **Backend** :
- [x] Table `project_documents` créée
- [x] Colonne `project_actions.document_id` ajoutée
- [x] Routes API créées (`project-documents.js`)
- [ ] Routes ajoutées dans `server.js`
- [ ] Tests API endpoints

### **Frontend** :
- [ ] Section "Vos Documents" créée
- [ ] Component `DocumentCard` créé
- [ ] Component `DocumentModal` créé
- [ ] Fonction `fetchDocuments()` ajoutée
- [ ] Fonction `handleAddContext()` implémentée
- [ ] Modifier `handleLaunchAction()` pour sauvegarder
- [ ] Styles actions (grisé/bleu) appliqués
- [ ] Bouton "+ Contexte" au lieu de crédits
- [ ] Interfaces TypeScript créées

### **Intégration** :
- [ ] Tester création document
- [ ] Tester affichage documents
- [ ] Tester ajout contexte et régénération
- [ ] Tester états visuels des actions
- [ ] Vérifier responsive mobile
- [ ] Documentation utilisateur

---

## 🚀 ORDRE D'IMPLÉMENTATION

1. ✅ **BDD** (FAIT)
2. ✅ **Routes API** (FAIT)
3. **Server.js** - Ajouter les routes
4. **Frontend Base** - Section "Vos Documents"
5. **DocumentCard** - Composant carte
6. **DocumentModal** - Modal d'affichage
7. **Sauvegarde** - Modifier handleLaunchAction
8. **Régénération** - handleAddContext
9. **Styles** - Actions grisées/bleues
10. **Tests** - Validation complète

---

## 💡 NOTES IMPORTANTES

### **Contexte additionnel**

Le contexte ajouté doit être **cumulatif** :
```tsx
const allContext = [
  document.context_added, // Contexte précédent
  newContext // Nouveau contexte
].filter(Boolean).join('\n\n')
```

### **Historique des versions**

Optionnel : garder un historique des versions :
```sql
ALTER TABLE project_documents 
ADD COLUMN version INTEGER DEFAULT 1,
ADD COLUMN previous_version_id UUID REFERENCES project_documents(id);
```

### **Performance**

Limiter le chargement :
- Charger documents au clic sur projet
- Lazy load du contenu complet
- Cache côté client

---

## 🎯 RÉSULTAT ATTENDU

### **Avant** ❌

```
Historique des actions IA:
- Plan d'action [25 ⚡] → Lance action
- Test [30 ⚡] → Lance action
```

### **Après** ✅

```
Vos Documents:
📋 Plan d'action - Secteur Agriculture
   12 oct 2025
   [🔄 + Contexte]

📊 Business Plan - Export Mangues
   11 oct 2025
   [🔄 + Contexte]
```

**Actions sur la carte** :
- ✅ Action faite → **Bleu** avec bouton "+ Contexte"
- ⭕ Action non faite → **Grisé** avec bouton "Lancer"

---

## 📚 FICHIERS MODIFIÉS

| Fichier | Type | Description |
|---------|------|-------------|
| `backend/src/routes/project-documents.js` | ✅ Créé | Routes API documents |
| `backend/server.js` | ⏳ À modifier | Ajouter routes |
| `frontend/src/app/business/mes-projets/page.tsx` | ⏳ À modifier | Section documents |
| `frontend/src/types/project-documents.ts` | ⏳ À créer | Interfaces TS |
| `supabase/migrations/*` | ✅ Fait | Tables BDD |

---

**Date**: 2025-10-13
**Statut**: Structure BDD + Routes API créées
**Prochaine étape**: Intégration routes dans server.js + Frontend
