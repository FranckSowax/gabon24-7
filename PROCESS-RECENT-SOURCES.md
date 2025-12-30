# Script de Traitement des Sources Récentes (24h)

## 📋 Objectif

Script automatisé pour traiter et corriger les sources des articles publiés dans les dernières 24 heures, en utilisant le système de détection robuste 4-niveaux.

## 🎯 Fonctionnalités

- **Traitement ciblé** : Articles de moins de 24h uniquement
- **Détection intelligente** : Système 4-niveaux intégré
- **Cache optimisé** : Évite les re-calculs pour les domaines déjà traités
- **Statistiques détaillées** : Rapport complet avec méthodes utilisées
- **Logging automatique** : Sauvegarde des résultats dans `sync_logs`

## 🔧 Utilisation

### Appel Manuel
```bash
curl "https://gabon24-7.netlify.app/.netlify/functions/process-recent-sources"
```

### Via Postman/Insomnia
- **Method**: GET
- **URL**: `https://gabon24-7.netlify.app/.netlify/functions/process-recent-sources`
- **Headers**: `Content-Type: application/json`

## 📊 Réponse Type

```json
{
  "success": true,
  "processed": 15,
  "updated": 12,
  "errors": 0,
  "duration": 3,
  "cacheSize": 8,
  "stats": {
    "bySource": {
      "Gabon Mail Infos": 3,
      "Focus Groupe Media": 2,
      "Echos De L Eco": 4,
      "Gabon Review": 3
    },
    "updateMethods": {
      "mapping": 8,
      "transform": 4,
      "unchanged": 3
    }
  },
  "message": "12 sources mises à jour sur 15 articles récents (3s)",
  "timestamp": "2025-09-11T21:33:27.000Z",
  "timeframe": "24h"
}
```

## 🎯 Critères de Traitement

Le script traite les articles avec :
- `source = null`
- `source = "Source inconnue"`
- `source` contenant `.com`, `.ga`, `.net`, `.org`, `.fr`

## 🔄 Système de Détection

1. **Mapping existant** : Sources gabonaises connues
2. **Transformation intelligente** : Conversion des domaines
   - `gabonreview.com` → `Gabon Review`
   - `echosdeleco.com` → `Echos De L Eco`
3. **Cache** : Évite les re-calculs
4. **Fallback** : Domaine nettoyé si aucune correspondance

## 📈 Cas d'Usage

### Traitement Quotidien
Idéal pour un cron job quotidien qui nettoie automatiquement les sources des nouveaux articles.

### Traitement Post-Sync RSS
Après chaque synchronisation RSS, lancer ce script pour corriger immédiatement les sources.

### Maintenance Ciblée
Focus sur les articles récents pour un impact immédiat sur l'UX.

## ⚡ Performances

- **Timeout** : 8 minutes maximum
- **Batch** : Traitement séquentiel avec pauses
- **Cache** : Réutilisation des sources déjà détectées
- **Logs** : Suivi automatique dans Supabase

## 🚨 Gestion d'Erreurs

- Erreurs individuelles n'interrompent pas le traitement
- Logs détaillés pour chaque échec
- Statistiques d'erreurs dans la réponse
- Fallback gracieux en cas de timeout

## 📝 Logs Automatiques

Chaque exécution génère un log dans `sync_logs` :
- Type : `recent_sources_processing`
- Statistiques complètes
- Détails des erreurs
- Taille du cache
- Durée d'exécution
