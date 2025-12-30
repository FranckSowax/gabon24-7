# Boutons de Gestion de Projet dans la Sidebar

## ✅ Fonctionnalités Ajoutées

Ajout de deux boutons d'action dans la barre latérale des détails du projet (`ProjectSidebar`) :

1. **🔄 Relancer l'analyse** - Réinitialise le projet et relance l'analyse
2. **🗑️ Supprimer le projet** - Supprime définitivement le projet

---

## 📍 Emplacement

**Position:** En dessous de la section "Progression" dans la barre latérale

**Fichiers modifiés:**
- `frontend/src/components/business/ProjectSidebar.tsx`
- `frontend/src/app/business/mes-projets/page.tsx`

---

## 🎨 Design des Boutons

### Bouton Relancer l'analyse

**Style:**
- Gradient: `from-blue-500 to-cyan-500`
- Hover: `from-blue-600 to-cyan-600`
- Icône: `RefreshCw` (rotation pendant le chargement)
- Texte: "Relancer l'analyse" / "Relance en cours..."

**États:**
- Normal: Bouton bleu avec icône statique
- Loading: Icône en rotation (`animate-spin`)
- Disabled: Opacité 50%, curseur non autorisé

### Bouton Supprimer le projet

**Style:**
- Gradient: `from-red-500 to-rose-500`
- Hover: `from-red-600 to-rose-600`
- Icône: `Trash2` (pulse pendant le chargement)
- Texte: "Supprimer le projet" / "Suppression..."

**États:**
- Normal: Bouton rouge avec icône statique
- Loading: Icône en pulse (`animate-pulse`)
- Disabled: Opacité 50%, curseur non autorisé

---

## 🔧 Fonctionnalités Techniques

### 1. Relancer l'analyse

**Fonction:** `restartAnalysis(projectId: string)`

**Workflow:**
```
1. Confirmation utilisateur (popup)
   ↓
2. État isRestarting = true
   ↓
3. Appel API: POST /api/projects/{projectId}/reset
   ↓
4. Suppression des données locales:
   - projectActions[projectId] = []
   - projectDocuments[projectId] = []
   - projectTimeline[projectId] = []
   ↓
5. Fermeture du projet (setSelectedProject(null))
   ↓
6. Redirection vers /business/analyzer?projectId={id}
   ↓
7. État isRestarting = false
```

**Confirmation:**
```
⚠️ Relancer l'analyse va supprimer tous les documents 
et actions IA générés. Voulez-vous continuer ?
```

**Endpoint Backend:**
- **URL:** `POST /api/projects/{projectId}/reset?userId={userId}`
- **Action:** Supprime tous les documents et actions IA du projet
- **Retour:** `{ success: boolean, error?: string }`

### 2. Supprimer le projet

**Fonction:** `deleteProject(projectId: string)`

**Workflow:**
```
1. Confirmation utilisateur (popup)
   ↓
2. État isDeleting = true
   ↓
3. Appel API: DELETE /api/saved-projects/{projectId}
   ↓
4. Suppression du projet de la liste locale
   ↓
5. Nettoyage des données associées:
   - projectActions
   - projectNotes
   - projectDocuments
   - projectTimeline
   ↓
6. Fermeture du projet (setSelectedProject(null))
   ↓
7. Alert: ✅ Projet supprimé avec succès
   ↓
8. État isDeleting = false
```

**Confirmation:**
```
🗑️ Êtes-vous sûr de vouloir supprimer définitivement 
ce projet ? Cette action est irréversible.
```

**Endpoint Backend:**
- **URL:** `DELETE /api/saved-projects/{projectId}?userId={userId}`
- **Action:** Supprime le projet et toutes ses données associées
- **Retour:** `{ success: boolean, error?: string }`

---

## 📊 Props du ProjectSidebar

### Nouvelles Props Ajoutées

```typescript
interface ProjectSidebarProps {
  // ... props existantes
  onDeleteProject?: () => void
  onRestartAnalysis?: () => void
  isDeleting?: boolean
  isRestarting?: boolean
}
```

### Utilisation

```tsx
<ProjectSidebar
  sections={PROJECT_SECTIONS}
  activeSection={activeSection}
  onSectionChange={(section) => setActiveSection(section)}
  onBack={() => setSelectedProject(null)}
  projectTitle={selectedProject.proposition_titre}
  completionStats={{
    actions: completedActions,
    documents: documentsCount,
    notes: notesCount
  }}
  onDeleteProject={() => deleteProject(selectedProject.id)}
  onRestartAnalysis={() => restartAnalysis(selectedProject.id)}
  isDeleting={isDeleting}
  isRestarting={isRestarting}
/>
```

---

## 🎯 États de Chargement

### États Ajoutés dans page.tsx

```typescript
const [isDeleting, setIsDeleting] = useState(false)
const [isRestarting, setIsRestarting] = useState(false)
```

**Utilisation:**
- `isDeleting`: Activé pendant la suppression du projet
- `isRestarting`: Activé pendant la relance de l'analyse

