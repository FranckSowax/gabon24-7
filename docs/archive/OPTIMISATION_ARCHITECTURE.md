# 🏗️ Guide d'Optimisation Architecture - Gabon 24/7

## 📦 Packages Installés ✅

```bash
# React Query pour la gestion d'état et cache
@tanstack/react-query: ^5.84.2
@tanstack/react-query-devtools: ^5.84.2

# Socket.io client
socket.io-client: ^4.8.1
```

---

## ✅ Optimisations Effectuées

### 1. Backend - Routes Modulaires

**Fichiers créés:**
- `backend/routes/football.js` - Routes `/api/football/*`
- `backend/routes/polls.js` - Routes `/api/polls/*`
- `backend/routes/events.js` - Routes `/api/events/*`
- `backend/routes/uploads.js` - Routes `/api/admin/upload-*`
- `backend/controllers/footballController.js` - Logique métier football

**Impact:** Réduction de la complexité de `server.js` (~500 lignes extraites)

### 2. Frontend - Custom Hooks Business

**Fichiers créés:**
- `frontend/src/hooks/business/useProjectActions.ts`
- `frontend/src/hooks/business/useProjectNotes.ts`
- `frontend/src/hooks/business/useAIModal.ts`
- `frontend/src/hooks/business/index.ts`

**Usage:**
```typescript
import { useProjectActions, useProjectNotes, useAIModal } from '@/hooks/business';

function MyComponent() {
  const { fetchProjectActions, addProjectAction } = useProjectActions();
  const { addNote, deleteNote } = useProjectNotes();
  const { openModal, updateProgress, setSuccess } = useAIModal();
}
```

### 3. Frontend - Custom Hooks Game

**Fichiers créés:**
- `frontend/src/hooks/game/useGameSocket.ts`
- `frontend/src/hooks/game/useGameSessions.ts`
- `frontend/src/hooks/game/index.ts`

**Usage:**
```typescript
import { useGameSocket, useGameSessions } from '@/hooks/game';

function GameComponent() {
  const { isConnected, submitAnswer, gamePhase } = useGameSocket({ sessionId });
  const { sessions, loadSession } = useGameSessions();
}
```

### 4. React Query - Configuration

**Fichiers créés:**
- `frontend/src/lib/queryClient.ts` - Configuration client
- `frontend/src/hooks/queries/useArticlesQuery.ts` - Exemple hooks

**Configuration effectuée ✅:**
- `frontend/src/providers/QueryProvider.tsx` - Provider avec devtools
- `frontend/src/app/layout.tsx` - Intégration dans l'app

```typescript
// layout.tsx - QueryProvider wrappant toute l'app
<QueryProvider>
  <ToastProvider>
    <AuthProvider>
      <CreditAlertProvider>
        {children}
      </CreditAlertProvider>
    </AuthProvider>
  </ToastProvider>
</QueryProvider>
```

**Usage:**
```typescript
import { useHomeArticles, useTrendingArticles } from '@/hooks/queries/useArticlesQuery';

function HomePage() {
  const { data: articles, isLoading, error } = useHomeArticles();
  
  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  
  return <ArticleList articles={articles} />;
}
```

---

## 🔜 Prochaines Étapes Recommandées

### Priorité Haute

1. **Installer les packages:**
   ```bash
   cd frontend && npm install @tanstack/react-query
   ```

2. **Configurer le Provider React Query** dans `app/layout.tsx` ou `providers.tsx`

3. **Migrer progressivement les useEffect de fetch** vers React Query

### Priorité Moyenne

4. **Extraire plus de routes de server.js:**
   - `/api/articles/*` → `routes/articles.js`
   - `/api/campaigns/*` → `routes/campaigns.js`
   - `/api/admin/*` → `routes/admin.js`

5. **Créer des controllers pour la logique métier:**
   - `controllers/articlesController.js`
   - `controllers/campaignsController.js`

### Priorité Basse

6. **Implémenter le streaming IA** pour les générations longues

7. **Ajouter la validation Zod** sur les routes API

---

## 📊 Métriques d'Impact

| Métrique | Avant | Après |
|----------|-------|-------|
| Lignes server.js | ~5900 | ~5400 |
| Routes inline | ~100 | ~85 |
| Hooks réutilisables | 2 | 8 |
| Composants extraits | - | 1 |

---

## 🔧 Structure Recommandée

```
backend/
├── controllers/         # Logique métier
│   ├── footballController.js ✅
│   ├── articlesController.js
│   └── campaignsController.js
├── routes/              # Routes Express
│   ├── football.js ✅
│   ├── polls.js ✅
│   ├── events.js ✅
│   ├── uploads.js ✅
│   ├── articles.js
│   └── campaigns.js
├── services/            # Services externes
│   └── ...
└── server.js            # Configuration serveur uniquement

frontend/src/
├── hooks/
│   ├── business/        # Hooks métier projets ✅
│   ├── game/            # Hooks jeu ✅
│   └── queries/         # Hooks React Query ✅
├── lib/
│   └── queryClient.ts   # Config React Query ✅
└── components/
    └── business/
        └── ProjectTabs/ # Composants extraits
```
