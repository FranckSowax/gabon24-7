# 🔐 GUIDE DE PERSISTANCE DE SESSION

## 📋 PROBLÈME RÉSOLU

**Avant** : La session utilisateur était perdue après un rafraîchissement de page (F5)

**Après** : La session est maintenue de manière permanente grâce à la persistance Supabase

---

## ✅ MODIFICATIONS APPLIQUÉES

### **1. Configuration Supabase (déjà en place)**

```typescript
// frontend/src/lib/supabase.ts
createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // ✅ Session persistée dans localStorage
    autoRefreshToken: true,       // ✅ Token rafraîchi automatiquement
    detectSessionInUrl: true,     // ✅ Détection session dans URL
    flowType: 'pkce',            // ✅ Flux sécurisé
    storageKey: 'gabon24-7-auth', // ✅ Clé unique localStorage
    storage: window.localStorage  // ✅ Utilise localStorage du navigateur
  }
})
```

### **2. Cache prolongé à 24 heures**

```typescript
// Avant: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

// Après: 24 heures
const CACHE_DURATION = 24 * 60 * 60 * 1000
```

### **3. Priorité à la session Supabase**

**Avant** : Vérifiait d'abord le cache local (5 min), puis Supabase

**Après** : Vérifie d'abord Supabase (source de vérité), puis cache en fallback

```typescript
// 1. Vérifier session Supabase (persistée automatiquement)
const { data: { session } } = await getCurrentSession()

// 2. Si session valide, l'utiliser
if (session?.user) {
  setUser(session.user)
  setCachedSession(session.user) // Synchroniser cache
}

// 3. Sinon, fallback sur cache local
else {
  const cachedUser = getCachedSession()
  if (cachedUser) {
    setUser(cachedUser)
  }
}
```

### **4. Nettoyage du cache à la déconnexion**

```typescript
function setCachedSession(user: User | null) {
  if (user) {
    // Sauvegarder si connecté
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      user,
      timestamp: Date.now()
    }))
  } else {
    // Supprimer si déconnecté
    localStorage.removeItem(SESSION_CACHE_KEY)
  }
}
```

---

## 🔍 COMMENT ÇA FONCTIONNE

### **LocalStorage Supabase**

Supabase stocke automatiquement la session dans le localStorage du navigateur :

```
localStorage:
  └── gabon24-7-auth.0.token = {
        access_token: "eyJhbGc...",
        refresh_token: "...",
        expires_at: 1234567890,
        user: { id: "...", email: "..." }
      }
```

Cette session est **automatiquement restaurée** à chaque rafraîchissement de page.

---

### **Flux de persistance**

```
┌─────────────────────────────────────────────┐
│ 1. CONNEXION INITIALE                       │
├─────────────────────────────────────────────┤
│ User se connecte                            │
│   ↓                                         │
│ Supabase crée session                       │
│   ↓                                         │
│ Session sauvegardée dans localStorage       │
│   • gabon24-7-auth.0.token                  │
│   • gabon24_session_cache                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 2. RAFRAÎCHISSEMENT PAGE (F5)               │
├─────────────────────────────────────────────┤
│ Page se recharge                            │
│   ↓                                         │
│ AuthContext.useEffect() s'exécute           │
│   ↓                                         │
│ getCurrentSession() lit localStorage        │
│   ↓                                         │
│ Session Supabase trouvée ✅                 │
│   ↓                                         │
│ User restauré automatiquement               │
│   ↓                                         │
│ Widget Sidebar affiche profil               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 3. RAFRAÎCHISSEMENT AUTOMATIQUE TOKEN       │
├─────────────────────────────────────────────┤
│ Token expire (après 1h par défaut)          │
│   ↓                                         │
│ Supabase détecte expiration                 │
│   ↓                                         │
│ autoRefreshToken: true                      │
│   ↓                                         │
│ Nouveau token obtenu automatiquement        │
│   ↓                                         │
│ Session reste active                        │
└─────────────────────────────────────────────┘
```

---

## 🧪 TESTS DE PERSISTANCE

### **Test 1 : Rafraîchissement simple**

1. Se connecter avec email/mot de passe
2. Vérifier que le profil s'affiche
3. **Rafraîchir la page (F5)**
4. ✅ Le profil doit toujours être affiché
5. ✅ Les crédits doivent être visibles

### **Test 2 : Fermeture/réouverture onglet**

