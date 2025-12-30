# 💎 INSTALLATION DU SYSTÈME DE CRÉDITS PREMIUM

## 📋 Vue d'ensemble

Ce document guide l'installation complète du système de crédits premium pour Gabon 24/7.

---

## ✅ ÉTAPE 1 : Créer les tables Supabase

### Option A : Via Supabase Dashboard (Recommandé)

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet : `ykytsadwfqoyusleoflf`
3. Aller dans **SQL Editor**
4. Cliquer sur **New query**
5. Copier le contenu de `database/create_credit_system_premium.sql`
6. Coller dans l'éditeur
7. Cliquer sur **Run** (ou Ctrl+Enter)

### Option B : Via CLI Supabase

```bash
# Si vous avez Supabase CLI installé
supabase db execute < database/create_credit_system_premium.sql
```

### Vérification

Exécuter cette requête dans SQL Editor :

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'credit%'
ORDER BY table_name;
```

Vous devriez voir :
- ✅ `credit_costs`
- ✅ `credit_packages`
- ✅ `credit_promotions`
- ✅ `credit_transactions`
- ✅ `user_credits`

---

## ✅ ÉTAPE 2 : Vérifier les fonctions Postgres

Exécuter cette requête :

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%credit%'
ORDER BY routine_name;
```

Vous devriez voir :
- ✅ `add_credits`
- ✅ `consume_credits`
- ✅ `get_total_credit_balance`
- ✅ `initialize_user_credits`
- ✅ `refund_credits`

---

## ✅ ÉTAPE 3 : Vérifier les données seed

Exécuter ces requêtes :

```sql
-- Vérifier les packages
SELECT name, credits, bonus_credits, price_xaf 
FROM credit_packages 
WHERE is_active = true
ORDER BY sort_order;

-- Vérifier les coûts des services
SELECT service_name, display_name, cost_credits, category
FROM credit_costs
WHERE is_active = true
ORDER BY category, cost_credits;

-- Vérifier les promotions
SELECT code, type, value, description
FROM credit_promotions
WHERE is_active = true;
```

Résultats attendus :
- ✅ 4 packages (Starter, Standard, Premium, Business)
- ✅ 10 services avec coûts
- ✅ 3 promotions actives

---

## ✅ ÉTAPE 4 : Configurer le backend

### 4.1 Vérifier que la route est ajoutée

Ouvrir `backend/server.js` et vérifier que cette ligne existe :

```javascript
// Routes Credit Premium (Système de crédits premium complet)
const creditsPremiumRoutes = require('./routes/credits-premium');
app.use('/api/credits-premium', creditsPremiumRoutes);
```

✅ **Déjà fait !**

### 4.2 Redémarrer le serveur backend

```bash
cd backend
npm start
```

Ou si vous utilisez PM2 :

```bash
pm2 restart gabon24-7-backend
```

---

## ✅ ÉTAPE 5 : Tester le système

### 5.1 Test automatique complet

```bash
cd backend
node test-credit-system-premium.js
```

Ce script va :
1. ✅ Vérifier que toutes les tables existent
2. ✅ Vérifier les packages de crédits
3. ✅ Vérifier les coûts des services
4. ✅ Initialiser un utilisateur de test
5. ✅ Tester l'ajout de crédits
6. ✅ Tester la consommation de crédits
7. ✅ Vérifier l'historique des transactions
8. ✅ Tester le cas d'erreur (solde insuffisant)
9. ✅ Tester le remboursement
10. ✅ Afficher les statistiques finales
11. ✅ Nettoyer les données de test

### 5.2 Test manuel via API

```bash
# 1. Vérifier les packages
curl http://localhost:3001/api/credits-premium/packages

# 2. Initialiser un utilisateur
curl -X POST http://localhost:3001/api/credits-premium/initialize \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_USER_ID","welcomeBonus":50}'

# 3. Vérifier le solde
curl http://localhost:3001/api/credits-premium/balance/YOUR_USER_ID

# 4. Consommer des crédits
curl -X POST http://localhost:3001/api/credits-premium/consume \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"YOUR_USER_ID",
    "serviceName":"ai_analysis",
    "amount":10,
    "description":"Test analyse IA"
  }'

# 5. Vérifier l'historique
curl http://localhost:3001/api/credits-premium/history/YOUR_USER_ID
```

---

## ✅ ÉTAPE 6 : Déployer sur Railway

### 6.1 Commit et push

```bash
git add .
git commit -m "feat: Système de crédits premium installé"
git push origin main
```

### 6.2 Vérifier le déploiement

Railway va automatiquement :
1. Détecter le push
2. Rebuilder le backend
3. Redémarrer le serveur

Vérifier les logs Railway pour confirmer :
```
✅ Routes Credit Premium chargées
✅ Server started on port 3001
```

### 6.3 Tester en production

