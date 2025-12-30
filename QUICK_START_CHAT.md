# ⚡ QUICK START - CHAT IA

## 🚀 INSTALLATION RAPIDE

### **1. Installer Replicate**

```bash
cd backend
npm install replicate
```

### **2. Obtenir API Token**

1. Aller sur https://replicate.com/account/api-tokens
2. Créer un nouveau token
3. Copier le token

### **3. Ajouter dans .env**

```bash
# backend/.env
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **4. Redémarrer backend**

```bash
# Si en dev
npm run dev

# Si en prod
pm2 restart backend
```

---

## 🧪 TESTER

### **1. Tester API directement**

```bash
curl -X POST http://localhost:3001/api/project-chat/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_UUID",
    "userId": "USER_UUID",
    "modelType": "nano-gpt5",
    "message": "Comment financer mon projet ?",
    "contextData": {
      "project": {
        "titre": "Test",
        "description": "Description test",
        "secteur": "Agriculture",
        "budget": "0-500k",
        "phase": "idea",
        "progression": 0
      },
      "cumulativeContext": [],
      "documents": []
    }
  }'
```

### **2. Intégrer dans mes-projets**

```tsx
// frontend/src/app/business/mes-projets/page.tsx

import ProjectChatBot from '@/components/business/ProjectChatBot'

// Ajouter dans le retour, après selectedProject
{selectedProject && (
  <ProjectChatBot
    projectId={selectedProject.id}
    userId={user.id}
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
    userCredits={500} // TODO: récupérer depuis user context
  />
)}
```

### **3. Tester dans l'UI**

1. Ouvrir un projet
2. Cliquer sur bouton chat (coin bas-droit)
3. Choisir un modèle
4. Envoyer un message
5. Vérifier la réponse
6. Terminer conversation
7. Vérifier rapport dans contexte cumulatif

---

## 🎯 2 MODÈLES DISPONIBLES

### **Nano GPT-5** ⚡
- **5 crédits/message**
- Rapide et économique
- Parfait pour questions simples

### **Agent GPT-4** 🎯
- **15 crédits/message**
- Analyse approfondie
- Recommandations détaillées

---

## 📊 VÉRIFICATION

### **✅ Base de données**

```sql
-- Vérifier tables créées
SELECT * FROM project_chat_conversations LIMIT 1;
SELECT * FROM project_chat_messages LIMIT 1;

-- Vérifier fonction
SELECT generate_conversation_summary('uuid');
```

### **✅ Backend**

```bash
# Logs backend
tail -f backend.log

# Doit afficher:
# 🤖 Appel IA: nano-gpt5
# ✅ Réponse IA reçue
```

### **✅ Frontend**

1. Modal chat s'ouvre
2. Choix modèle affiché
3. Messages s'affichent
4. Crédits mis à jour
5. Rapport généré à la fin

---

## ⚠️ TROUBLESHOOTING

### **Erreur "REPLICATE_API_TOKEN not found"**

```bash
# Vérifier .env
cat backend/.env | grep REPLICATE

# Redémarrer backend
npm run dev
```

### **Erreur "Invalid token"**

- Vérifier token sur https://replicate.com/account
- Créer nouveau token si nécessaire

### **Pas de réponse IA**

```bash
# Vérifier logs backend
# Vérifier crédits Replicate
# Tester avec curl
```

### **Rapport non ajouté au contexte**

```sql
-- Vérifier cumulative_context
SELECT cumulative_context 
FROM saved_projects 
WHERE id = 'PROJECT_UUID';
```

---

## 🎉 C'EST PRÊT !

Bouton chat devrait apparaître en bas à droite de chaque projet ! 💬

---

**Support** : Voir `CHAT_IA_SETUP.md` pour documentation complète
