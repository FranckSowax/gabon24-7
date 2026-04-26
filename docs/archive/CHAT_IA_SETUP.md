# 🤖 SYSTÈME CHAT IA PAR PROJET - SETUP

## 📋 INSTALLATION

### **1. Installer dépendance Replicate**

```bash
cd backend
npm install replicate
```

### **2. Ajouter API Token dans .env**

```bash
# backend/.env
REPLICATE_API_TOKEN=your_replicate_token_here
```

**Obtenir le token** : https://replicate.com/account/api-tokens

---

## 🎯 FONCTIONNALITÉS

### **2 Modèles IA disponibles** :

#### **1. Expert Nano GPT-5** ⚡
- **Coût** : 5 ⚡ par message
- **Usage** : Réponses rapides, conseils généraux
- **Modèle** : `meta/meta-llama-3-70b-instruct` (Replicate)
- **Parfait pour** : Questions courtes, conseils rapides

#### **2. Agent Spécialisé GPT-4** 🎯
- **Coût** : 15 ⚡ par message
- **Usage** : Analyses approfondies, stratégies complexes
- **Modèle** : `meta/meta-llama-3-70b-instruct` (Replicate)
- **Parfait pour** : Recommandations détaillées, plans stratégiques

---

## 🗄️ STRUCTURE BDD

### **Tables créées** :

#### **`project_chat_conversations`** :
```sql
- id (UUID)
- project_id (FK)
- user_id (UUID)
- model_type ('nano-gpt5' | 'agent-gpt4')
- created_at
- ended_at
- total_messages (INTEGER)
- total_credits_used (INTEGER)
- conversation_summary (TEXT)
- context_snapshot (JSONB)
```

#### **`project_chat_messages`** :
```sql
- id (UUID)
- conversation_id (FK)
- role ('user' | 'assistant')
- content (TEXT)
- credits_consumed (INTEGER)
- created_at
```

---

## 🔄 FLUX UTILISATEUR

### **1. Ouverture du chat**

```
User clique sur icône chatbot (coin bas-droite)
  ↓
Modal s'ouvre
  ↓
Choix du modèle :
  - ⚡ Expert Nano GPT-5 (5 ⚡/msg)
  - 🎯 Agent GPT-4 (15 ⚡/msg)
```

### **2. Conversation**

```
User envoie message
  ↓
Vérification crédits
  ↓
Construction contexte enrichi:
  - Infos projet
  - Contexte cumulatif
  - Documents générés
  - Plan d'action
  - Notes
  ↓
Appel API Replicate
  ↓
Réponse IA
  ↓
Message sauvegardé en BDD
  ↓
Crédits débités
  ↓
Affichage réponse
```

### **3. Fin conversation**

```
User clique "X" ou "Terminer"
  ↓
Confirmation
  ↓
Génération résumé conversation
  ↓
Rapport ajouté au contexte cumulatif du projet
  ↓
Conversation marquée comme terminée
```

---

## 📊 CONTEXTE FOURNI À L'IA

### **Données envoyées** :

```json
{
  "project": {
    "titre": "Agriculture Bio - Mangues",
    "description": "...",
    "secteur": "Agriculture",
    "budget": "0 - 500 000 FCFA",
    "phase": "planning",
    "progression": 60
  },
  "cumulativeContext": [
    {
      "type": "budget",
      "content": "+200k FCFA disponible",
      "date": "2025-10-12"
    },
    {
      "type": "resource",
      "content": "Terrain 2 hectares",
      "date": "2025-10-11"
    }
  ],
  "documents": [
    {
      "type": "action-plan",
      "title": "Plan d'action Agriculture",
      "summary": "Étapes 1-10..."
    }
  ],
  "planActionSteps": [
    {
      "step": 1,
      "title": "Étude de marché",
      "status": "completed"
    }
  ],
  "notes": [
    {
      "content": "Contact ONG locale établi",
      "date": "2025-10-10"
    }
  ]
}
```