```bash
# Remplacer par votre URL Railway
curl https://gabon24-7-production.up.railway.app/api/credits-premium/packages
```

---

## ✅ ÉTAPE 7 : Intégrer dans le frontend (À faire)

### 7.1 Créer les composants

Fichiers à créer :

```
frontend/src/
├── components/
│   └── credits/
│       ├── CreditBalance.tsx       # Affichage du solde
│       ├── CreditPackages.tsx      # Liste des packages
│       ├── CreditHistory.tsx       # Historique des transactions
│       ├── TopUpModal.tsx          # Modal de recharge
│       └── CreditBadge.tsx         # Badge de crédits (existant)
├── hooks/
│   └── useCredits.ts               # Hook pour gérer les crédits
└── lib/
    └── credits-premium.ts          # API client
```

### 7.2 Exemple d'utilisation

```typescript
// Dans un composant
import { useCredits } from '@/hooks/useCredits';

export default function MyComponent() {
  const { balance, consume, isLoading } = useCredits();

  const handleAnalyze = async () => {
    const result = await consume('ai_analysis', 10, 'Analyse article');
    if (result.success) {
      // Lancer l'analyse
    } else {
      // Afficher modal de recharge
    }
  };

  return (
    <div>
      <p>Solde: {balance} crédits</p>
      <button onClick={handleAnalyze}>Analyser (10 crédits)</button>
    </div>
  );
}
```

---

## ✅ ÉTAPE 8 : Configurer les paiements (À faire ultérieurement)

### Mobile Money
- [ ] Intégration MTN Mobile Money
- [ ] Intégration Moov Money
- [ ] Intégration Airtel Money

### Credit Card
- [ ] Intégration Stripe
- [ ] Webhooks de confirmation

---

## 📊 MONITORING

### Requêtes utiles pour le monitoring

```sql
-- Solde total en circulation
SELECT 
  SUM(balance) as total_balance,
  SUM(bonus_balance) as total_bonus,
  COUNT(*) as users_count
FROM user_credits;

-- Revenus du jour
SELECT 
  SUM(price_paid_xaf) as revenue_xaf,
  COUNT(*) as purchases_count
FROM credit_transactions
WHERE type = 'purchase' 
AND created_at >= NOW() - INTERVAL '1 day';

-- Services les plus utilisés
SELECT 
  service_name,
  COUNT(*) as usage_count,
  SUM(ABS(amount)) as total_credits
FROM credit_transactions
WHERE type = 'consume'
AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY service_name
ORDER BY usage_count DESC;

-- Utilisateurs avec solde faible
SELECT 
  user_id,
  balance + bonus_balance as total_balance
FROM user_credits
WHERE (balance + bonus_balance) < 10
ORDER BY total_balance;
```

---

## 🔧 DÉPANNAGE

### Problème : Tables non créées

**Solution :**
1. Vérifier que vous êtes connecté au bon projet Supabase
2. Vérifier que vous avez les droits d'exécution SQL
3. Exécuter le script SQL manuellement section par section

### Problème : Fonctions non trouvées

**Solution :**
```sql
-- Vérifier si les fonctions existent
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Si manquantes, réexécuter la section "FONCTIONS UTILITAIRES" du script SQL
```

### Problème : API retourne 500

**Solution :**
1. Vérifier les logs backend : `pm2 logs gabon24-7-backend`
2. Vérifier que `routes/credits-premium.js` existe
3. Vérifier que la route est bien chargée dans `server.js`
4. Redémarrer le serveur : `pm2 restart gabon24-7-backend`

### Problème : RLS bloque les requêtes

**Solution :**
```sql
-- Vérifier les policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'credit%';

-- Si nécessaire, désactiver temporairement RLS pour debug
ALTER TABLE credit_packages DISABLE ROW LEVEL SECURITY;
-- (Réactiver après debug)
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
```

---

## ✅ CHECKLIST FINALE

- [x] Tables Supabase créées
- [x] Fonctions Postgres créées
- [x] Données seed insérées (packages, coûts, promotions)
- [x] Route backend ajoutée
- [x] Tests automatiques réussis
- [x] Documentation complète
- [ ] Frontend intégré
- [ ] Paiements configurés
- [ ] Tests en production

---

## 📞 SUPPORT

En cas de problème :
1. Vérifier les logs Railway
2. Exécuter le script de test
3. Consulter `CREDIT_SYSTEM_PREMIUM_GUIDE.md`
4. Contacter le support technique

---

## 🎉 FÉLICITATIONS !

Le système de crédits premium est maintenant installé et opérationnel !

**Prochaines étapes :**
1. Intégrer les composants frontend
2. Configurer les paiements Mobile Money
3. Tester en production avec de vrais utilisateurs

---

**Date d'installation :** 2025-11-16
**Version :** 1.0.0
