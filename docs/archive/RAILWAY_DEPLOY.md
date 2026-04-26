# 🚂 Guide de Déploiement Railway

## ⚠️ Problème Actuel

Le backend Railway retourne **500 Internal Server Error** sur `/api/saved-projects` car les **variables d'environnement** ne sont pas configurées.

## ✅ Solution

### 1. Accéder aux Variables Railway

1. Allez sur https://railway.app
2. Sélectionnez votre projet **gabon24-7-production**
3. Cliquez sur l'onglet **Variables**

### 2. Ajouter les Variables Requises

```bash
# OBLIGATOIRE - Supabase Service Role Key
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...VOTRE_CLE_SERVICE_ICI

# OBLIGATOIRE - OpenAI pour actions IA
OPENAI_API_KEY=sk-proj-...VOTRE_CLE_OPENAI_ICI

# OPTIONNEL - Autres services
REPLICATE_API_TOKEN=r8_...
RAPIDAPI_FOOTBALL_KEY=c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7
```

### 3. Obtenir la Clé Supabase Service Role

1. Allez sur https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf
2. **Settings** → **API**
3. Section **Project API keys**
4. Copiez la clé **`service_role`** ⚠️ (PAS la clé `anon` !)
5. Collez-la dans Railway comme valeur de `SUPABASE_SERVICE_ROLE_KEY`

### 4. Redéploiement Automatique

Railway redéploiera automatiquement le backend après l'ajout des variables (~2-3 minutes).

## 🔍 Vérification

Testez que tout fonctionne :

```bash
curl https://gabon24-7-production.up.railway.app/api/saved-projects/VOTRE_USER_ID
```

Vous devriez voir :
```json
{
  "success": true,
  "projects": [...]
}
```

## ⚡ Pourquoi c'est Important ?

Sans `SUPABASE_SERVICE_ROLE_KEY` :
- ❌ Le backend utilise la clé ANON (limitée)
- ❌ Les politiques RLS bloquent l'accès
- ❌ Erreur 500 "fetch failed"

Avec `SUPABASE_SERVICE_ROLE_KEY` :
- ✅ Le backend bypass les RLS
- ✅ Accès complet aux données
- ✅ API fonctionne correctement

## 📊 Variables d'Environnement Complètes

| Variable | Requis | Description |
|----------|--------|-------------|
| `SUPABASE_URL` | ✅ Oui | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Oui | Clé service (bypass RLS) |
| `OPENAI_API_KEY` | ✅ Oui | Pour actions IA (formations, courriers, etc.) |
| `REPLICATE_API_TOKEN` | ⚠️ Optionnel | Pour génération d'images IA |
| `RAPIDAPI_FOOTBALL_KEY` | ⚠️ Optionnel | Pour données football |

## 🆘 Support

Si le problème persiste après configuration :
1. Vérifiez les logs Railway
2. Testez la connexion Supabase
3. Redémarrez le service Railway

---

**Dernière mise à jour** : 9 nov 2025