### **Prompt système** :

```
Tu es un assistant IA expert en business et entrepreneuriat.
Tu aides l'utilisateur avec son projet business spécifique.

CONTEXTE DU PROJET:
Titre: Agriculture Bio - Mangues
Description: ...
Secteur: Agriculture
Budget: 0 - 500 000 FCFA
Phase actuelle: planning
Progression: 60%

CONTEXTE CUMULATIF:
- [budget] +200k FCFA disponible
- [resource] Terrain 2 hectares

DOCUMENTS GÉNÉRÉS:
- action-plan: Plan d'action Agriculture
  Étapes 1-10...

PLAN D'ACTION:
1. Étude de marché (completed)
2. ...

NOTES:
- Contact ONG locale établi

INSTRUCTIONS:
- Réponds de manière précise et concise
- Utilise le contexte du projet pour personnaliser tes réponses
- Donne des conseils actionnables
- Sois encourageant et professionnel
```

---

## 🎨 INTERFACE

### **Bouton flottant** (coin bas-droit) :

```
┌─────────────┐
│     💬      │ ← Icône chatbot
│             │   Point vert (disponible)
└─────────────┘
```

### **Modal chat** :

```
╔═══════════════════════════════════════╗
║  🤖 Assistant IA        125 ⚡  [X]   ║
╠═══════════════════════════════════════╣
║                                       ║
║  CHOIX DU MODÈLE (si pas encore):     ║
║                                       ║
║  ┌─────────────────────────────────┐ ║
║  │ ⚡ Expert Nano GPT-5            │ ║
║  │ Réponses rapides - 5⚡/msg      │ ║
║  │ [Rapide] [Économique]           │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
║  ┌─────────────────────────────────┐ ║
║  │ 🎯 Agent Spécialisé GPT-4       │ ║
║  │ Analyse approfondie - 15⚡/msg  │ ║
║  │ [Détaillé] [Stratégique]        │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
╠═══════════════════════════════════════╣
║  MESSAGES (après choix):              ║
║                                       ║
║  🤖 Bonjour ! Je peux vous aider...  ║
║                                       ║
║  👤 Comment financer mon projet ?    ║
║                                       ║
║  🤖 Basé sur votre budget de...      ║
║     [15 ⚡]                           ║
║                                       ║
╠═══════════════════════════════════════╣
║  [Votre message...]          [Send]   ║
║  15 ⚡/msg | Crédits: 485 ⚡          ║
╚═══════════════════════════════════════╝
```

---

## 🔧 API ENDPOINTS

### **1. Envoyer message**

```
POST /api/project-chat/send-message

Body:
{
  "conversationId": "uuid" (optionnel, créé si absent),
  "projectId": "uuid",
  "userId": "uuid",
  "modelType": "nano-gpt5" | "agent-gpt4",
  "message": "Comment financer...",
  "contextData": { ... }
}

Response:
{
  "success": true,
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Réponse IA...",
    "credits_consumed": 15
  },
  "creditsUsed": 15
}
```

### **2. Terminer conversation**

```
POST /api/project-chat/end-conversation

Body:
{
  "conversationId": "uuid",
  "projectId": "uuid"
}

Response:
{
  "success": true,
  "message": "Conversation terminée et rapport ajouté"
}
```

### **3. Historique conversations**

```
GET /api/project-chat/conversations/:projectId

Response:
{
  "success": true,
  "conversations": [
    {
      "id": "uuid",
      "model_type": "agent-gpt4",
      "total_messages": 12,
      "total_credits_used": 180,
      "created_at": "...",
      "ended_at": "..."
    }
  ]
}
```

---

## 💡 RAPPORT AUTO-GÉNÉRÉ

### **À la fin de chaque conversation** :

1. **Résumé créé** automatiquement
2. **Format** :
   ```
   Conversation avec assistant IA (12 messages):
   [user] Question 1
   [assistant] Réponse 1
   ...
   ```

