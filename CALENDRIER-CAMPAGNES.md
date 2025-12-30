# 📅 Système de Calendrier et Gestion des Créneaux Publicitaires

## Vue d'ensemble

Système de gestion intelligent des créneaux publicitaires avec limites par type de campagne pour éviter les superpositions et garantir une expérience optimale.

---

## 🎯 Limites par Type de Campagne

| Type de Campagne | Limite Simultanée | Code |
|------------------|-------------------|------|
| **🏠 Bannière Page d'Accueil** | 10 campagnes max | `banner-home` |
| **📰 Bannière Feed Articles** | 1 campagne max | `banner-feed` |
| **🎬 Vidéo Home** | 1 campagne max | `video-home` |
| **🔥 Article Sponsorisé Tendances** | ♾️ Illimité | `article-trending` |

---

## 🔧 Backend - API Endpoints

### Configuration des Limites

**Fichier:** `backend/server.js`

```javascript
const CAMPAIGN_LIMITS = {
  'banner-home': 10,        // Max 10 simultanées
  'banner-feed': 1,         // Max 1 simultanée
  'video-home': 1,          // Max 1 simultanée
  'article-trending': null  // Illimité
};
```

---

### 1. Vérifier Disponibilité Créneaux

**Endpoint:** `GET /api/campaigns/availability`

**Query Parameters:**
- `campaign_type` (requis): Type de campagne
- `start_date` (requis): Date de début (ISO string)
- `end_date` (requis): Date de fin (ISO string)

**Exemple:**
```bash
GET /api/campaigns/availability?campaign_type=video-home&start_date=2025-10-20T00:00:00Z&end_date=2025-10-27T00:00:00Z
```

**Réponse (Disponible):**
```json
{
  "success": true,
  "available": true,
  "limit": 1,
  "current_count": 0,
  "remaining": 1,
  "conflicting_campaigns": [],
  "message": "1 créneau(x) disponible(s)"
}
```

**Réponse (Non Disponible):**
```json
{
  "success": true,
  "available": false,
  "limit": 1,
  "current_count": 1,
  "remaining": 0,
  "conflicting_campaigns": [
    {
      "id": "uuid",
      "name": "Campagne existante",
      "start_date": "2025-10-18T00:00:00Z",
      "end_date": "2025-10-25T00:00:00Z",
      "status": "active"
    }
  ],
  "message": "Limite atteinte (1/1)"
}
```

**Réponse (Illimité):**
```json
{
  "success": true,
  "available": true,
  "limit": null,
  "current_count": 0,
  "message": "Aucune limite pour ce type de campagne"
}
```

---

### 2. Récupérer Calendrier Campagnes

**Endpoint:** `GET /api/campaigns/calendar/:campaign_type`

**Query Parameters (Optionnels):**
- `start_date`: Filtrer par date de début
- `end_date`: Filtrer par date de fin

**Exemple:**
```bash
GET /api/campaigns/calendar/video-home
GET /api/campaigns/calendar/banner-home?start_date=2025-10-01T00:00:00Z&end_date=2025-10-31T00:00:00Z
```

**Réponse:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": "uuid",
      "name": "Ma campagne vidéo",
      "start_date": "2025-10-20T00:00:00Z",
      "end_date": "2025-10-27T00:00:00Z",
      "status": "active",
      "budget": 450000,
      "views": 1250,
      "clicks": 45
    }
  ],
  "limit": 1,
  "count": 1,
  "campaign_type": "video-home"
}
```

---

### 3. Validation Automatique à la Création

**Endpoint:** `POST /api/campaigns`

Le système vérifie automatiquement la disponibilité **AVANT** de créer la campagne.

**Logique:**
1. Calcul de `end_date` à partir de `start_date + duration_days`
2. Requête des campagnes qui se chevauchent (`active` ou `pending`)
3. Si `currentCount >= limit` → **Erreur 409 Conflict**
4. Si disponible → Création de la campagne

**Erreur si limite atteinte:**
```json
{
  "success": false,
  "error": "Limite atteinte: 1/1 campagnes actives pour cette période",
  "limit": 1,
  "current_count": 1,
  "conflicting_campaigns": [...]
}
```

**SQL de Vérification:**
```sql
SELECT * FROM campaigns
WHERE campaign_type = 'video-home'
  AND status IN ('active', 'pending')
  AND (
    (start_date <= '2025-10-27T00:00:00Z' AND end_date >= '2025-10-20T00:00:00Z')
  )
```

---

## 🎨 Frontend - Composants

### 1. AvailabilityChecker

**Fichier:** `frontend/src/components/campaigns/AvailabilityChecker.tsx`

**Props:**
```typescript
interface AvailabilityCheckerProps {
  campaignType: string
  startDate: string
  durationDays: number
  onAvailabilityChange?: (available: boolean) => void
}
```

**Usage:**
```tsx
<AvailabilityChecker
  campaignType="video-home"
  startDate={formData.startDate}
  durationDays={formData.durationDays}
  onAvailabilityChange={setIsAvailable}
