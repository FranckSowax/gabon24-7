# 🧪 TEST DU CHAT IA - GUIDE RAPIDE

## ✅ PRÉREQUIS (DÉJÀ FAIT)

- [x] `npm install replicate` ✅
- [x] Token dans `.env` ✅
- [x] Module testé ✅

## 🚀 DÉMARRAGE BACKEND

### Option 1 : Mode développement (recommandé)

```bash
cd backend
npm run dev
```

Le serveur devrait afficher :
```
✓ Backend démarré sur http://localhost:3001
✓ Routes /api/project-chat activées
✓ Replicate configuré
```

### Option 2 : Mode production

```bash
cd backend
npm start
# ou
pm2 restart backend
```

---

## 🧪 TEST 1 : API Directe

### Test simple (sans IA - test infrastructure)

```bash
curl -X GET http://localhost:3001/api/project-chat/conversations/test-id
```

**Résultat attendu** :
```json
{
  "success": true,
  "conversations": []
}
```

Si vous voyez ça → API fonctionne ✅

---

## 🧪 TEST 2 : Test avec IA (optionnel)

**Note** : Ce test consomme des crédits Replicate (minimal)

```bash
curl -X POST http://localhost:3001/api/project-chat/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-project-id",
    "userId": "test-user-id",
    "modelType": "nano-gpt5",
    "message": "Bonjour, test du chat IA",
    "contextData": {
      "project": {
        "titre": "Test Projet",
        "description": "Ceci est un test",
        "secteur": "Test",
        "budget": "Test",
        "phase": "idea",
        "progression": 0
      },
      "cumulativeContext": [],
      "documents": []
    }
  }'
```

**Résultat attendu** :
```json
{
  "success": true,
  "conversationId": "uuid...",
  "message": {
    "id": "uuid...",
    "role": "assistant",
    "content": "Réponse de l'IA...",
    "credits_consumed": 5
  },
  "creditsUsed": 5
}
```

Si vous voyez ça → IA fonctionne ✅

---

## 🎨 TEST 3 : Interface UI (Important !)

### Étape 1 : Vérifier les imports

Le fichier `frontend/src/app/business/mes-projets/page.tsx` devrait déjà avoir :

```tsx
import ProjectChatBot from '@/components/business/ProjectChatBot'
```

### Étape 2 : Vérifier l'intégration

Dans la vue détaillée du projet, il devrait y avoir :

```tsx
{selectedProject && (
  <ProjectChatBot
    projectId={selectedProject.id}
    userId={user?.id || 'demo'}
    projectData={{
      titre: selectedProject.proposition_titre,
      description: selectedProject.proposition_description,
      secteur: selectedProject.secteur_selectionne,
      budget: selectedProject.budget_selectionne,
      phase: selectedProject.current_phase || 'idea',
      progression: selectedProject.progress_percentage || 0,
      cumulative_context: selectedProject.cumulative_context,
      plan_action_steps: selectedProject.plan_action_steps
    }}
    documents={projectDocuments[selectedProject.id] || []}
    notes={projectNotes[selectedProject.id] || []}
    userCredits={500}
  />
)}
```

### Étape 3 : Tester dans le navigateur

1. Démarrer le frontend :
   ```bash
   cd frontend
   npm run dev
   ```

2. Ouvrir : `http://localhost:3000`

3. Aller dans **Business** → **Mes Projets**

4. Ouvrir un projet existant (ou en créer un)

5. **Chercher le bouton 💬** en bas à droite de l'écran

6. Cliquer sur le bouton → Modal devrait s'ouvrir

7. Choisir un modèle (Nano GPT-5 ou Agent GPT-4)

8. Envoyer un message : `"Comment démarrer mon projet ?"`

9. Attendre la réponse (5-10 secondes)

10. Vérifier que la réponse apparaît

11. Terminer conversation (bouton X)

12. Vérifier dans le contexte cumulatif du projet → Rapport devrait être ajouté

---

## ✅ CHECKLIST COMPLÈTE

### Backend
- [ ] Backend démarre sans erreur
- [ ] Route `/api/project-chat/conversations` répond
- [ ] Route `/api/project-chat/send-message` fonctionne
- [ ] Logs montrent "✅ Réponse IA reçue"

### Frontend  
- [ ] ProjectChatBot est importé
- [ ] Bouton 💬 apparaît en bas à droite
- [ ] Modal s'ouvre au clic
- [ ] Choix 2 modèles affiché
- [ ] Envoi message fonctionne
- [ ] Réponse IA s'affiche
- [ ] Crédits sont trackés
- [ ] Rapport ajouté au contexte

### Base de données
- [ ] Table `project_chat_conversations` créée
- [ ] Table `project_chat_messages` créée
- [ ] Messages sauvegardés correctement
- [ ] Rapports ajoutés au `cumulative_context`

---

## ⚠️ TROUBLESHOOTING

### "Cannot find module 'replicate'"
```bash
cd backend
npm install replicate
```

### "REPLICATE_API_TOKEN is not defined"
Vérifier `.env` :
```bash
cat backend/.env | grep REPLICATE
```

### "Bouton chat n'apparaît pas"
Vérifier que `ProjectChatBot` est bien intégré dans `mes-projets/page.tsx`

### "Erreur 500 lors de l'envoi"
Vérifier les logs backend :
```bash
# Dans le terminal backend
# Chercher les erreurs
```

### "Pas de réponse IA"
- Vérifier token Replicate valide
- Vérifier crédits Replicate : https://replicate.com/account
- Vérifier logs backend

---

## 📊 VÉRIFICATION BDD

```sql
-- Vérifier conversations
SELECT * FROM project_chat_conversations ORDER BY created_at DESC LIMIT 5;

-- Vérifier messages
SELECT * FROM project_chat_messages ORDER BY created_at DESC LIMIT 10;

-- Vérifier contexte enrichi
SELECT id, cumulative_context 
FROM saved_projects 
WHERE cumulative_context IS NOT NULL
ORDER BY context_updated_at DESC 
LIMIT 5;
```

---

## 🎉 SI TOUT FONCTIONNE

Vous devriez voir :

1. ✅ Bouton 💬 visible sur chaque projet
2. ✅ Modal chat s'ouvre
3. ✅ Choix entre 2 modèles IA
4. ✅ Messages envoyés/reçus
5. ✅ Crédits affichés
6. ✅ Rapports dans contexte cumulatif

**Le Chat IA est opérationnel !** 🚀

---

## 📚 DOCUMENTATION

- `CHAT_IA_SETUP.md` - Setup complet (20 pages)
- `QUICK_START_CHAT.md` - Installation rapide
- `REPLICATE_TOKEN_SETUP.md` - Config token
- `SESSION_RECAP_2025-10-13.md` - Récap session

---

**Besoin d'aide ?** Consultez les logs backend et la documentation complète.
