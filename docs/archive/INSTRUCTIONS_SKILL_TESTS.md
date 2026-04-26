# Instructions: Système de Tests de Compétence

## ⚠️ ÉTAPE OBLIGATOIRE: Exécuter la migration SQL

**Tu DOIS exécuter cette migration dans Supabase avant que le système fonctionne:**

1. Va sur https://supabase.com/dashboard/project/fxyfbkmqbjijbvpdxbdh/sql/new
2. Copie le contenu du fichier `/backend/migrations/create_skill_tests_table.sql`
3. Exécute la migration
4. Vérifie que la table `skill_tests` est créée

## 📋 Fonctionnalités implémentées

### Backend (`/backend/routes/skill-test.js`)

**Routes disponibles:**

1. **POST `/api/skill-test/generate`**
   - Génère un nouveau test personnalisé
   - Utilise Replicate API avec Meta Llama 3 70B
   - Sauvegarde automatiquement dans Supabase
   - Retourne: `{ test, testId, credits_used: 30 }`

2. **GET `/api/skill-test/my-tests?userId=xxx`**
   - Récupère tous les tests d'un utilisateur
   - Retourne: liste complète des tests avec résultats

3. **GET `/api/skill-test/:id?userId=xxx`**
   - Récupère un test spécifique
   - Vérifie que l'utilisateur est propriétaire

4. **PUT `/api/skill-test/:id/complete`**
   - Enregistre les résultats d'un test complété
   - Body: `{ userId, userAnswers, score, scorePercentage }`
   - Marque automatiquement `completed = true`

5. **DELETE `/api/skill-test/:id?userId=xxx`**
   - Supprime un test
   - Vérifie ownership

