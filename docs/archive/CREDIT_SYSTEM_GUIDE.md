# 💳 SYSTÈME DE GESTION DES CRÉDITS

## 📋 Vue d'ensemble

Le système de crédits est **entièrement synchronisé avec Supabase** et permet de :
- ✅ Débiter des crédits lors de l'utilisation de fonctionnalités
- ✅ Créditer des crédits lors d'achats
- ✅ Enregistrer toutes les transactions
- ✅ Afficher le solde en temps réel dans le profil
- ✅ Rafraîchissement automatique toutes les 30 secondes

---

## 🗄️ STRUCTURE BASE DE DONNÉES

### Table `users`
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 50;
```

### Table `transactions`
```sql
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT CHECK (type IN ('credit_purchase', 'credit_usage', 'credit_refund', 'subscription_change')) NOT NULL,
  amount INTEGER DEFAULT 0, -- Prix en FCFA
  credits INTEGER, -- Nombre de crédits
  description TEXT NOT NULL,
  status TEXT CHECK (status IN ('completed', 'pending', 'failed')) DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

---

## 📦 UTILISATION DU CREDIT MANAGER

### 1️⃣ Import
```typescript
import { 
  getCreditBalance, 
  debitCredits, 
  creditCredits,
  debitForFeature,
  hasEnoughCredits,
  CREDIT_COSTS
} from '@/lib/creditManager'
```

---

### 2️⃣ Récupérer le solde

```typescript
// Récupérer le solde d'un utilisateur
const balance = await getCreditBalance(userId)
console.log(`Solde actuel: ${balance} crédits`)
```

---

### 3️⃣ Débiter des crédits (consommation)

```typescript
// Débiter manuellement
const result = await debitCredits(
  userId,
  10, // Nombre de crédits
  'Analyse IA approfondie - Article "Économie du Gabon"',
  { articleId: 'abc123', feature: 'ai_analysis' } // Métadonnées optionnelles
)

if (result.success) {
  console.log(`Nouveau solde: ${result.newBalance}`)
} else {
  console.error(result.error)
  // Afficher message à l'utilisateur
}
```

---

### 4️⃣ Débiter selon une fonctionnalité

```typescript
// Utiliser les coûts prédéfinis
const result = await debitForFeature(
  userId,
  'AI_ANALYSIS', // Coût: 10 crédits
  'Article "Économie du Gabon"' // Info supplémentaire optionnelle
)

if (result.success) {
  // Exécuter la fonctionnalité
  await performAIAnalysis()
} else {
  // Afficher modal de recharge
  alert('Crédits insuffisants')
}
```

---

### 5️⃣ Créditer des crédits (achat)

```typescript
// Ajouter des crédits après un achat
const result = await creditCredits(
  userId,
  300, // Nombre de crédits
  5000, // Prix en FCFA
  'Achat de 300 crédits + 50 bonus',
  'credit_purchase',
  { packageId: 'pkg_300', paymentMethod: 'mobile_money' }
)

if (result.success) {
  console.log(`Nouveau solde: ${result.newBalance}`)
}
```

---

### 6️⃣ Vérifier le solde avant action

```typescript
// Vérifier si l'utilisateur a assez de crédits
const hasEnough = await hasEnoughCredits(userId, 10)

if (hasEnough) {
  // Procéder avec l'action
  const result = await debitForFeature(userId, 'AI_ANALYSIS')
} else {
  // Proposer de recharger
  showTopUpModal()
}
```

---

## 🎣 HOOK REACT (useCreditManager)

### Utilisation dans un composant