1. Se connecter
2. Fermer l'onglet
3. Ouvrir un nouvel onglet
4. Aller sur https://gabon24-7.netlify.app
5. ✅ La session doit être maintenue

### **Test 3 : Fermeture/réouverture navigateur**

1. Se connecter
2. Fermer complètement le navigateur
3. Rouvrir le navigateur
4. Aller sur l'application
5. ✅ La session doit être maintenue

### **Test 4 : Déconnexion**

1. Se connecter
2. Cliquer sur "Déconnexion"
3. ✅ Le profil disparaît
4. Rafraîchir la page
5. ✅ L'utilisateur reste déconnecté

---

## 🔒 DURÉE DE VIE DE LA SESSION

### **Par défaut (Supabase)**

- **Access Token** : 1 heure
- **Refresh Token** : 7 jours (peut être configuré)
- **Auto-refresh** : Activé (renouvelle automatiquement)

### **Résultat**

La session reste active tant que :
- ✅ Le refresh token est valide (7 jours par défaut)
- ✅ L'utilisateur ne se déconnecte pas manuellement
- ✅ Le token est rafraîchi avant expiration

**En pratique** : La session peut durer **indéfiniment** grâce au rafraîchissement automatique !

---

## 🛠️ CONFIGURATION AVANCÉE

### **Modifier la durée du refresh token**

Dans le dashboard Supabase :
```
Settings → Auth → JWT expiry limit
- Access token: 3600s (1h)
- Refresh token: 604800s (7 jours)
```

### **Activer "Remember me"**

Pour une session encore plus longue :
```typescript
await supabase.auth.signInWithPassword({
  email,
  password,
  options: {
    persistSession: true, // Garder actif
  }
})
```

---

## 📊 VÉRIFIER LA SESSION

### **Dans la console navigateur**

```javascript
// Voir la session Supabase
JSON.parse(localStorage.getItem('gabon24-7-auth.0.token'))

// Voir le cache custom
JSON.parse(localStorage.getItem('gabon24_session_cache'))
```

### **Dans le code**

```typescript
import { supabase } from '@/lib/supabase'

// Vérifier la session actuelle
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
console.log('User:', session?.user)
console.log('Expires at:', new Date(session?.expires_at * 1000))
```

---

## 🚨 DÉPANNAGE

### **Problème : Session perdue après rafraîchissement**

**Causes possibles** :
1. `persistSession: false` dans la config Supabase
2. LocalStorage désactivé dans le navigateur
3. Mode navigation privée
4. Extension bloquant localStorage

**Solutions** :
1. Vérifier `supabase.ts` : `persistSession: true` ✅
2. Tester dans un navigateur normal (pas privé)
3. Désactiver les extensions de confidentialité
4. Vérifier les cookies/storage dans DevTools

---

### **Problème : Session expirée trop rapidement**

**Cause** : Refresh token expiré

**Solution** :
1. Augmenter la durée du refresh token dans Supabase Dashboard
2. Vérifier que `autoRefreshToken: true`
3. Vérifier les logs console pour voir les erreurs

---

### **Problème : Multiples sessions**

**Cause** : Plusieurs onglets avec différentes sessions

**Solution** : Supabase gère automatiquement la synchronisation entre onglets grâce à `storage` events.

---

## ✅ CHECKLIST DE VÉRIFICATION

- [x] `persistSession: true` dans `supabase.ts`
- [x] `autoRefreshToken: true` dans `supabase.ts`
- [x] `storageKey` unique défini
- [x] Cache prolongé à 24h dans `AuthContext.tsx`
- [x] Priorité donnée à la session Supabase
- [x] Nettoyage cache à la déconnexion
- [x] Listener `onAuthStateChange` actif
- [x] LocalStorage disponible dans le navigateur

---

## 🎯 RÉSUMÉ

**La session est maintenant persistante grâce à :**

1. ✅ **Supabase persistSession** : Session sauvegardée automatiquement
2. ✅ **Auto-refresh token** : Token renouvelé automatiquement
3. ✅ **Cache 24h** : Fallback rapide en cas d'erreur
4. ✅ **Priorité Supabase** : Source de vérité pour la session
5. ✅ **Listener actif** : Synchronisation en temps réel

**Résultat** : 
- 🎉 Session maintenue après F5
- 🎉 Session maintenue après fermeture onglet
- 🎉 Session maintenue après fermeture navigateur (jusqu'à 7 jours)
- 🎉 Rafraîchissement automatique du token

**La session ne sera perdue que si l'utilisateur se déconnecte manuellement !**