**Effet:**
- Désactive les boutons pendant l'opération
- Change le texte du bouton
- Anime l'icône (spin/pulse)

---

## 🔒 Sécurité

### Confirmations Utilisateur

**Les deux actions nécessitent une confirmation explicite:**
- Popup `confirm()` natif du navigateur
- Message clair sur les conséquences
- Possibilité d'annuler

### Validation Backend

**Chaque endpoint vérifie:**
- `userId` fourni dans la query string
- Existence du projet
- Permissions de l'utilisateur

---

## 🎨 UI/UX

### Section "Actions"

```tsx
<div className="space-y-3">
  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
    Actions
  </div>

  {/* Bouton Relancer l'analyse */}
  {onRestartAnalysis && (
    <motion.button
      onClick={onRestartAnalysis}
      disabled={isRestarting}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-4 h-4 ${isRestarting ? 'animate-spin' : ''}`} />
      <span>{isRestarting ? 'Relance en cours...' : 'Relancer l\'analyse'}</span>
    </motion.button>
  )}

  {/* Bouton Supprimer le projet */}
  {onDeleteProject && (
    <motion.button
      onClick={onDeleteProject}
      disabled={isDeleting}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
      <span>{isDeleting ? 'Suppression...' : 'Supprimer le projet'}</span>
    </motion.button>
  )}
</div>
```

### Animations Framer Motion

**Hover:**
- `whileHover={{ scale: 1.02 }}` - Légère augmentation de taille

**Tap:**
- `whileTap={{ scale: 0.98 }}` - Légère réduction au clic

**Loading:**
- `animate-spin` (RefreshCw) - Rotation continue
- `animate-pulse` (Trash2) - Pulsation

---

## 📱 Responsive

**Les boutons s'affichent correctement sur:**
- Desktop (sidebar fixe)
- Tablet (sidebar responsive)
- Mobile (sidebar en drawer)

**Largeur:** `w-full` (100% de la sidebar)

---

## 🧪 Tests Recommandés

### Test 1: Relancer l'analyse

```
1. Ouvrir un projet
2. Cliquer "Relancer l'analyse"
3. Confirmer dans la popup
4. Vérifier:
   ✓ Bouton passe en "Relance en cours..."
   ✓ Icône tourne
   ✓ Bouton désactivé
   ✓ Redirection vers /business/analyzer
   ✓ Documents et actions supprimés
```

### Test 2: Supprimer le projet

```
1. Ouvrir un projet
2. Cliquer "Supprimer le projet"
3. Confirmer dans la popup
4. Vérifier:
   ✓ Bouton passe en "Suppression..."
   ✓ Icône pulse
   ✓ Bouton désactivé
   ✓ Projet retiré de la liste
   ✓ Retour à la liste des projets
   ✓ Alert de confirmation
```

### Test 3: Annulation

```
1. Ouvrir un projet
2. Cliquer sur un bouton
3. Annuler dans la popup
4. Vérifier:
   ✓ Aucune action effectuée
   ✓ Projet toujours présent
   ✓ Données intactes
```

### Test 4: Gestion d'erreurs

```
1. Simuler une erreur réseau
2. Tenter une action
3. Vérifier:
   ✓ Alert d'erreur affichée
   ✓ État de chargement réinitialisé
   ✓ Bouton réactivé
   ✓ Projet toujours présent
```

---

## 🔍 Debugging

### Logs Console

**Relancer l'analyse:**
```javascript
console.log('🔄 Relance analyse projet:', projectId)
// En cas d'erreur:
console.error('Error restarting analysis:', error)
```

**Supprimer le projet:**
```javascript
console.log('🗑️ Suppression projet:', projectId)
// En cas d'erreur:
console.error('Error deleting project:', error)
```

### Vérifications Backend

**Endpoint reset:**
```bash
POST /api/projects/{projectId}/reset?userId={userId}
```

**Endpoint delete:**
```bash
DELETE /api/saved-projects/{projectId}?userId={userId}
```

---

## 💡 Améliorations Futures

### Possibles Évolutions

1. **Toast Notifications** au lieu de `alert()`
2. **Modal de confirmation** plus élégant
3. **Animation de suppression** (fade out)
4. **Undo/Redo** pour la suppression
5. **Archive** au lieu de suppression définitive
6. **Statistiques** avant suppression (nb docs, actions, etc.)
7. **Export** des données avant suppression

---

## 📋 Checklist Déploiement

- [x] Composant ProjectSidebar modifié
- [x] Props ajoutées et typées
- [x] Fonctions de suppression et relance implémentées
- [x] États de chargement ajoutés
- [x] Confirmations utilisateur en place
- [x] Animations et styles appliqués
- [x] Props connectées dans page.tsx
- [x] Tests manuels effectués
- [x] Commit et push sur GitHub
- [ ] **Test en production**

---

**Dernière mise à jour:** 27 octobre 2025, 11:15 AM  
**Status:** 🟢 **Déployé - Prêt pour Test**  
**Commit:** `990c641`
