# 🔑 CONFIGURATION TOKEN REPLICATE

## ✅ ÉTAPE 1 : Obtenir le token

1. Allez sur : **https://replicate.com/account/api-tokens**
2. Connectez-vous ou créez un compte (gratuit)
3. Cliquez sur **"Create token"**
4. Copiez le token (commence par `r8_...`)

## ✅ ÉTAPE 2 : Ajouter dans .env

Ouvrez le fichier `/backend/.env` et ajoutez cette ligne :

```bash
REPLICATE_API_TOKEN=r8_VOTRE_TOKEN_ICI
```

**Exemple** :
```bash
# 🔑 CLÉS API
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx  ← Ajouter cette ligne

# 📊 SUPABASE
...
```

## ✅ ÉTAPE 3 : Sauvegarder et redémarrer

Le backend redémarrera automatiquement si vous utilisez `npm run dev`.

Sinon, redémarrez manuellement :
```bash
cd backend
npm run dev
```

## 🧪 VÉRIFICATION

Le backend devrait démarrer sans erreur et afficher :
```
✓ Replicate configuré
✓ Routes /api/project-chat activées
```

## 🎉 C'EST PRÊT !

Le bouton chat 💬 devrait maintenant fonctionner sur chaque projet !

---

**Note** : Le token Replicate est gratuit avec limite de requêtes.  
Pour usage intensif, voir les plans : https://replicate.com/pricing
