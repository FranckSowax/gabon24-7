# 🔐 Guide d'Authentification JWT - Gabon 24/7

## Vue d'ensemble

Le système d'authentification utilise les tokens JWT de Supabase pour sécuriser les routes backend.

---

## Middleware disponibles

### 1. `requireAuth` - Authentification requise
Vérifie que l'utilisateur est connecté. Ajoute `req.user` avec les infos utilisateur.

```javascript
const { requireAuth } = require('../middleware/auth');

router.get('/my-data', requireAuth, async (req, res) => {
  const userId = req.user.id;    // ID utilisateur
  const email = req.user.email;  // Email
  const role = req.user.role;    // Rôle (user, admin, etc.)
  // ...
});
```

### 2. `requireAdmin` - Admin requis
Vérifie que l'utilisateur est admin (via la table `users`).

```javascript
const { requireAdmin } = require('../middleware/auth');

router.delete('/dangerous-action', requireAdmin, async (req, res) => {
  // Seuls les admins peuvent accéder
  console.log(`Admin ${req.user.email} effectue une action`);
});
```

### 3. `optionalAuth` - Authentification optionnelle
Ajoute `req.user` si un token valide est présent, sinon `req.user = null`.

```javascript
const { optionalAuth } = require('../middleware/auth');

router.get('/articles', optionalAuth, async (req, res) => {
  if (req.user) {
    // Utilisateur connecté - afficher contenu personnalisé
  } else {
    // Visiteur anonyme - afficher contenu public
  }
});
```

### 4. `requireRole(...roles)` - Rôle spécifique requis
Vérifie que l'utilisateur a un des rôles spécifiés.

```javascript
const { requireRole } = require('../middleware/auth');

router.post('/moderate', requireRole('admin', 'moderator'), async (req, res) => {
  // Admins et modérateurs uniquement
});
```

---

## Structure de `req.user`

Après authentification, `req.user` contient :

```javascript
{
  id: "uuid-de-l-utilisateur",
  email: "user@example.com",
  role: "user" | "admin" | "moderator",
  isAdmin: true | false,
  metadata: { /* user_metadata de Supabase */ }
}
```

---

## Côté Frontend

### Envoyer le token dans les requêtes

```typescript
// Récupérer le token Supabase
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Appel API avec token
const response = await fetch(`${API_URL}/api/campaigns/my-campaigns`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Avec axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL
});

// Intercepteur pour ajouter le token automatiquement
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

---

## Configuration

### Variables d'environnement (backend/.env)

```bash
# Le middleware utilise Supabase pour valider les tokens
# Pas besoin de JWT_SECRET si vous utilisez supabase.auth.getUser()
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Codes d'erreur

| Code | Message | Description |
|------|---------|-------------|
| `AUTH_TOKEN_MISSING` | Token manquant | Header Authorization absent |
| `AUTH_TOKEN_INVALID` | Token invalide | Token expiré ou malformé |
| `AUTH_ADMIN_REQUIRED` | Admin requis | L'utilisateur n'est pas admin |
| `AUTH_ROLE_REQUIRED` | Rôle requis | L'utilisateur n'a pas le bon rôle |
| `AUTH_ERROR` | Erreur auth | Erreur serveur lors de la validation |

### Exemple de réponse d'erreur

```json
{
  "success": false,
  "error": "Token invalide ou expiré",
  "code": "AUTH_TOKEN_INVALID"
}
```

---

## Migration depuis les headers manuels

### Avant (❌ Non sécurisé)
```javascript
router.get('/my-data', async (req, res) => {
  const userId = req.headers['x-user-id']; // Facilement falsifiable
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  // ...
});
```

### Après (✅ Sécurisé)
```javascript
const { requireAuth } = require('../middleware/auth');

router.get('/my-data', requireAuth, async (req, res) => {
  const userId = req.user.id; // Vérifié par Supabase
  // ...
});
```

---

## Routes protégées

### Routes utilisateur (requireAuth)
- `GET /api/campaigns/my-campaigns`
- `POST /api/campaigns`
- `GET /api/saved-projects/:userId` (à migrer)
- `POST /api/credits/consume` (à migrer)

### Routes admin (requireAdmin)
- `GET /api/admin/campaigns`
- `POST /api/admin/campaigns/:id/approve`
- `POST /api/admin/campaigns/:id/reject`
- `DELETE /api/admin/campaigns/:id`

---

*Documentation mise à jour le 28 Décembre 2025*
