# Configuration Railway pour Gabon24-7

## 🔐 Variables d'environnement requises

### SUPABASE_SERVICE_ROLE_KEY (CRITIQUE)

**Problème actuel:** Railway utilise la clé ANON au lieu de SERVICE_ROLE, ce qui active les politiques RLS de Supabase et bloque l'accès aux articles.

**Solution:**

1. **Obtenir la clé:**
   - Allez sur https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/settings/api
   - Copiez la clé **`service_role`** (Section "Project API keys")
   - ⚠️ NE PAS copier la clé `anon`!

2. **Configurer dans Railway:**
   - Dashboard Railway → Votre projet → Variables
   - New Variable
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: [Collez la clé service_role]
   - Save

3. **Redémarrage automatique:**
   - Railway redémarre automatiquement le serveur
   - Attendre 30 secondes

4. **Vérification:**
   ```bash
   # Test endpoint audio
   curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
     -H "Content-Type: application/json" \
     -d '{"language":"fr"}'
   
   # Résultat attendu:
   # {"success":true,"message":"Résumé de test en cours de génération (fr)","summaryId":"...","articlesCount":20}
   ```

## 🔍 Diagnostic

**Sans SERVICE_ROLE_KEY:**
```
⚠️  ATTENTION: Utilisation de la clé ANON au lieu de la clé SERVICE_ROLE
❌ Erreur: "Aucun article trouvé dans les dernières 24h"
```

**Avec SERVICE_ROLE_KEY:**
```
✅ Supabase client initialisé avec clé SERVICE_ROLE (bypass RLS)
✅ 20 articles trouvés
✅ Résumé généré avec succès
```

## 📋 Autres variables recommandées

### REPLICATE_API_TOKEN (Optionnel pour TTS)
- Génération audio avec Kokoro TTS
- Obtenir sur: https://replicate.com/account/api-tokens
- Si absent: résumés textuels générés sans audio

### OPENAI_API_KEY (Pour IA)
- Génération de résumés intelligents
- Obtenir sur: https://platform.openai.com/api-keys

### NODE_ENV
- Valeur: `production`
- Désactive les logs de debug

## 🚀 Vérification complète

```bash
# 1. Test connexion Supabase
curl "https://gabon24-7-production.up.railway.app/api/articles?page=1&limit=5"

# 2. Test endpoint audio latest
curl "https://gabon24-7-production.up.railway.app/api/audio/latest-public?language=fr"

# 3. Test génération résumé
curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}'

# 4. Vérifier après 15 secondes
curl "https://gabon24-7-production.up.railway.app/api/audio/latest-public?language=fr"
```

## 🎯 Résultat attendu

La page https://gabon24-7.netlify.app/audio/daily devrait afficher:
- ✅ Résumés audio en français
- ✅ Résumés audio en anglais
- ✅ Résumés audio en chinois
- ✅ Contenu text_summary (résumé IA, pas transcription)
- ✅ Lecteur audio (si REPLICATE_API_TOKEN configuré)

---

**Date:** 15 octobre 2025
**Status:** Configuration requise
