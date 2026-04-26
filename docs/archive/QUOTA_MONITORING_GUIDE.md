# 🚨 Guide de Surveillance des Quotas API

## Vue d'ensemble

Système automatique de surveillance et d'alerte pour prévenir l'admin quand les quotas API (OpenAI, Replicate, etc.) sont bas ou épuisés.

## ⚠️ IMPORTANT: Configuration requise

### 1. Exécuter la migration SQL

**OBLIGATOIRE avant utilisation:**

1. Va sur https://supabase.com/dashboard/project/fxyfbkmqbjijbvpdxbdh/sql/new
2. Copie le contenu de `/backend/migrations/create_admin_alerts_table.sql`
3. Exécute la migration
4. Vérifie que la table `admin_alerts` est créée

### 2. Configuration des emails admin (optionnel)

Dans Supabase, modifie la policy pour correspondre à ton domaine admin:

```sql
-- Dans create_admin_alerts_table.sql
WHERE auth.users.email LIKE '%@admin.gabon247.com'
-- Remplace par ton domaine admin réel
```

## 🎯 Fonctionnalités

### Détection automatique

Le système détecte et alerte automatiquement pour:

1. **Quota épuisé (429)** - Critical
   - OpenAI quota exceeded
   - Trop de requêtes
   
2. **Erreur authentification (401)** - High
   - Clé API invalide ou expirée
   
3. **Rate limit** - Medium
   - Trop de requêtes en peu de temps
   
4. **Usage élevé** - Low
   - Plus de 10,000 tokens par requête
   - Coût estimé > $0.05 par requête

### Système de cooldown

- Une alerte par type toutes les 60 minutes max
- Évite le spam d'alertes
- Log persistant dans Supabase

### Fallback si Supabase indisponible

- Si la table n'existe pas encore → log dans fichier
- Fichier: `/backend/logs/quota-alerts.log`
- Format: timestamp, severity, service, message, détails

## 📊 Niveaux de gravité

| Niveau | Description | Action requise |
|--------|-------------|----------------|
| **critical** 🔴 | Service indisponible | Immédiate (< 5 min) |
| **high** 🟠 | Problème majeur | Urgente (< 1h) |
| **medium** 🟡 | Attention requise | Bientôt (< 24h) |
| **low** 🟢 | Information | Surveillance |

## 🔧 Utilisation

### Intégration dans le code

Le système est déjà intégré dans:
- ✅ `/routes/opportunities.js` - Analyses IA
- ✅ `/routes/skill-test.js` - Génération tests (via Replicate)
- ⏳ Autres routes à intégrer selon besoin

**Pour intégrer dans une nouvelle route:**

```javascript
const { checkOpenAIError, checkUsageThreshold } = require('../utils/quota-monitor');

// Dans ton try/catch
try {
  const response = await callOpenAI(...);
  
  // Surveiller l'usage
  await checkUsageThreshold(response.usage);
  
} catch (error) {
  // Vérifier si c'est une erreur de quota
  await checkOpenAIError(error, { 
    context: 'ma-fonction',
    user: userId 
  });
  throw error;
}
```

### API Admin - Consulter les alertes

#### 1. Toutes les alertes actives
```bash
GET /api/admin/alerts/active
```

**Réponse:**
```json
{
  "success": true,
  "active_count": 3,
  "critical_count": 1,
  "alerts": [
    {
      "id": "uuid",
      "service": "openai",
      "severity": "critical",
      "message": "🚨 QUOTA OPENAI ÉPUISÉ",
      "details": {
        "error": "429 quota exceeded",
        "action_required": "Recharger le quota OpenAI"
      },
      "created_at": "2025-10-04T00:00:00Z"
    }
  ],
  "by_service": {
    "openai": [...],
    "replicate": [...]
  }
}
```

#### 2. Résumé du système
```bash
GET /api/admin/alerts/summary
```

**Réponse:**
```json
{
  "status": "critical|warning|healthy",
  "last_7_days": {
    "total_alerts": 15,
    "critical_alerts": 1,
    "unresolved": 3
  },
  "services": {
    "openai": {
      "total": 10,
      "critical": 1,
      "last_alert": "2025-10-04T00:00:00Z"
    }
  }
}
```

#### 3. Marquer comme prise en compte
```bash
PUT /api/admin/alerts/:id/acknowledge
Body: { "userId": "uuid", "notes": "En cours de traitement" }
```

#### 4. Résoudre une alerte
```bash
PUT /api/admin/alerts/:id/resolve
Body: { "userId": "uuid", "notes": "Quota rechargé" }
```

