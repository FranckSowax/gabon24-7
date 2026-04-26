# 🧹 Plan de Nettoyage - Anciennes Fonctions Netlify

## 📋 Objectif

Une fois que le système MCP-Enhanced fonctionne parfaitement et que les images s'affichent correctement, nettoyer les anciennes fonctions de traitement d'images pour optimiser le déploiement.

## 🎯 Critères de Validation Avant Nettoyage

### ✅ Tests à Effectuer
1. **Homepage Articles** : Vérifier que `homepage-articles-new` retourne des articles
2. **Images MCP** : Confirmer que les images s'affichent dans tous les onglets
3. **RSS Sync** : Valider que `rss-bundle-fast` fonctionne avec MCP-Enhanced
4. **Performance** : S'assurer que les temps de réponse sont acceptables

### 📊 Commandes de Test
```bash
# Test homepage articles
curl https://gabon24-7.netlify.app/.netlify/functions/homepage-articles-new

# Test RSS sync
curl https://gabon24-7.netlify.app/.netlify/functions/rss-bundle-fast

# Test image extraction comparison
curl https://gabon24-7.netlify.app/.netlify/functions/test-image-extraction
```

## 🗂️ Fonctions à Nettoyer (APRÈS validation)

### 📁 Fonctions Obsolètes Identifiées
- `homepage-articles.js` - Remplacée par `homepage-articles-new.js`
- `homepage-articles2.js` - Version intermédiaire obsolète
- `articles.js` - Si non utilisée ailleurs
- `supabase-articles.js` - Si redondante
- `trending-articles.js` - Si intégrée dans homepage-articles-new
- `archived-articles.js` - Si non utilisée

### 🔍 Fonctions à Analyser
- `search-articles.js` - Vérifier si utilisée pour la recherche
- `import-csv-articles.js` - Utilitaire admin à conserver
- `delete-articles.js` - Utilitaire admin à conserver

## 🚀 Plan de Nettoyage par Étapes

### Phase 1: Validation (ACTUELLE)
- [ ] Tester `homepage-articles-new` avec MCP-Enhanced
- [ ] Vérifier affichage des images dans tous les onglets
- [ ] Confirmer performance acceptable
- [ ] Valider que 0 erreurs dans les logs

### Phase 2: Identification des Dépendances
```bash
# Chercher les références aux anciennes fonctions
grep -r "homepage-articles.js" frontend/
grep -r "articles.js" frontend/
grep -r "trending-articles" frontend/
```

### Phase 3: Nettoyage Progressif
1. **Renommer d'abord** (sécurité)
   ```bash
   mv homepage-articles.js homepage-articles.js.backup
   mv homepage-articles2.js homepage-articles2.js.backup
   ```

2. **Tester pendant 24h** sans les anciennes fonctions

3. **Supprimer définitivement** si tout fonctionne
   ```bash
   rm *.backup
   ```

### Phase 4: Optimisation
- Nettoyer les imports inutilisés
- Optimiser les dépendances
- Réduire la taille du bundle de déploiement

## 📝 Fonctions à Conserver Absolument

### ✅ Fonctions Critiques MCP-Enhanced
- `rss-bundle-fast.js` - RSS sync avec MCP-Enhanced
- `homepage-articles-new.js` - Articles homepage avec MCP-Enhanced
- `test-image-extraction.js` - Outil de validation A/B
- `rss-bundle-fast-backup.js` - Sauvegarde pour rollback

### ✅ Fonctions Système Essentielles
- `image-proxy.js` - Proxy pour images CORS
- `rss-sync.js` - Synchronisation programmée
- `manual-sync-*.js` - Outils de sync manuel
- Toutes les fonctions d'authentification et paiement

## 🔧 Script de Nettoyage Automatisé

```bash
#!/bin/bash
# cleanup-old-functions.sh

echo "🧹 Nettoyage des anciennes fonctions Netlify"

# Fonctions à supprimer (APRÈS validation)
OLD_FUNCTIONS=(
  "homepage-articles.js"
  "homepage-articles2.js"
  "articles.js.backup"
  "supabase-articles.js.backup"
)

# Vérifier que les nouvelles fonctions marchent
echo "🔍 Test des nouvelles fonctions..."
curl -f https://gabon24-7.netlify.app/.netlify/functions/homepage-articles-new > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ homepage-articles-new fonctionne"
else
  echo "❌ homepage-articles-new en erreur - ARRÊT du nettoyage"
  exit 1
fi

# Supprimer les anciennes fonctions
for func in "${OLD_FUNCTIONS[@]}"; do
  if [ -f "netlify/functions/$func" ]; then
    echo "🗑️ Suppression de $func"
    rm "netlify/functions/$func"
  fi
done

echo "✅ Nettoyage terminé"
```

## 📊 Métriques de Succès

### 🎯 Objectifs du Nettoyage
- **Réduction taille** : -30% de fonctions déployées
- **Performance** : Temps de déploiement réduit
- **Maintenance** : Code plus simple à maintenir
- **Fiabilité** : Moins de points de défaillance

### 📈 Indicateurs de Réussite
- [ ] Déploiement plus rapide (< 3 minutes)
- [ ] Aucune régression fonctionnelle
- [ ] Images toujours affichées correctement
- [ ] Logs sans erreurs pendant 48h

## ⚠️ Précautions de Sécurité

### 🛡️ Mesures de Protection
1. **Toujours sauvegarder** avant suppression
2. **Tester en production** avant nettoyage final
3. **Monitoring continu** après nettoyage
4. **Plan de rollback** disponible

### 🚨 Signaux d'Alerte pour Arrêter
- Erreurs 502/500 sur les fonctions
- Images qui ne s'affichent plus
- Temps de réponse > 10 secondes
- Erreurs dans les logs Netlify

## 📅 Timeline Recommandé

### Semaine 1 (ACTUELLE)
- [x] Déploiement MCP-Enhanced
- [ ] Validation fonctionnement
- [ ] Tests utilisateurs

### Semaine 2
- [ ] Identification dépendances
- [ ] Nettoyage progressif
- [ ] Monitoring intensif

### Semaine 3
- [ ] Suppression définitive
- [ ] Optimisation finale
- [ ] Documentation mise à jour

---

**Status Actuel** : 🔄 Phase 1 - Validation en cours
**Prochaine Étape** : Attendre confirmation que les images s'affichent correctement
**Responsable** : Développeur principal
**Date Cible** : Fin septembre 2025
