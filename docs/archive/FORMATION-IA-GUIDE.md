# 🎓 SYSTÈME DE FORMATION IA - GUIDE COMPLET

## �� VUE D'ENSEMBLE

Système de formation en ligne style **Teachable** intégré aux Opportunités IA avec:
- ✅ Génération automatique de contenu pédagogique (GPT-5 Nano)
- ✅ Images contextuelles Gabon (Nano Banana)
- ✅ Interface anti-copie professionnelle
- ✅ Progression module par module
- ✅ Paiement par crédits IA

---

## 🏗️ ARCHITECTURE

### Backend API (server.js)
**Endpoints créés:**
- `POST /api/training/generate-lesson` - Génère leçon pédagogique
- `POST /api/training/generate-module-image` - Génère image module
- `POST /api/training/create-training` - Crée formation (paiement crédits)
- `GET /api/training/:training_id` - Récupère formation
- `PUT /api/training/:training_id/progress` - MAJ progression

### Service IA (gpt5-nano-analyzer.js)
**Fonctions ajoutées:**
- `generateModuleLesson()` - Prompt pédagogique 2000-3000 mots
- `generateModuleImage()` - Image 16:9 contexte gabonais

### Base de Données (Supabase)
**Tables créées:**
```sql
- trainings (id, user_id, project_id, modules, progress, completed_modules)
- training_modules (id, training_id, lesson_content, image_url, is_completed)
```

---

## 🎨 INTERFACE FRONTEND

### 1. Page Formation (/training/[training_id]/page.tsx)
**Style Teachable:**
- Barre latérale modules avec progression
- Zone contenu avec image 16:9
- Texte markdown formaté
- Protection anti-copie (onCopy prevented, userSelect: none)
- Bouton "J'ai terminé cette leçon"

### 2. Modal Achat (TrainingPurchaseModal.tsx)
**Fonctionnalités:**
- Sélection modules individuels OU formation complète
- Réduction -20% pour formation complète
- Calcul crédits automatique (5 crédits/module)
- Vérification solde utilisateur
- Modules verrouillés (ordre séquentiel)

### 3. Bouton Accès (TrainingAccessButton.tsx)
**Intégration simple:**
```tsx
<TrainingAccessButton
  opportunity={opportunity}
  project={project}
  user={user}
  modules={modules}
  variant="primary"
/>
```

---

## 💰 SYSTÈME DE CRÉDITS

**Prix:**
- 1 module = **5 crédits IA**
- Formation complète = **-20% de réduction**
- Exemple: 10 modules = 50 crédits → 40 crédits (réduction)

**Paiement:**
- Vérification solde avant achat
- Déduction automatique à la création
- Erreur 402 si crédits insuffisants

---

## 📚 CONTENU PÉDAGOGIQUE

### Prompt Leçon (GPT-5 Nano)
**Structure 2000-3000 mots:**
1. Introduction (200 mots) - Objectifs, contexte Gabon
2. Fondamentaux (600 mots) - Concepts de base, exemples locaux
3. Application Pratique (800 mots) - Étapes, cas pratiques FCFA
4. Outils et Ressources (400 mots) - Outils Gabon, budget
5. Conclusion et Action (200 mots) - Takeaways, plan d'action

**Style:**
- Ton convivial et encourageant
- Exemples Libreville, Port-Gentil, Franceville
- Prix en FCFA
- Contraintes locales (électricité, internet)
- Pédagogie active (questions, exercices)

### Images Module (Nano Banana)
**Prompt contextualisé:**
- African setting, Gabon, Libreville cityscape
- Catégorie-specific (business, tech, marketing...)
- Clean, bright, welcoming learning environment
- 16:9 aspect ratio
- Photo realistic, no text overlay

---

## 🔒 PROTECTION ANTI-COPIE

**Mesures implémentées:**
```tsx
<div
  onCopy={(e) => e.preventDefault()}
  onCut={(e) => e.preventDefault()}
  onContextMenu={(e) => e.preventDefault()}
  style={{ userSelect: 'none' }}
>
  {lesson_content}
</div>
```

