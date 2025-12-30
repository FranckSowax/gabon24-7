# 🔄 MIGRATION DES CRÉDITS - EXPLICATION DES 144 CRÉDITS

## 📊 D'OÙ VENAIENT LES 144 CRÉDITS ?

### **Ancien système (UserProfileWidget.tsx)**

Les crédits provenaient de l'**API backend Express.js** :

```typescript
// frontend/src/components/widgets/UserProfileWidget.tsx (ligne 55-62)
const url = `${API_URL}/api/credits/stats?type=balance&userId=${userId}`
const res = await fetch(url)
const json = await res.json()
const total = json?.balance?.total_balance  // ← Les 144 crédits
```

### **Backend Express.js (server.js)**

```javascript
// backend/server.js (ligne 586-607)
app.get('/api/credits/stats', async (req, res) => {
  const { data, error } = await supabase
    .from('user_credits')           // ← TABLE user_credits
    .select('balance, bonus_balance')
    .eq('user_id', userId)
    .single();

  const bal = Number(data?.balance || 0);        // Ex: 100
  const bonus = Number(data?.bonus_balance || 0); // Ex: 44
  const total = bal + bonus;                      // Total: 144

  res.json({
    balance: {
      balance: bal,
      bonus_balance: bonus,
      total_balance: total,  // ← 144 AFFICHÉ
    }
  });
});
```

---

## 🗄️ DEUX SYSTÈMES DE STOCKAGE

### **1. ANCIEN SYSTÈME** (Backend Express.js)

**Table** : `user_credits`

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | UUID | ID utilisateur |
| `balance` | INTEGER | Crédits achetés |
| `bonus_balance` | INTEGER | Crédits bonus |

**Total affiché** : `balance + bonus_balance`

**Exemple** :
- `balance` = 100
- `bonus_balance` = 44
- **Total affiché** = 144

---

### **2. NOUVEAU SYSTÈME** (creditManager.ts)

**Table** : `users`

| Colonne | Type | Description |
|---------|------|-------------|
| `credits_balance` | INTEGER | Total des crédits |

**Source** : Directement depuis Supabase sans passer par le backend Express.js

**Exemple** :
- `credits_balance` = 144 (tout dans une seule colonne)

---

## 🔄 POURQUOI LA MIGRATION EST NÉCESSAIRE

### **Problème**

Les utilisateurs existants ont leurs crédits dans `user_credits` (ancien système) mais le nouveau widget Sidebar lit depuis `users.credits_balance`.

**Résultat** : Le solde affiché sera **0** au lieu de **144** !

### **Solution**

Migrer les données de `user_credits` vers `users.credits_balance`.

---

## 📝 SCRIPT DE MIGRATION SQL

### **Étape 1 : Vérifier les données existantes**

```sql
-- Voir les crédits actuels dans user_credits
SELECT 
  user_id,
  balance,
  bonus_balance,
  (balance + bonus_balance) as total
FROM user_credits
ORDER BY (balance + bonus_balance) DESC
LIMIT 10;

-- Voir les crédits actuels dans users
SELECT 
  id,
  email,
  credits_balance
FROM users
WHERE credits_balance IS NOT NULL
LIMIT 10;
```

---

### **Étape 2 : Migrer les données**

```sql
-- Mettre à jour users.credits_balance avec le total de user_credits
UPDATE users
SET credits_balance = subquery.total
FROM (
  SELECT 
    user_id,
    COALESCE(balance, 0) + COALESCE(bonus_balance, 0) as total
  FROM user_credits
) AS subquery
WHERE users.id = subquery.user_id;
```

---

### **Étape 3 : Vérifier la migration**

```sql
-- Comparer les deux tables
SELECT 
  u.email,
  uc.balance as ancien_balance,
  uc.bonus_balance as ancien_bonus,
  (uc.balance + uc.bonus_balance) as ancien_total,
  u.credits_balance as nouveau_total,
  CASE 
    WHEN (uc.balance + uc.bonus_balance) = u.credits_balance THEN '✅ OK'
    ELSE '❌ DIFFÉRENT'
  END as status
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id
WHERE uc.user_id IS NOT NULL
ORDER BY u.email;
```

---

## 🚀 SCRIPT DE MIGRATION AUTOMATIQUE