6. **POST `/api/skill-test/:id/regenerate?userId=xxx`**
   - Regénère un nouveau test sur les mêmes bases
   - Réutilise: proposition, secteur, budget, user_context
   - Coûte 30 crédits supplémentaires
   - Crée un NOUVEAU test (ne modifie pas l'ancien)

### Frontend

#### 1. Modal de Test (`/frontend/src/components/skill-test/SkillTestModal.tsx`)

**Fonctionnalités:**
- Interface progressive question par question
- Barre de progression
- Catégorie affichée par question
- Bouton "Voir l'explication" après réponse
- Navigation Précédent/Suivant
- **Sauvegarde automatique** des résultats à la fin du test
- Écran de résultats détaillé:
  - Score en pourcentage
  - Message personnalisé selon score
  - Détail de toutes les réponses
  - Explications pour chaque question

**Props:**
```typescript
{
  open: boolean
  onClose: () => void
  test: SkillTest | null
  proposalTitle: string
  testId?: string | null    // ✅ NOUVEAU
  userId?: string | null    // ✅ NOUVEAU
}
```

#### 2. Page Analyzer (`/frontend/src/app/business/analyzer/page.tsx`)

**Modifications:**
- ✅ Option "Test de compétence" dans dropdown "Aller + Loin"
- ✅ Coût: 30 crédits (au lieu de 75 pour Mentoring)
- ✅ Stockage de `generatedSkillTestId`
- ✅ Passage de `testId` et `userId` au modal
- ✅ Sauvegarde automatique en DB lors de la génération

#### 3. Page "Mes Projets" - **À IMPLÉMENTER**

**TODO: Ajouter l'onglet "Tests"**

La structure est prête dans `/frontend/src/app/business/mes-projets/page.tsx`:
1. Modifier `activeTab` type: `'projects' | 'docs' | 'tests'`
2. Ajouter state `tests`
3. Créer fonction `fetchTests()`
4. Ajouter bouton "Tests" dans les tabs
5. Créer la grille d'affichage des tests

**Exemple de structure à ajouter:**

```typescript
// State
const [tests, setTests] = useState<any[]>([])
const [activeTab, setActiveTab] = useState<'projects' | 'docs' | 'tests'>('projects')

// Fetch
const fetchTests = async () => {
  const response = await fetch(`${API_URL}/api/skill-test/my-tests?userId=${userId}`)
  const data = await response.json()
  if (data.success) setTests(data.tests)
}

// Affichage
{activeTab === 'tests' && (
  <div className="grid gap-6">
    {tests.map(test => (
      <TestCard
        key={test.id}
        test={test}
        onView={() => viewTest(test.id)}
        onRegenerate={() => regenerateTest(test.id)}
        onDelete={() => deleteTest(test.id)}
      />
    ))}
  </div>
)}
```

## 🗄️ Structure de la table `skill_tests`

```sql
- id: UUID (primary key)
- user_id: UUID (référence auth.users)
- article_id: UUID (référence articles, nullable)
- proposal_title: TEXT
- proposal_description: TEXT
- sector: TEXT
- budget: TEXT
- test_data: JSONB (structure complète du test)
- user_answers: JSONB ({ q1: 0, q2: 2, ... })
- score: INTEGER (score brut sur 13)
- score_percentage: INTEGER (0-100)
- completed: BOOLEAN
- completed_at: TIMESTAMPTZ
- user_context: JSONB
- credits_used: INTEGER (30)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## 🎯 Format JSON du test

```json
{
  "title": "Test de Compétence : [Titre]",
  "description": "Description...",
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "...",
      "category": "Validation marché|Finance|..."
    }
  ],
  "scoring": {
    "excellent": { "min": 80, "message": "..." },
    "good": { "min": 60, "message": "..." },
    "average": { "min": 40, "message": "..." },
    "needsWork": { "message": "..." }
  }
}
```

## 🚀 Workflow complet

1. **Utilisateur génère un test** (Analyzer → "Aller + Loin" → "Test de compétence")
   - Coûte 30 crédits
   - Backend génère via Replicate
   - Sauvegarde automatique en DB avec testId

2. **Utilisateur passe le test** (Modal interactif)
   - Répond aux 10 questions
   - Clique "Voir les résultats"
   - **Sauvegarde automatique** des réponses et score

3. **Utilisateur consulte ses tests** (Mes Projets → onglet "Tests")
   - Voir tous les tests passés
   - Voir les résultats
   - Regénérer un nouveau test (30 crédits)
   - Supprimer un test

4. **Utilisateur régénère** (depuis Mes Projets)
   - Même proposition, même contexte
   - Nouvelles questions (température plus élevée)
   - Nouveau test créé (ne remplace pas l'ancien)

## 📊 Points clés

- **Scoring**: Q1-Q7 = 1pt chacune, Q8-Q10 = 2pts chacune (total 13pts)
- **Prompt**: Psychométricien professionnel avec contraintes strictes
- **Modèle**: Meta Llama 3 70B Instruct (excellent pour JSON structuré)
- **Température**: 0.7 pour génération, 0.8 pour regénération (plus de variation)
- **RLS**: Chaque utilisateur ne voit que ses tests
- **Auto-save**: Résultats sauvegardés automatiquement à la fin du test

## ✅ Ce qui est fait

- ✅ Table Supabase (migration SQL prête)
- ✅ Routes backend complètes (CRUD + regenerate)
- ✅ Modal frontend interactif avec auto-save
- ✅ Intégration dans Analyzer
- ✅ Génération via Replicate
- ✅ Prompt psychométricien complet
- ✅ Sauvegarde automatique testId

## ⏳ Ce qui reste à faire

- ⬜ Exécuter migration SQL dans Supabase
- ⬜ Ajouter onglet "Tests" dans "Mes Projets"
- ⬜ Créer composant TestCard pour afficher les tests
- ⬜ Implémenter "Voir les résultats" (réouvrir modal en read-only)
- ⬜ Tester le workflow complet end-to-end

## 🧪 Comment tester

1. Exécute la migration SQL
2. Redémarre le backend
3. Va sur l'Analyzer
4. Génère des propositions
5. Clique "Aller + Loin" → "Test de compétence"
6. Passe le test
7. Vérifie dans Supabase que le test est sauvegardé avec résultats
8. (À implémenter) Va dans "Mes Projets" → "Tests" pour voir le test

## 📝 Notes techniques

- Le backend continue même si la sauvegarde échoue (graceful fallback)
- Le modal peut fonctionner sans testId/userId (mode démo)
- La regénération utilise une température plus élevée pour varier les questions
- Les tests sont automatiquement triés par date (plus récent d'abord)