3. **Ajouté au contexte cumulatif** :
   ```json
   {
     "date": "2025-10-13",
     "type": "conversation_ai",
     "content": "Conversation avec assistant IA...",
     "author": "Assistant IA"
   }
   ```

4. **Visible** dans section "Contexte cumulatif" du projet

5. **Réutilisé** dans futures conversations et ré-analyses

---

## ⚡ GESTION CRÉDITS

### **Coûts** :

| Action | Crédits |
|--------|---------|
| Message Nano GPT-5 | 5 ⚡ |
| Message Agent GPT-4 | 15 ⚡ |

### **Vérification avant envoi** :

```typescript
const creditsNeeded = AI_MODELS[selectedModel].creditsPerMessage

if (userCredits < creditsNeeded) {
  alert(`Crédits insuffisants. Vous avez ${userCredits} ⚡`)
  return
}
```

### **Affichage temps réel** :

```tsx
// Dans le modal
<div className="text-xs">
  15 ⚡/msg | Crédits restants: 485 ⚡
</div>

// Compteur conversation
<div className="text-yellow-400">
  125 ⚡ consommés
</div>
```

---

## 🚀 INTÉGRATION

### **Dans mes-projets/page.tsx** :

```tsx
import ProjectChatBot from '@/components/business/ProjectChatBot'

// Dans la vue détaillée
{selectedProject && (
  <ProjectChatBot
    projectId={selectedProject.id}
    userId={user.id}
    projectData={{
      titre: selectedProject.proposition_titre,
      description: selectedProject.proposition_description,
      secteur: selectedProject.secteur_selectionne,
      budget: selectedProject.budget_selectionne,
      phase: selectedProject.current_phase,
      progression: selectedProject.progress_percentage,
      cumulative_context: selectedProject.cumulative_context,
      plan_action_steps: selectedProject.plan_action_steps
    }}
    documents={projectDocuments[selectedProject.id] || []}
    notes={projectNotes[selectedProject.id] || []}
    userCredits={userCredits} // TODO: récupérer depuis contexte
  />
)}
```

---

## 🎯 AVANTAGES

### **Pour l'utilisateur** :

1. ✅ **Assistance personnalisée** basée sur son projet
2. ✅ **Contexte complet** pris en compte
3. ✅ **2 options** selon le besoin (rapide vs approfondi)
4. ✅ **Historique sauvegardé** et réutilisable
5. ✅ **Rapports automatiques** enrichissent le contexte
6. ✅ **Transparent** : crédits affichés en temps réel

### **Pour le projet** :

1. ✅ **Enrichissement continu** du contexte via conversations
2. ✅ **Traçabilité** : toutes les conversations sauvegardées
3. ✅ **Évolution** : contexte s'améliore à chaque interaction
4. ✅ **IA adaptative** : comprend mieux le projet au fil du temps

---

## 📋 CHECKLIST DÉPLOIEMENT

- [ ] Installer `npm install replicate`
- [ ] Ajouter `REPLICATE_API_TOKEN` dans `.env`
- [ ] Tester endpoints API
- [ ] Intégrer composant dans mes-projets
- [ ] Tester choix modèle
- [ ] Tester envoi message
- [ ] Vérifier contexte fourni à l'IA
- [ ] Tester fin conversation + rapport
- [ ] Vérifier ajout rapport au contexte
- [ ] Tester débit crédits

---

## 🔮 ÉVOLUTIONS FUTURES

### **Phase 2** :
- [ ] Vraie intégration GPT-4 (OpenAI API)
- [ ] Streaming des réponses
- [ ] Suggestions de questions
- [ ] Templates de conversations

### **Phase 3** :
- [ ] Voice input/output
- [ ] Partage conversations
- [ ] Export PDF conversations
- [ ] Analytics conversations

---

**Date création** : 2025-10-13  
**Status** : Structure créée, à tester  
**Prochaine étape** : Installation Replicate + Tests
