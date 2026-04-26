# 🤝 Système de Collaboration Multi-Utilisateurs

Système complet permettant à plusieurs utilisateurs de collaborer sur un même projet avec gestion d'équipe, commentaires et partage de documents/visions.

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Base de données](#base-de-données)
4. [API Backend](#api-backend)
5. [Composants Frontend](#composants-frontend)
6. [Workflow Utilisateur](#workflow-utilisateur)
7. [Permissions](#permissions)
8. [Intégration](#intégration)

---

## 🎯 Vue d'ensemble

### Fonctionnalités Principales

- **👥 Gestion d'Équipe**
  - Inviter des collaborateurs par email
  - Rôles: Propriétaire, Éditeur, Lecteur
  - Retirer des collaborateurs
  - Statuts: En attente, Accepté, Refusé

- **💬 Commentaires**
  - Fil de discussion par projet
  - Auteur et timestamp
  - Réponses imbriquées (optionnel)
  - Temps réel

- **📁 Documents Partagés**
  - Partage de visions textuelles
  - Upload d'images
  - Upload de documents
  - Enrichissement du contexte cumulé

### Cas d'Usage

1. **Entrepreneur Solo → Équipe**
   - Démarre seul avec une opportunité IA
   - Invite des associés/conseillers
   - Collabore sur le développement

2. **Groupe de Travail**
   - Plusieurs personnes sur un projet commun
   - Partage de visions et idées
   - Suivi collaboratif de l'avancement

3. **Mentorat**
   - Mentor invité en tant que lecteur/éditeur
   - Commente et guide
   - Partage ressources et documents

---

## 🏗️ Architecture

### Stack Technique

**Backend:**
- Node.js + Express
- Supabase (PostgreSQL)
- RLS (Row Level Security)

**Frontend:**
- React + TypeScript
- Framer Motion (animations)
- Lucide Icons
- Tailwind CSS

### Flux de Données

```
User Action (Frontend)
    ↓
API Call (/api/collaboration/*)
    ↓
Backend Validation
    ↓
Supabase Insert/Update
    ↓
RLS Policy Check
    ↓
Response to Frontend
    ↓
UI Update
```

---

## 🗄️ Base de Données

### Table: `project_collaborators`

Gestion des membres d'équipe par projet.

```sql
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' 
    CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, invited_email)
);
```

**Rôles:**
- `owner`: Créateur du projet, tous les droits
- `editor`: Peut modifier, commenter, ajouter documents
- `viewer`: Lecture seule, peut commenter

**Statuts:**
- `pending`: Invitation envoyée, pas encore acceptée
- `accepted`: Utilisateur a rejoint l'équipe
- `declined`: Invitation refusée

### Table: `project_comments`

Fil de commentaires par projet.

```sql
CREATE TABLE project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  parent_comment_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Features:**
- Commentaires imbriqués via `parent_comment_id`
- Cascade delete si projet supprimé
- Timestamps pour tri chronologique

### Table: `project_shared_documents`

Documents et visions partagés.

```sql
CREATE TABLE project_shared_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES saved_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  document_type TEXT NOT NULL 
    CHECK (document_type IN ('image', 'document', 'vision')),
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  vision_text TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Types de Documents:**
- `vision`: Texte décrivant une vision/idée
- `image`: Image uploadée (mockups, schémas)
- `document`: PDF, Word, etc.

### Politiques RLS

**Lecture:**
```sql
-- Les collaborateurs peuvent voir les collaborateurs du projet
CREATE POLICY "Collaborators can view project collaborators"
ON project_collaborators FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM project_collaborators 
    WHERE user_id = auth.uid() OR invited_email = (SELECT email FROM users WHERE id = auth.uid())
  )
  OR project_id IN (SELECT id FROM saved_projects WHERE user_id = auth.uid())
);
```

**Écriture:**
```sql
-- Seul le propriétaire peut inviter
CREATE POLICY "Owner can invite collaborators"
ON project_collaborators FOR INSERT
WITH CHECK (
  project_id IN (SELECT id FROM saved_projects WHERE user_id = auth.uid())
);
```

---

## 🔌 API Backend

### Endpoints

**Base URL:** `/api/collaboration`

#### 1. Inviter un Collaborateur

```http
POST /api/collaboration/invite
Content-Type: application/json

{
  "projectId": "uuid",
  "email": "user@example.com",
  "role": "viewer",
  "invitedBy": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "project_id": "uuid",
    "invited_email": "user@example.com",
    "role": "viewer",
    "status": "accepted"
  },
  "message": "Collaborateur ajouté avec succès"
}
```

**Logique:**
- Vérifie que `invitedBy` est propriétaire
- Si email existe dans `users` → status `accepted`
- Sinon → status `pending` + email notification (TODO)

#### 2. Liste des Collaborateurs

```http
GET /api/collaboration/collaborators/:projectId
```

**Response:**
```json
{
  "success": true,
  "collaborators": [
    {
      "id": "uuid",
      "invited_email": "user@example.com",
      "role": "editor",
      "status": "accepted",
      "user": {
        "full_name": "John Doe",
        "avatar_url": "https://..."
      },
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### 3. Retirer un Collaborateur

```http
DELETE /api/collaboration/remove/:collaboratorId
Content-Type: application/json

{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Collaborateur retiré"
}
```

#### 4. Ajouter un Commentaire

```http
POST /api/collaboration/comments
Content-Type: application/json

{
  "projectId": "uuid",
  "userId": "uuid",
  "commentText": "Super idée !",
  "parentCommentId": "uuid" // Optionnel
}
```

**Response:**
```json
{
  "success": true,
  "comment": {
    "id": "uuid",
    "comment_text": "Super idée !",
    "user": {
      "full_name": "John Doe",
      "avatar_url": "https://..."
    },
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

#### 5. Liste des Commentaires

```http
GET /api/collaboration/comments/:projectId
```

**Response:**
```json
{
  "success": true,
  "comments": [
    {
      "id": "uuid",
      "comment_text": "Super idée !",
      "user": {
        "full_name": "John Doe"
      },
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### 6. Ajouter un Document/Vision

```http
POST /api/collaboration/documents
Content-Type: application/json

{
  "projectId": "uuid",
  "userId": "uuid",
  "documentType": "vision",
  "visionText": "Je vois ce projet comme...",
  "description": "Ma vision stratégique"
}
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "document_type": "vision",
    "vision_text": "Je vois ce projet comme...",
    "user": {
      "full_name": "John Doe"
    },
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Effet secondaire:**
- Met à jour `saved_projects.cumulative_context`
- Ajoute la vision au contexte cumulé
- Timestamp `context_updated_at`

#### 7. Liste des Documents

```http
GET /api/collaboration/documents/:projectId
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "document_type": "vision",
      "vision_text": "...",
      "user": {
        "full_name": "John Doe"
      },
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## 🎨 Composants Frontend

### `ProjectCollaboration.tsx`

Composant principal avec 3 onglets.

**Props:**
```typescript
interface ProjectCollaborationProps {
  projectId: string
  userId: string
  isOwner: boolean
}
```

**Usage:**
```tsx
import ProjectCollaboration from '@/components/ProjectCollaboration'

<ProjectCollaboration
  projectId={project.id}
  userId={user.id}
  isOwner={project.user_id === user.id}
/>
```

### Onglet 1: Équipe

**Fonctionnalités:**
- Formulaire invitation (si propriétaire)
- Liste des collaborateurs
- Badge rôle (Propriétaire/Éditeur/Lecteur)
- Badge statut (En attente)
- Bouton retirer (si propriétaire)

**UI:**
```tsx
{isOwner && (
  <div className="bg-blue-500/10 border border-blue-500/30">
    <input type="email" placeholder="email@exemple.com" />
    <select>
      <option value="viewer">Lecteur</option>
      <option value="editor">Éditeur</option>
    </select>
    <button>Inviter</button>
  </div>
)}

<div className="space-y-2">
  {collaborators.map(collab => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar>{collab.user?.full_name[0]}</Avatar>
        <div>
          <div>{collab.user?.full_name || collab.invited_email}</div>
          <div className="text-xs">{collab.role} • {collab.status}</div>
        </div>
      </div>
      {isOwner && <button onClick={remove}>Retirer</button>}
    </div>
  ))}
</div>
```

### Onglet 2: Commentaires

**Fonctionnalités:**
- Zone de texte pour nouveau commentaire
- Bouton publier
- Fil de commentaires chronologique
- Avatar + nom + date

**UI:**
```tsx
<div className="bg-white/5 border border-white/10">
  <textarea
    placeholder="Ajouter un commentaire..."
    rows={3}
  />
  <button onClick={handlePostComment}>
    <Send /> Publier
  </button>
</div>

<div className="space-y-3">
  {comments.map(comment => (
    <div className="bg-white/5 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Avatar>{comment.user.full_name[0]}</Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span>{comment.user.full_name}</span>
            <span className="text-xs">{formatDate(comment.created_at)}</span>
          </div>
          <p>{comment.comment_text}</p>
        </div>
      </div>
    </div>
  ))}
</div>
```

### Onglet 3: Documents

**Fonctionnalités:**
- Zone de texte pour vision
- Bouton "Ajouter au contexte"
- Liste des documents/visions partagés
- Icônes par type (💡 Vision, 🖼️ Image, 📄 Document)

**UI:**
```tsx
<div className="bg-purple-500/10 border border-purple-500/30">
  <div className="flex items-center gap-2">
    <Lightbulb className="text-purple-400" />
    <h4>Partager votre vision</h4>
  </div>
  <textarea
    placeholder="Décrivez votre vision pour enrichir le contexte du projet..."
    rows={4}
  />
  <button onClick={handleAddVision}>
    Ajouter au contexte
  </button>
</div>

<div className="space-y-2">
  {documents.map(doc => (
    <div className="bg-white/5 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          {doc.document_type === 'vision' ? <Lightbulb /> : <FileText />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span>{doc.user.full_name}</span>
            <span className="text-xs">{formatDate(doc.created_at)}</span>
          </div>
          {doc.vision_text && <p>{doc.vision_text}</p>}
          {doc.file_name && <div>{doc.file_name}</div>}
        </div>
      </div>
    </div>
  ))}
</div>
```

---

## 🔄 Workflow Utilisateur

### Scénario 1: Inviter un Collaborateur

```
1. User A (propriétaire) ouvre projet
   ↓
2. Clique onglet "Équipe"
   ↓
3. Entre email de User B
   ↓
4. Sélectionne rôle "Éditeur"
   ↓
5. Clique "Inviter"
   ↓
6. Backend vérifie si User B existe
   ↓
7a. Si existe → Status "accepted" (accès immédiat)
7b. Si n'existe pas → Status "pending" (email envoyé)
   ↓
8. User A voit User B dans la liste
   ↓
9. User B peut maintenant voir le projet
```

### Scénario 2: Ajouter un Commentaire

```
1. User B (collaborateur) ouvre projet
   ↓
2. Clique onglet "Commentaires"
   ↓
3. Tape son commentaire
   ↓
4. Clique "Publier"
   ↓
5. Commentaire ajouté en DB
   ↓
6. Apparaît dans le fil
   ↓
7. Tous les collaborateurs voient le commentaire
```

### Scénario 3: Partager une Vision

```
1. User C (collaborateur) a une idée
   ↓
2. Clique onglet "Documents"
   ↓
3. Tape sa vision dans la zone de texte
   ↓
4. Clique "Ajouter au contexte"
   ↓
5. Vision sauvegardée dans project_shared_documents
   ↓
6. Contexte cumulé du projet mis à jour
   ↓
7. Vision visible par tous les collaborateurs
   ↓
8. Peut être utilisée par IA pour générer contenu
```

---

## 🔐 Permissions

### Matrice des Permissions

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| Voir projet | ✅ | ✅ | ✅ |
| Inviter collaborateurs | ✅ | ❌ | ❌ |
| Retirer collaborateurs | ✅ | ❌ | ❌ |
| Modifier projet | ✅ | ✅ | ❌ |
| Ajouter commentaires | ✅ | ✅ | ✅ |
| Ajouter documents | ✅ | ✅ | ❌ |
| Supprimer projet | ✅ | ❌ | ❌ |

### Vérifications Backend

**Exemple: Inviter un collaborateur**
```javascript
// Vérifier que l'utilisateur est le propriétaire
const { data: project } = await supabase
  .from('saved_projects')
  .select('user_id')
  .eq('id', projectId)
  .single()

if (project.user_id !== invitedBy) {
  return res.status(403).json({ 
    error: 'Seul le propriétaire peut inviter' 
  })
}
```

---

## 🔗 Intégration

### Dans une Page de Projet

```tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import ProjectCollaboration from '@/components/ProjectCollaboration'

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const [project, setProject] = useState(null)

  useEffect(() => {
    // Charger le projet
    loadProject(params.id)
  }, [params.id])

  if (!project || !user) return <div>Chargement...</div>

  const isOwner = project.user_id === user.id

  return (
    <div className="container mx-auto p-6">
      {/* Header du projet */}
      <div className="mb-8">
        <h1>{project.proposition_titre}</h1>
        <p>{project.proposition_description}</p>
      </div>

      {/* Section Collaboration */}
      <ProjectCollaboration
        projectId={project.id}
        userId={user.id}
        isOwner={isOwner}
      />
    </div>
  )
}
```

### Dans un Modal

```tsx
<Modal isOpen={showCollaboration} onClose={() => setShowCollaboration(false)}>
  <ProjectCollaboration
    projectId={selectedProject.id}
    userId={user.id}
    isOwner={selectedProject.user_id === user.id}
  />
</Modal>
```

---

## 🚀 Déploiement

### Checklist

1. ✅ Créer tables Supabase (migration appliquée)
2. ✅ Configurer politiques RLS
3. ✅ Déployer backend avec routes `/api/collaboration/*`
4. ✅ Ajouter composant `ProjectCollaboration.tsx`
5. ⏳ Intégrer dans pages de projets
6. ⏳ Tester workflow complet
7. ⏳ Configurer emails d'invitation (Phase 2)

### Variables d'Environnement

```bash
# Backend
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

---

## 📈 Évolutions Futures

### Phase 2: Notifications

- Email d'invitation avec lien d'acceptation
- Notifications push nouveaux commentaires
- Notifications nouveaux documents
- Digest hebdomadaire activité

### Phase 3: Permissions Avancées

- Rôles personnalisés
- Permissions granulaires par fonctionnalité
- Groupes de collaborateurs
- Modération des commentaires

### Phase 4: Collaboration Temps Réel

- WebSocket pour commentaires live
- Indicateurs "utilisateur en train d'écrire"
- Curseurs collaboratifs
- Synchronisation temps réel

### Phase 5: Analytics

- Statistiques de collaboration
- Graphes d'activité
- Contributions par membre
- Rapports d'engagement

---

## 🧪 Tests

### Test 1: Invitation Basique

```bash
# 1. Créer projet
# 2. Inviter user@example.com (rôle: viewer)
# 3. Vérifier status: accepted si user existe
# 4. Vérifier user peut voir projet
# 5. Vérifier user ne peut pas modifier
```

### Test 2: Commentaires

```bash
# 1. User A ajoute commentaire
# 2. User B voit commentaire
# 3. User B répond
# 4. Vérifier ordre chronologique
# 5. Vérifier auteurs corrects
```

### Test 3: Documents

```bash
# 1. User A ajoute vision
# 2. Vérifier apparaît dans liste
# 3. Vérifier contexte cumulé mis à jour
# 4. User B voit vision
# 5. Vérifier timestamp correct
```

### Test 4: Permissions

```bash
# 1. User B (viewer) tente d'inviter → Erreur 403
# 2. User B tente de retirer collaborateur → Erreur 403
# 3. User A (owner) retire User B → Succès
# 4. User B ne voit plus projet
```

---

## 📚 Ressources

**Fichiers:**
- Backend: `backend/routes/collaboration.js`
- Frontend: `frontend/src/components/ProjectCollaboration.tsx`
- Migration: Supabase SQL Editor

**Documentation:**
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)

---

## ✅ Résumé

Le système de collaboration permet à plusieurs utilisateurs de travailler ensemble sur un projet avec:

- **Gestion d'équipe** complète (invitations, rôles, permissions)
- **Communication** via commentaires
- **Partage de ressources** (documents, visions)
- **Contexte enrichi** pour l'IA
- **Sécurité** via RLS Supabase
- **UX moderne** avec animations

Prêt pour production ! 🚀