### **Option A : Depuis Supabase SQL Editor**

1. Aller sur [https://app.supabase.com](https://app.supabase.com)
2. Sélectionner votre projet
3. SQL Editor
4. Copier-coller le script ci-dessous
5. Run

```sql
-- Migration complète des crédits
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Migrer les crédits
  UPDATE users
  SET credits_balance = subquery.total
  FROM (
    SELECT 
      user_id,
      COALESCE(balance, 0) + COALESCE(bonus_balance, 0) as total
    FROM user_credits
  ) AS subquery
  WHERE users.id = subquery.user_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RAISE NOTICE '✅ Migration terminée : % utilisateurs mis à jour', affected_rows;
END $$;

-- Vérifier le résultat
SELECT 
  COUNT(*) as total_migrated,
  SUM(credits_balance) as total_credits
FROM users
WHERE credits_balance > 0;
```

---

### **Option B : Script Node.js**

```javascript
// migration-credits.js
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ← Clé service role
)

async function migrateCredits() {
  console.log('🔄 Début de la migration des crédits...')
  
  // 1. Récupérer tous les user_credits
  const { data: userCredits, error: fetchError } = await supabase
    .from('user_credits')
    .select('user_id, balance, bonus_balance')
  
  if (fetchError) {
    console.error('❌ Erreur récupération:', fetchError)
    return
  }
  
  console.log(`📊 ${userCredits.length} utilisateurs à migrer`)
  
  // 2. Migrer chaque utilisateur
  let migrated = 0
  for (const credit of userCredits) {
    const total = (credit.balance || 0) + (credit.bonus_balance || 0)
    
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits_balance: total })
      .eq('id', credit.user_id)
    
    if (updateError) {
      console.error(`❌ Erreur pour ${credit.user_id}:`, updateError)
    } else {
      migrated++
      console.log(`✅ ${migrated}/${userCredits.length} - User ${credit.user_id}: ${total} crédits`)
    }
  }
  
  console.log(`\n✅ Migration terminée : ${migrated} utilisateurs migrés`)
}

migrateCredits()
```

**Usage** :
```bash
node backend/migration-credits.js
```

---

## 🔍 VÉRIFICATION POST-MIGRATION

### **1. Vérifier le widget Sidebar**

Après la migration, le widget Sidebar devrait afficher :
- **Avant** : 0 crédits (ou rien)
- **Après** : 144 crédits (ou le total correct)

### **2. Requête de contrôle**

```sql
SELECT 
  u.email,
  u.credits_balance,
  uc.balance,
  uc.bonus_balance,
  (uc.balance + uc.bonus_balance) as total_ancien
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id
WHERE u.credits_balance IS NOT NULL
ORDER BY u.credits_balance DESC
LIMIT 20;
```

---

## ⚠️ IMPORTANT

### **Après la migration**

1. **Mettre à jour les transactions** : Les futures transactions doivent utiliser `users.credits_balance` et non `user_credits`

2. **Désactiver l'ancien système** : Commentez les routes backend qui utilisent `user_credits`

3. **Table user_credits** : Vous pouvez la garder pour l'historique ou la supprimer après vérification

---

## 🎯 RÉSUMÉ

### **D'où venaient les 144 crédits ?**

- ✅ Table `user_credits` dans Supabase
- ✅ Colonne `balance` (ex: 100) + `bonus_balance` (ex: 44) = 144
- ✅ API backend Express.js `/api/credits/stats`
- ✅ Widget `UserProfileWidget.tsx` (ancien)

### **Nouveau système**

- ✅ Table `users` colonne `credits_balance`
- ✅ Widget Sidebar avec `creditManager.ts`
- ✅ Synchronisation automatique toutes les 30s
- ✅ Transactions enregistrées dans table `transactions`

### **Action requise**

🔴 **MIGRER LES DONNÉES** avec le script SQL ci-dessus pour que les utilisateurs retrouvent leur solde !

---

## 📞 SUPPORT

Si la migration échoue :
1. Vérifier les permissions Supabase
2. Vérifier que la colonne `users.credits_balance` existe
3. Vérifier que la table `user_credits` contient des données
4. Contacter le support si nécessaire

**La migration est SAFE** : elle ne fait que copier les données, elle ne supprime rien !