**Images:**
```tsx
<img onContextMenu={(e) => e.preventDefault()} />
```

---

## 🚀 WORKFLOW UTILISATEUR

```
1. User génère opportunité IA avec sommaire formation
   ↓
2. Clique "Accéder à la formation" (carte projet)
   ↓
3. Modal achat s'ouvre avec modules disponibles
   ↓
4. Sélectionne modules (individuels ou tout)
   ↓
5. Voit prix total + vérification crédits
   ↓
6. Clique "Démarrer la formation"
   ↓ (POST /api/training/create-training)
7. Backend crée formation + déduit crédits
   ↓
8. Redirection vers /training/[id]
   ↓
9. Interface style Teachable s'affiche
   ↓
10. Pour chaque module:
    - Génération image (Nano Banana 20-30s)
    - Génération leçon (GPT-5 Nano 30-40s)
    - Affichage contenu protégé
    - Bouton "J'ai terminé"
    ↓
11. Progression enregistrée en temps réel
    ↓
12. Certificat de complétion (futur)
```

---

## 📁 FICHIERS CRÉÉS

**Backend:**
- `backend/services/gpt5-nano-analyzer.js` (fonctions ajoutées)
- `backend/server.js` (endpoints ajoutés ligne 5012+)
- `backend/migrations/create_trainings_table.sql`

**Frontend:**
- `frontend/src/app/training/[training_id]/page.tsx`
- `frontend/src/components/training/TrainingPurchaseModal.tsx`
- `frontend/src/components/training/TrainingAccessButton.tsx`

---

## �� CONFIGURATION REQUISE

**Variables d'environnement:**
```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx # Déjà configuré
```

**Dépendances (déjà installées):**
- react-markdown
- framer-motion
- lucide-react

---

## ✅ CHECKLIST INTÉGRATION

### Pour utiliser dans la carte projet:

1. **Importer le bouton:**
```tsx
import TrainingAccessButton from '@/components/training/TrainingAccessButton';
```

2. **Ajouter condition:**
```tsx
{project.has_training_summary && (
  <TrainingAccessButton
    opportunity={opportunity}
    project={project}
    user={user}
    modules={project.training_modules}
  />
)}
```

3. **Vérifier sommaire disponible:**
Le sommaire doit être généré par l'opportunité IA et stocké dans `project.training_modules`

---

## 🎯 EXEMPLES D'UTILISATION

### Exemple 1: Opportunité E-commerce

**Modules générés:**
1. Introduction au e-commerce gabonais (15 min)
2. Créer sa boutique en ligne (20 min)
3. Marketing digital au Gabon (25 min)
4. Logistique et livraison locale (20 min)
5. Paiement mobile et FCFA (15 min)

**Prix:** 5 modules × 5 crédits = **20 crédits** (avec réduction)

**Images:** Boutiques Libreville, paiement mobile, livraison Port-Gentil

---

## 🐛 GESTION D'ERREURS

**Erreur: Crédits insuffisants**
```json
{
  "success": false,
  "error": "Crédits insuffisants",
  "required": 25,
  "available": 10
}
```
→ Affichage message + lien acheter crédits

**Erreur: Génération IA échouée**
→ Message "Réessayer" avec bouton

**Erreur: Timeout génération**
→ Max 60 tentatives (2 min) puis erreur

---

## 📊 MÉTRIQUES

**Temps génération:**
- Image: 20-30 secondes
- Leçon: 30-40 secondes
- **Total par module: ~60 secondes**

**Coûts Replicate:**
- Image: ~$0.01-0.05
- Leçon: ~$0.02-0.10
- **Total: ~$0.05-0.15 par module**

---

## 🚀 PROCHAINES ÉTAPES

1. ✅ Intégrer bouton dans carte projet
2. ✅ Tester génération complète
3. ⏳ Certificat de complétion
4. ⏳ Système de quiz/évaluation
5. ⏳ Export PDF du contenu
6. ⏳ Mode hors ligne
7. ⏳ Partage social de progression

---

**🎉 SYSTÈME PRÊT POUR TESTS !**
