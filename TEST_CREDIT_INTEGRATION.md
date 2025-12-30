# 🧪 GUIDE DE TEST - INTÉGRATION DU SYSTÈME DE CRÉDITS

## ⚠️ IMPORTANT : Avant de tester

### 1. Exécuter la fonction SQL manquante dans Supabase

Allez dans **Supabase Dashboard > SQL Editor** et exécutez le fichier :
```sql
-- Copier/coller le contenu de : database/add_check_credits_function.sql
```

Ou directement :
```sql
CREATE OR REPLACE FUNCTION check_user_credits(
    p_user_id UUID,
    p_service_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
    v_bonus_balance INTEGER;
    v_total_balance INTEGER;
    v_required_credits INTEGER;
    v_has_enough BOOLEAN;
    v_missing INTEGER;
BEGIN
    -- Récupérer le solde de l'utilisateur
    SELECT balance, bonus_balance
    INTO v_balance, v_bonus_balance
    FROM user_credits
    WHERE user_id = p_user_id;
    
    -- Si l'utilisateur n'existe pas, retourner 0
    IF NOT FOUND THEN
        v_balance := 0;
        v_bonus_balance := 0;
    END IF;
    
    v_total_balance := COALESCE(v_balance, 0) + COALESCE(v_bonus_balance, 0);
    
    -- Récupérer le coût du service
    SELECT cost_credits
    INTO v_required_credits
    FROM credit_costs
    WHERE service_name = p_service_name
    AND is_active = true;
    
    -- Si le service n'existe pas, retourner une erreur
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service % non trouvé', p_service_name;
    END IF;
    
    -- Vérifier si l'utilisateur a assez de crédits
    v_has_enough := v_total_balance >= v_required_credits;
    v_missing := GREATEST(0, v_required_credits - v_total_balance);
    
    -- Retourner le résultat en JSON
    RETURN json_build_object(
        'has_enough', v_has_enough,
        'balance', v_total_balance,
        'required', v_required_credits,
        'missing', v_missing,
        'balance_details', json_build_object(
            'purchased', v_balance,
            'bonus', v_bonus_balance
        )
    );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION check_user_credits TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_credits TO anon;
```

---

## 📋 Tests à effectuer

### Test 1 : Vérifier que le backend a redéployé

```bash
# Vérifier que Railway a redéployé automatiquement
# Allez sur : https://railway.app/project/[PROJECT_ID]
# Ou testez directement l'API

curl https://gabon24-7-production.up.railway.app/api/credits-premium/packages
```

**Résultat attendu :** Liste des 4 packages de crédits

---

### Test 2 : Initialiser un utilisateur

Récupérez votre `userId` depuis Supabase (`auth.users` table) puis :

```bash
# Remplacez USER_ID par votre vrai UUID
curl -X POST https://gabon24-7-production.up.railway.app/api/credits-premium/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "welcomeBonus": 50
  }'
```

**Résultat attendu :**
```json
{
  "success": true,
  "message": "Utilisateur initialisé avec succès",
  "balance": 0,
  "bonus_balance": 50,
  "total_balance": 50
}
```

---

### Test 3 : Vérifier le solde

```bash
curl https://gabon24-7-production.up.railway.app/api/credits-premium/balance/USER_ID
```

**Résultat attendu :**
```json
{
  "success": true,
  "balance": 0,
  "bonus_balance": 50,
  "total_balance": 50
}
```

---

### Test 4 : Tester l'analyse d'opportunité (3 crédits)

```bash
curl -X POST https://gabon24-7-production.up.railway.app/api/opportunities/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "opportunityText": "Le gouvernement gabonais lance un programme de numérisation des PME avec un budget de 10 milliards FCFA",
    "context": "Analyse pour opportunités business"
  }'
```

**Résultat attendu :**
- ✅ Analyse IA retournée
- ✅ Message de confirmation : "3 crédits déduits - Solde restant: 47"
- ✅ Nouveau solde = 47 crédits

---

### Test 5 : Vérifier l'historique

```bash
curl https://gabon24-7-production.up.railway.app/api/credits-premium/history/USER_ID
```

**Résultat attendu :**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "...",
      "type": "consumption",
      "amount": -3,
      "service_name": "opportunity_analysis",
      "description": "Utilisation service IA: analyze-opportunity",
      "created_at": "..."
    },
    {
      "id": "...",
      "type": "bonus",
      "amount": 50,
      "description": "Crédit bonus de bienvenue",
      "created_at": "..."
    }
  ],
  "total": 2
}
```

---

### Test 6 : Tester avec crédits insuffisants

Consommez tous vos crédits en faisant plusieurs analyses, puis :

```bash
curl -X POST https://gabon24-7-production.up.railway.app/api/opportunities/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "opportunityText": "Test avec 0 crédits"
  }'