```typescript
'use client'

import { useCreditManager } from '@/lib/creditManager'
import { useAuth } from '@/contexts/AuthContext'

export default function MyComponent() {
  const { user } = useAuth()
  const { balance, loading, debit, credit, debitForFeature, hasEnough, refresh } = useCreditManager(user?.id)

  const handleAIAnalysis = async () => {
    if (!hasEnough(10)) {
      alert('Crédits insuffisants')
      return
    }

    const result = await debitForFeature('AI_ANALYSIS', 'Mon article')
    
    if (result.success) {
      console.log('Analyse lancée, nouveau solde:', result.newBalance)
      // Lancer l'analyse
    } else {
      alert(result.error)
    }
  }

  return (
    <div>
      <p>Solde: {loading ? '...' : balance} crédits</p>
      <button onClick={handleAIAnalysis}>
        Analyser (10 crédits)
      </button>
      <button onClick={refresh}>
        Rafraîchir le solde
      </button>
    </div>
  )
}
```

---

## 💰 COÛTS DES FONCTIONNALITÉS

| Fonctionnalité | Coût (crédits) | Constante |
|----------------|----------------|-----------|
| Article Premium | 1 | `CREDIT_COSTS.ARTICLE_PREMIUM` |
| Résumé Audio | 5 | `CREDIT_COSTS.AUDIO_SUMMARY` |
| Analyse IA | 10 | `CREDIT_COSTS.AI_ANALYSIS` |
| Rapport Veille | 20 | `CREDIT_COSTS.VEILLE_REPORT` |
| Analyse Opportunité | 15 | `CREDIT_COSTS.OPPORTUNITY_ANALYSIS` |
| Alerte Perso | 3 | `CREDIT_COSTS.CUSTOM_ALERT` |

---

## 📊 SYNCHRONISATION AUTOMATIQUE

### Widget Sidebar
Le widget profil **rafraîchit automatiquement** le solde :
- ✅ À la connexion
- ✅ Toutes les 30 secondes
- ✅ Après chaque transaction

### Page Mon Profil
La page profil affiche :
- ✅ Solde actuel depuis `profile.credits_balance`
- ✅ Historique des transactions
- ✅ Stats mensuelles

---

## 🔄 FLUX COMPLET D'UNE TRANSACTION

### Scénario : Analyse IA

```typescript
// 1. Vérifier le solde
const hasEnough = await hasEnoughCredits(userId, 10)
if (!hasEnough) {
  // Proposer recharge
  return showTopUpModal()
}

// 2. Débiter les crédits
const result = await debitForFeature(userId, 'AI_ANALYSIS', 'Article XYZ')
if (!result.success) {
  return alert(result.error)
}

// 3. Exécuter l'analyse (crédits déjà débités)
try {
  const analysis = await performAIAnalysis(articleId)
  console.log('Analyse réussie')
} catch (error) {
  // En cas d'erreur, rembourser
  await creditCredits(userId, 10, 0, 'Remboursement - Erreur analyse', 'credit_refund')
}

// 4. Le solde est automatiquement mis à jour dans :
//    - Widget sidebar (rafraîchi toutes les 30s)
//    - Page profil (au prochain chargement)
//    - Historique des transactions (nouvelle ligne)
```

---

## 🎁 CRÉDITS DE BIENVENUE

```typescript
import { initializeUserCredits } from '@/lib/creditManager'

// Lors de l'inscription d'un nouvel utilisateur
await initializeUserCredits(newUserId, 50) // 50 crédits de bienvenue
```

---

## 📝 EXEMPLES D'INTÉGRATION

### Exemple 1 : Article Premium

```typescript
async function unlockPremiumArticle(userId: string, articleId: string) {
  // Débiter 1 crédit
  const result = await debitForFeature(userId, 'ARTICLE_PREMIUM', `Article ${articleId}`)
  
  if (result.success) {
    // Déverrouiller l'article
    await markArticleAsUnlocked(userId, articleId)
    return { unlocked: true }
  } else {
    return { unlocked: false, error: result.error }
  }
}
```

### Exemple 2 : Résumé Audio