/>
```

**États visuels:**

#### ✅ Disponible:
```
┌───────────────────────────────────────────────┐
│ ✅ Créneau disponible!                        │
│ 1 créneau disponible sur 1                   │
│ 📊 0 campagne déjà active pour cette période │
└───────────────────────────────────────────────┘
```

#### ❌ Non Disponible:
```
┌───────────────────────────────────────────────┐
│ ❌ Créneau non disponible                     │
│ Limite atteinte: 1/1 campagnes actives       │
│                                               │
│ 📅 Campagnes en conflit:                     │
│ • Campagne vidéo Octobre                     │
│   Du 18/10/2025 au 25/10/2025               │
│                                               │
│ 💡 Conseil: Choisissez une autre date       │
└───────────────────────────────────────────────┘
```

#### ♾️ Illimité:
```
┌───────────────────────────────────────────────┐
│ ✅ ♾️ Aucune limite pour ce type de campagne │
│ Vous pouvez créer autant de campagnes        │
│ que vous le souhaitez                         │
└───────────────────────────────────────────────┘
```

---

### 2. CampaignCalendar

**Fichier:** `frontend/src/components/admin/CampaignCalendar.tsx`

**Props:**
```typescript
interface CampaignCalendarProps {
  campaignType: 'banner-home' | 'banner-feed' | 'video-home' | 'article-trending'
}
```

**Usage:**
```tsx
<CampaignCalendar campaignType="video-home" />
```

**Fonctionnalités:**
- Navigation par mois (← Mois précédent / Mois suivant →)
- Affichage période: 3 mois avant + 3 mois après
- Stats rapides: Total / Actives / En attente
- Liste détaillée des campagnes avec:
  - Badge status (ACTIF/EN ATTENTE/REJETÉ)
  - Dates début/fin
  - Durée en jours
  - Budget
  - Vues et clics

**Interface:**
```
┌─────────────────────────────────────────────────────┐
│ 🎬 Vidéo Home                                      │
│ Limite: 1 campagne simultanée                      │
│                                                     │
│ [← Mois précédent] [Octobre 2025] [Mois suivant →]│
│                                                     │
│ ┌──────┐  ┌──────┐  ┌──────┐                      │
│ │   1  │  │   1  │  │   0  │                      │
│ │Total │  │Actives│  │Attente│                    │
│ └──────┘  └──────┘  └──────┘                      │
│                                                     │
│ ┌──────────────────────────────────────────────┐  │
│ │ Ma campagne vidéo           [ACTIF]         │  │
│ │ 📅 Début: 20 oct. 2025                      │  │
│ │ 📅 Fin: 27 oct. 2025                        │  │
│ │ ⏱️ Durée: 7 jours                           │  │
│ │ 💰 Budget: 450,000 FCFA                     │  │
│ │ 👁️ Vues: 1,250  🔗 Clics: 45              │  │
│ └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Intégration dans les Formulaires

### Exemple: Vidéo Home

**Fichier:** `frontend/src/app/marketing/publicite/video-home/page.tsx`

```tsx
// État
const [isAvailable, setIsAvailable] = useState(true)

// Checker de disponibilité
{formData.startDate && formData.durationDays > 0 && (
  <AvailabilityChecker
    campaignType="video-home"
    startDate={formData.startDate}
    durationDays={formData.durationDays}
    onAvailabilityChange={setIsAvailable}
  />
)}

// Bouton submit désactivé si non disponible
<button
  type="submit"
  disabled={loading || !isAvailable}
  title={!isAvailable ? 'Créneau non disponible pour cette période' : ''}
>
  {isAvailable ? 'Soumettre pour validation' : 'Créneau non disponible'}
</button>
```

---

## 📊 Workflow Complet

### Création d'une Campagne

```
1. Utilisateur sélectionne type de campagne
   ↓
2. Remplit date début + durée
   ↓
3. AvailabilityChecker vérifie automatiquement
   ↓ (API GET /api/campaigns/availability)
4. Backend compte campagnes chevauchantes
   ↓
5. Si disponible ✅:
   - Affiche badge vert "Créneau disponible"
   - Bouton submit activé
   ↓
6. Si non disponible ❌:
   - Affiche badge rouge + liste conflits
   - Bouton submit désactivé
   - Message: "Choisissez une autre date"
   ↓
7. Utilisateur soumet formulaire
   ↓ (API POST /api/campaigns)
8. Backend RE-vérifie disponibilité
   ↓
9. Si toujours disponible:
   - Création campagne (status: pending)
   - Notification succès
   ↓
10. Si plus disponible (race condition):
    - Erreur 409 Conflict
    - Message: "Limite atteinte"
```

---

## 🎯 Cas d'Usage

### Cas 1: Vidéo Home (Limite 1)