```

**Résultat attendu :**
```json
{
  "success": false,
  "error": "Crédits insuffisants. Requis: 3, Disponible: 0",
  "requiresTopUp": true,
  "details": {
    "required": 3,
    "available": 0,
    "missing": 3
  }
}
```

---

### Test 7 : Acheter un package (mode démo)

```bash
curl -X POST https://gabon24-7-production.up.railway.app/api/credits-premium/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "packageId": "PACKAGE_ID_STARTER",
    "paymentMethod": "demo",
    "paymentReference": "DEMO-TEST-123"
  }'
```

**Résultat attendu :**
```json
{
  "success": true,
  "message": "Package acheté avec succès",
  "transaction_id": "...",
  "balance": 100,
  "bonus_balance": 10,
  "total_balance": 110
}
```

---

### Test 8 : Tester le résumé audio (5 crédits)

```bash
curl -X POST https://gabon24-7-production.up.railway.app/api/audio/generate-summary \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "action": "daily",
    "language": "fr"
  }'
```

**Résultat attendu :**
```json
{
  "success": true,
  "summaryId": "...",
  "creditsConsumed": 5,
  "newBalance": 105
}
```

---

### Test 9 : Vérifier le remboursement automatique

Pour tester le remboursement automatique en cas d'erreur, vous pouvez :

1. Créer un résumé audio qui échouera (par exemple sans articles)
2. Vérifier que les crédits sont remboursés automatiquement

```bash
# Vérifier l'historique après un échec
curl https://gabon24-7-production.up.railway.app/api/credits-premium/history/USER_ID
```

**Résultat attendu :**
- Transaction de consommation : -5 crédits
- Transaction de remboursement : +5 crédits (si échec)

---

### Test 10 : Tester les statistiques

```bash
curl https://gabon24-7-production.up.railway.app/api/credits-premium/stats/USER_ID
```

**Résultat attendu :**
```json
{
  "success": true,
  "stats": {
    "total_consumed": 8,
    "total_purchased": 100,
    "total_bonus": 60,
    "consumption_by_service": {
      "opportunity_analysis": 3,
      "audio_summary": 5
    }
  }
}
```

---

## 🎯 Checklist de validation

- [ ] Fonction SQL `check_user_credits` créée dans Supabase
- [ ] Backend redéployé sur Railway (automatique via GitHub)
- [ ] Utilisateur initialisé avec 50 crédits bonus
- [ ] Analyse d'opportunité consomme 3 crédits
- [ ] Résumé audio consomme 5 crédits
- [ ] Historique des transactions visible
- [ ] Erreur "Crédits insuffisants" quand solde = 0
- [ ] Achat de package ajoute des crédits
- [ ] Remboursement automatique en cas d'erreur
- [ ] Statistiques de consommation correctes

---

## 🐛 Troubleshooting

### Erreur : "Service XXX non trouvé"
**Cause :** La fonction `check_user_credits` n'a pas été exécutée dans Supabase  
**Solution :** Exécutez le fichier `database/add_check_credits_function.sql`

### Erreur : "Utilisateur sans compte crédits"
**Cause :** L'utilisateur n'a pas été initialisé  
**Solution :** Appelez `/api/credits-premium/initialize` avec le userId

### Erreur : "Cannot read properties of null"
**Cause :** Le userId n'existe pas dans `auth.users`  
**Solution :** Utilisez un userId valide d'un utilisateur inscrit

### Analyse d'opportunité ne consomme pas de crédits
**Cause :** Le backend n'a pas encore redéployé  
**Solution :** Attendez 2-3 minutes que Railway redéploie automatiquement

---

## ✅ Validation finale

Une fois tous les tests réussis :

1. ✅ Le système de crédits fonctionne de bout en bout
2. ✅ Toutes les fonctionnalités IA consomment des crédits
3. ✅ Le remboursement automatique fonctionne
4. ✅ L'historique est correctement enregistré
5. ✅ Le frontend peut être intégré

**🎉 Le système est prêt pour la production !**

---

## 📱 Prochaine étape : Intégration Frontend

Voir le fichier `CREDIT_SYSTEM_FRONTEND_COMPLETE.md` pour :
- Afficher le solde dans le UserProfileWidget
- Gérer les alertes de crédits insuffisants
- Proposer de recharger via TopUpModal
- Mettre à jour le solde en temps réel