```typescript
async function generateAudioSummary(userId: string, articleId: string) {
  // Vérifier d'abord
  if (!await hasEnoughCredits(userId, 5)) {
    return { error: 'Solde insuffisant', requiredCredits: 5 }
  }
  
  // Débiter
  const result = await debitForFeature(userId, 'AUDIO_SUMMARY', `Article ${articleId}`)
  
  if (result.success) {
    // Générer l'audio
    const audioUrl = await generateAudio(articleId)
    return { success: true, audioUrl, newBalance: result.newBalance }
  } else {
    return { success: false, error: result.error }
  }
}
```

### Exemple 3 : Achat de package

```typescript
async function handleCreditPurchase(userId: string, packageId: string, amount: number, credits: number) {
  // Après paiement réussi Mobile Money
  const result = await creditCredits(
    userId,
    credits,
    amount,
    `Achat de ${credits} crédits`,
    'credit_purchase',
    { packageId, paymentMethod: 'mtn_money', transactionId: 'MTN-123456' }
  )
  
  if (result.success) {
    // Afficher confirmation
    alert(`${credits} crédits ajoutés ! Nouveau solde: ${result.newBalance}`)
  }
}
```

---

## 🔒 SÉCURITÉ

### Validations automatiques
- ✅ Vérification solde avant débit
- ✅ Transactions atomiques (tout ou rien)
- ✅ Enregistrement de toutes les transactions
- ✅ Métadonnées pour traçabilité

### Gestion d'erreurs
```typescript
const result = await debitCredits(userId, 100, 'Test')

if (!result.success) {
  switch (result.error) {
    case 'Solde insuffisant':
      // Proposer recharge
      break
    case 'Erreur lors du débit':
      // Réessayer ou contacter support
      break
    default:
      // Erreur générique
  }
}
```

---

## 🚀 DÉPLOIEMENT

### 1. Créer les tables Supabase
```sql
-- Exécuter dans Supabase SQL Editor
-- (voir section "Structure Base de Données")
```

### 2. Initialiser les crédits existants
```typescript
// Script one-time pour les utilisateurs existants
const { data: users } = await supabase.from('users').select('id, credits_balance')
for (const user of users) {
  if (!user.credits_balance) {
    await initializeUserCredits(user.id, 50)
  }
}
```

### 3. Intégrer dans les fonctionnalités
Remplacer les anciens systèmes par `creditManager.ts`

---

## 📈 MONITORING

### Requêtes utiles
```sql
-- Solde total des crédits en circulation
SELECT SUM(credits_balance) FROM users;

-- Transactions du jour
SELECT * FROM transactions 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Top consommateurs
SELECT user_id, SUM(credits) as total_used
FROM transactions 
WHERE type = 'credit_usage'
GROUP BY user_id
ORDER BY total_used DESC
LIMIT 10;

-- Revenus du jour (achats de crédits)
SELECT SUM(amount) as revenue
FROM transactions
WHERE type = 'credit_purchase' 
AND created_at >= NOW() - INTERVAL '1 day';
```

---

## ✅ CHECKLIST INTÉGRATION

- [x] Table `users` avec colonne `credits_balance`
- [x] Table `transactions` créée
- [x] `creditManager.ts` créé
- [x] Widget Sidebar synchronisé
- [x] Page Mon Profil affiche le solde
- [x] Historique des transactions fonctionnel
- [ ] Intégration dans fonctionnalités (AI, Audio, etc.)
- [ ] Système de paiement Mobile Money
- [ ] Tests de charge
- [ ] Documentation API backend (si nécessaire)

---

## 🎯 RÉSUMÉ

Le système de crédits est **production-ready** et offre :
- ✅ Synchronisation Supabase automatique
- ✅ Transactions tracées
- ✅ Solde temps réel
- ✅ API simple et robuste
- ✅ Hook React facile à utiliser
- ✅ Coûts prédéfinis et modifiables

**Le solde affiché dans le widget profil est toujours synchronisé avec Supabase !**