**Situation:**
- Campagne A: 18/10 → 25/10 (active)
- Tentative Campagne B: 20/10 → 27/10

**Résultat:** ❌ **Refusé** (chevauchement)

**Solution:** Choisir 26/10 ou après comme date de début

---

### Cas 2: Bannière Home (Limite 10)

**Situation:**
- 9 campagnes actives en octobre
- Tentative 10ème campagne: 15/10 → 22/10

**Résultat:** ✅ **Accepté** (1 créneau restant)

---

### Cas 3: Article Sponsorisé (Illimité)

**Situation:**
- 50 articles sponsorisés actifs
- Tentative nouvel article

**Résultat:** ✅ **Toujours accepté** (aucune limite)

---

## 🔍 Détection des Chevauchements

### Logique SQL

Deux périodes se chevauchent si:
```
(start_date_A <= end_date_B) AND (end_date_A >= start_date_B)
```

**Exemples:**

#### Chevauchement:
```
Campagne A: |====|
Campagne B:    |====|
            ^^^^
         Overlap
```

#### Pas de chevauchement:
```
Campagne A: |====|
Campagne B:          |====|
            (gap)
```

---

## ⚙️ Configuration

### Modifier les Limites

**Fichier:** `backend/server.js`

```javascript
const CAMPAIGN_LIMITS = {
  'banner-home': 10,      // Changer ici
  'banner-feed': 1,       // Changer ici
  'video-home': 1,        // Changer ici
  'article-trending': null // null = illimité
};
```

**Redémarrer le backend après modification.**

---

## 🐛 Gestion d'Erreurs

### Erreur 400: Paramètres Manquants
```json
{
  "success": false,
  "error": "campaign_type, start_date et end_date sont requis"
}
```

### Erreur 409: Limite Atteinte
```json
{
  "success": false,
  "error": "Limite atteinte: 1/1 campagnes actives pour cette période",
  "limit": 1,
  "current_count": 1,
  "conflicting_campaigns": [...]
}
```

### Erreur 500: Erreur Serveur
```json
{
  "success": false,
  "error": "Erreur lors de la vérification"
}
```

---

## 📈 Statistiques et Reporting

### Dans le Calendrier

**Affichées pour chaque campagne:**
- 👁️ **Vues:** Nombre d'affichages
- 🔗 **Clics:** Nombre de clics
- 💰 **Budget:** Montant investi
- ⏱️ **Durée:** Nombre de jours

**Stats globales:**
- Total campagnes
- Campagnes actives
- Campagnes en attente

---

## 🎨 Personnalisation UI

### Couleurs par Type

**Définies dans CampaignCalendar:**
```typescript
const CAMPAIGN_INFO = {
  'banner-home': { color: 'blue' },
  'banner-feed': { color: 'green' },
  'video-home': { color: 'purple' },
  'article-trending': { color: 'orange' }
}
```

**Classes Tailwind:**
- `border-blue-500 bg-blue-50`
- `border-green-500 bg-green-50`
- `border-purple-500 bg-purple-50`
- `border-orange-500 bg-orange-50`

---

## 🚀 Déploiement

### Checklist

- [ ] Backend déployé avec nouveaux endpoints
- [ ] Frontend déployé avec composants
- [ ] Variables d'environnement configurées
- [ ] Tests de disponibilité effectués
- [ ] Documentation partagée avec l'équipe

### Tests Recommandés

1. **Test Limite 1:**
   - Créer campagne vidéo A
   - Tenter campagne vidéo B (dates chevauchantes)
   - Vérifier refus

2. **Test Limite 10:**
   - Créer 10 bannières home
   - Tenter 11ème bannière
   - Vérifier refus

3. **Test Illimité:**
   - Créer 100 articles sponsorisés
   - Vérifier tous acceptés

4. **Test Calendrier:**
   - Naviguer entre les mois
   - Vérifier affichage campagnes
   - Vérifier stats

---

## 📚 Ressources

**Fichiers Principaux:**
- Backend: `backend/server.js` (lignes 4268-4389)
- Checker: `frontend/src/components/campaigns/AvailabilityChecker.tsx`
- Calendrier: `frontend/src/components/admin/CampaignCalendar.tsx`
- Formulaire: `frontend/src/app/marketing/publicite/video-home/page.tsx`

**Endpoints:**
- GET `/api/campaigns/availability`
- GET `/api/campaigns/calendar/:campaign_type`
- POST `/api/campaigns` (avec validation)

---

## 🎯 Avantages du Système

✅ **Évite les superpositions** de campagnes  
✅ **Garantit la qualité** d'affichage  
✅ **Visualisation claire** du calendrier  
✅ **Feedback instantané** sur disponibilité  
✅ **Gestion automatique** des conflits  
✅ **Limites configurables** par type  
✅ **UI intuitive** et responsive  

---

**Système de calendrier professionnel prêt pour production!** 📅✨