#### 5. Ignorer une alerte
```bash
DELETE /api/admin/alerts/:id
```

## 🚨 Que faire quand une alerte se déclenche?

### Alerte CRITICAL: Quota OpenAI épuisé

**Console affichera:**
```
🚨🚨🚨 QUOTA OPENAI DÉPASSÉ 🚨🚨🚨
🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
🔴 ACTION REQUISE: QUOTA OPENAI ÉPUISÉ
🔴 Les utilisateurs ne peuvent plus faire d'analyses
🔴 Recharger sur: https://platform.openai.com/account/billing
🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
```

**Actions:**

1. **Immédiat (< 5 min)**
   - Va sur https://platform.openai.com/account/billing
   - Recharge le quota (ajouter des crédits)
   - Vérifie que le paiement est passé

2. **Suivi**
   - Consulte `/api/admin/alerts/active`
   - Marque l'alerte comme résolue
   - Surveille les prochaines 24h

3. **Prévention**
   - Augmente le quota mensuel
   - Active les alertes email OpenAI (à 80% du quota)
   - Considère passer à un plan supérieur

### Alerte HIGH: Erreur authentification

**Actions:**

1. Vérifie `.env` → `OPENAI_API_KEY` est correct
2. Vérifie que la clé n'a pas expiré
3. Regénère une nouvelle clé si nécessaire
4. Redémarre le backend

### Alerte MEDIUM: Rate limit

**Actions:**

1. Ralentis la fréquence des requêtes
2. Ajoute des délais entre les appels
3. Considère un système de queue

### Alerte LOW: Usage élevé

**Actions:**

1. Optimise les prompts pour réduire les tokens
2. Réduis `max_tokens` dans les configs
3. Utilise des modèles moins coûteux si possible

## 📱 Monitoring en temps réel

### Voir les logs en direct

```bash
# Backend logs
tail -f /tmp/backend.log | grep "🚨\|❌\|⚠️"

# Quota alerts file (fallback)
tail -f backend/logs/quota-alerts.log
```

### Dashboard admin (à créer)

Tu peux créer une page admin pour afficher:
- Nombre d'alertes actives
- Graphiques d'utilisation
- Historique des incidents
- État de santé global du système

**Exemple d'intégration frontend:**

```typescript
// frontend/src/app/admin/alerts/page.tsx
const [alerts, setAlerts] = useState([])

useEffect(() => {
  fetch('/api/admin/alerts/active')
    .then(r => r.json())
    .then(data => setAlerts(data.alerts))
}, [])
```

## 💰 Surveillance des coûts

Le système calcule automatiquement le coût estimé:

**Tarifs GPT-4o-mini:**
- Input: ~$0.15 / 1M tokens
- Output: ~$0.60 / 1M tokens

**Alerte si:**
- Coût > $0.05 par requête
- Usage > 10,000 tokens par requête

## 🔐 Sécurité

### Accès aux alertes

- **Backend**: Utilise `service_role_key` pour insérer
- **Frontend**: RLS policies limitent l'accès aux admins
- **Email**: Utilise la politique `email LIKE '%@admin.gabon247.com'`

### Personnaliser l'accès

Modifie les policies dans la migration SQL selon ta logique:

```sql
-- Option 1: Par email
email LIKE '%@admin.gabon247.com'

-- Option 2: Par rôle (si tu as une table roles)
EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
)

-- Option 3: Liste blanche
auth.uid() IN ('uuid1', 'uuid2', 'uuid3')
```

## 📊 Statistiques et métriques

La table stocke:
- Nombre total d'alertes
- Alertes par service
- Alertes par gravité
- Temps de résolution moyen
- Fréquence des incidents

Utilise ces données pour:
- Identifier les services problématiques
- Optimiser l'utilisation des API
- Planifier les budgets
- Améliorer la résilience

## 🚀 Prochaines améliorations

- [ ] Notifications email automatiques
- [ ] Intégration Slack/Discord
- [ ] Dashboard admin visuel
- [ ] Prédiction de dépassement de quota
- [ ] Système de backup automatique (OpenAI → DeepSeek)
- [ ] Alertes SMS pour critical

## 📞 Support

En cas de problème:
1. Vérifie les logs: `/tmp/backend.log`
2. Vérifie le fichier: `backend/logs/quota-alerts.log`
3. Consulte Supabase: table `admin_alerts`
4. Redémarre le backend si nécessaire

---

**Système créé le:** 2025-10-04  
**Dernière mise à jour:** 2025-10-04
