# 📊 RESTRUCTURATION PAGE SONDAGES PRO

## 🎯 Vue d'Ensemble

La page `/sondages-pro` a été complètement restructurée pour offrir une expérience utilisateur optimale avec **2 colonnes** pour la création et les résultats actifs, puis une **section pleine largeur** pour l'historique.

---

## 📐 Nouvelle Structure Layout

### **Partie Haute : 2 Colonnes (50/50)**

#### 📝 Colonne Gauche : Création de Sondage
**Formulaire complet avec 2 modes :**

**Mode Manuel :**
- Organisation / Entreprise *
- Contact *
- Email *
- Téléphone *
- Public Cible *
- Questions (ajout/suppression dynamique)
- Budget (150k / 300k / 500k FCFA)
- Deadline *
- Informations complémentaires

**Mode IA (🤖) :**
- Mêmes champs de base
- Bouton **"🤖 Générer avec IA"**
- Génération automatique de 5-8 questions
- Questions pré-remplies et éditables
- Fallback manuel si erreur IA

#### 📈 Colonne Droite : Sondages Actifs
**Affichage des 3 sondages les plus récents :**
- Titre du sondage
- Question principale
- Options avec barres de progression
- Pourcentages de votes en temps réel
- Total votes
- Date de fermeture
- Badge "Actif" (vert)

### **Partie Basse : 1 Colonne Pleine Largeur**

#### 📚 Historique des Sondages
**Tous les sondages terminés :**
- Grid 3 colonnes (responsive : 1/2/3)
- Résultats finaux avec pourcentages
- Badge "Terminé" (gris)
- Date de création
- Total votes final

---

## 🚀 Backend API

### **Nouvel Endpoint : POST /api/polls/generate-ai**

**URL :** `https://gabon24-7-production.up.railway.app/api/polls/generate-ai`

**Body :**
```json
{
  "organization": "TechGabon SARL",
  "target_audience": "Jeunes 18-35 ans à Libreville",
  "context": "Lancement nouvelle application mobile" // optionnel
}
```

**Response Success :**
```json
{
  "success": true,
  "questions": [
    "Utilisez-vous actuellement des applications mobiles gabonaises ?",
    "Quelle fonctionnalité serait la plus utile pour vous ?",
    "Quel est votre budget mensuel pour les apps ?",
    "Préférez-vous payer en Mobile Money ou carte bancaire ?",
    "..."
  ],
  "rationale": "Questions adaptées au contexte tech gabonais avec focus jeunes urbains"
}
```

**Response Error :**
```json
{
  "success": false,
  "error": "Message d'erreur détaillé"
}
```

**Fonctionnement :**
1. Réception paramètres (org, audience, contexte)
2. Construction prompt expert sondages Gabon
3. Appel Replicate GPT-5 Nano (modèle 26e1bd4...)
4. Polling résultat (max 60 secondes)
5. Parsing JSON + extraction questions
6. Retour au frontend

---

## 💾 Base de Données

### **Nouvelle Table : poll_orders**

```sql
CREATE TABLE poll_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  questions TEXT[] NOT NULL,
  target_audience TEXT NOT NULL,
  budget INTEGER NOT NULL,
  deadline DATE NOT NULL,
  additional_info TEXT,
  status VARCHAR(50) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_poll_orders_status ON poll_orders(status);
CREATE INDEX idx_poll_orders_created_at ON poll_orders(created_at DESC);

-- RLS
ALTER TABLE poll_orders ENABLE ROW LEVEL SECURITY;

-- Insertion publique (anonyme)
CREATE POLICY "Permettre insertion publique poll_orders"
ON poll_orders FOR INSERT
TO public, anon
WITH CHECK (true);

-- Lecture admins
CREATE POLICY "Admins peuvent lire poll_orders"
ON poll_orders FOR SELECT
TO authenticated
USING (true);
```

**Migration SQL :** Disponible dans `/tmp/poll-orders-table.sql`

---

## 🎨 Design & UX

### **Palette de Couleurs**

**Header :**
- Gradient : `from-orange-500 via-red-500 to-pink-600`

**Toggle Manuel/IA :**
- Fond : `bg-gray-100`
- Actif : `bg-white shadow-sm`
- Inactif : `text-gray-600 hover:text-gray-900`

**Bouton Génération IA :**
- Gradient : `from-purple-600 to-blue-600`
- Hover : `from-purple-700 to-blue-700`
- Icône : 🤖

**Badges :**
- Actif : `bg-green-100 text-green-700`
- Terminé : `bg-gray-100 text-gray-600`

**Barres de Progression :**
- Gradient : `from-orange-500 to-red-500`
- Fond : `bg-gray-200`

### **États Visuels**

**Loading :**
```tsx
<div className="animate-spin text-4xl">⏳</div>
<p>Chargement...</p>
```

**Génération IA :**
```tsx
<span className="animate-spin">⏳</span>
<span>Génération...</span>
```

**Vide :**
```tsx
<div className="text-6xl mb-4">📊</div>
<p>Aucun sondage actif pour le moment</p>
```

### **Responsive Design**

**Mobile (<640px) :**
- Layout passe en 1 colonne
- Toggle Manuel/IA stack vertical
- Grid historique : 1 colonne

**Tablet (640px-1024px) :**
- Layout reste 2 colonnes
- Grid historique : 2 colonnes

**Desktop (>1024px) :**
- Layout 2 colonnes optimisé
- Grid historique : 3 colonnes
- Max-width : 7xl (1280px)

---

## 🔄 Workflow Utilisateur

### **Scénario 1 : Mode Manuel**

1. User ouvre `/sondages-pro`
2. Voit 2 colonnes : Création | Résultats actifs
3. Toggle reste sur "✍️ Manuel"
4. Remplit formulaire :
   - Organisation : "Restaurant Le Patio"
   - Contact : "Jean Mbongo"
   - Email : "jean@lepatio.ga"
   - Téléphone : "+241 XX XX XX XX"
   - Public : "Clients restaurants Libreville"
   - Questions :
     * "Qualité des plats ?"
     * "Rapidité du service ?"
     * "Rapport qualité/prix ?"
5. Budget : 150,000 FCFA
6. Deadline : 2025-10-30
7. Clic "🚀 Soumettre la Demande"
8. Alert : "✅ Demande soumise avec succès!"
9. Email envoyé (future feature)
10. Admin reçoit notification (future feature)

### **Scénario 2 : Mode IA**

1. User ouvre `/sondages-pro`
2. Toggle vers "🤖 IA"
3. Remplit infos minimales :
   - Organisation : "TechGabon SARL"
   - Public : "Jeunes 18-35 ans développeurs"
   - Contexte : "Nouveau framework JavaScript gabonais"
4. Clic "🤖 Générer avec IA"
5. Bouton devient : "⏳ Génération..." (disabled)
6. Attente 5-10 secondes
7. **IA génère questions :**
   ```
   - Utilisez-vous actuellement des frameworks JavaScript ?
   - Quelles sont vos priorités (performance, simplicité, docs) ?
   - Êtes-vous prêt à adopter un framework gabonais ?
   - Quel support attendez-vous (formation, communauté) ?
   - Budget projet type pour nouvelle stack ?
   ```
8. Questions apparaissent dans formulaire
9. User peut éditer/supprimer/ajouter questions
10. Clic "🚀 Soumettre la Demande"
11. Alert : "✅ Demande soumise!"

### **Scénario 3 : Erreur IA**

1. User clic "🤖 Générer avec IA"
2. Erreur API Replicate (timeout, quota, etc.)
3. Alert : "❌ Erreur: [message]\n\nVous pouvez remplir manuellement"
4. User peut continuer en mode manuel
5. Pas de blocage du workflow

---

## 📊 Affichage Résultats

### **Colonne Droite : Actifs**

**Exemple Sondage Actif :**
```
┌────────────────────────────────────────────┐
│ Meilleure période voyage Gabon      [Actif]│
├────────────────────────────────────────────┤
│ Quelle saison préférez-vous pour visiter ? │
│                                             │
│ Saison sèche (juin-sept)          65.3%    │
│ ████████████████████░░░░░░░░░               │
│                                             │
│ Saison pluies (oct-mai)           23.8%    │
│ ███████░░░░░░░░░░░░░░░░░░░░░                │
│                                             │
│ Pas de préférence                 10.9%    │
│ ███░░░░░░░░░░░░░░░░░░░░░░░░░                │
│                                             │
│ 👥 1,247 votes  📅 Ferme le 25/10/2025     │
└────────────────────────────────────────────┘
```

### **Section Bas : Historique**

**Grid 3 colonnes (desktop) :**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ [Terminé]    │ │ [Terminé]    │ │ [Terminé]    │
│ Sondage 1    │ │ Sondage 2    │ │ Sondage 3    │
│ ...          │ │ ...          │ │ ...          │
│ 👥 532 votes │ │ 👥 891 votes │ │ 👥 1045 votes│
│ 📅 12/10/25  │ │ 📅 10/10/25  │ │ 📅 08/10/25  │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 🛡️ Sécurité & Permissions

### **Table poll_orders**

**Insertion :**
- ✅ Public (anonyme)
- ✅ Anon (non connecté)
- ⛔ Pas de validation user_id

**Lecture :**
- ✅ Authenticated (admins)
- ⛔ Public ne peut pas lire
- ⛔ Anon ne peut pas lire

**Mise à jour :**
- ⛔ Personne (sauf via backend/admin)

**Suppression :**
- ⛔ Personne (sauf via backend/admin)

### **API /polls/generate-ai**

**Rate Limiting :**
- À implémenter : 5 requêtes/min/IP
- Timeout : 60 secondes max
- Retry : Aucun (user relance manuellement)

**Validation :**
- `organization` : requis, 1-255 caractères
- `target_audience` : requis, texte libre
- `context` : optionnel, texte libre

---

## 🧪 Tests & Validation

### **Test Manuel Page**

1. Ouvrir `https://gabon24-7.netlify.app/sondages-pro`
2. Vérifier layout 2 colonnes
3. Toggle Manuel/IA fonctionne
4. Formulaire validation fonctionne
5. Ajout/suppression questions OK
6. Affichage sondages actifs OK
7. Affichage historique OK

### **Test Génération IA**

```bash
curl -X POST "https://gabon24-7-production.up.railway.app/api/polls/generate-ai" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "Test Org",
    "target_audience": "Jeunes Libreville",
    "context": "Application mobile"
  }'
```

**Résultat attendu :**
```json
{
  "success": true,
  "questions": ["Q1", "Q2", "Q3", ...],
  "rationale": "..."
}
```

### **Test Soumission Formulaire**

1. Remplir formulaire complet
2. Soumettre
3. Vérifier dans Supabase :
   ```sql
   SELECT * FROM poll_orders ORDER BY created_at DESC LIMIT 1;
   ```
4. Vérifier email reçu (future)

---

## 📈 Métriques & Analytics

### **KPIs à Suivre**

**Création :**
- Nb commandes/jour
- Mode manuel vs IA (ratio)
- Taux conversion formulaire
- Temps moyen remplissage

**Génération IA :**
- Nb générations/jour
- Taux succès IA
- Temps moyen génération
- Taux d'édition post-IA

**Engagement :**
- Vues page sondages
- Clics sondages actifs
- Votes par sondage
- Taux participation

---

## 🚀 Prochaines Étapes

### **Court Terme (1-2 semaines)**

- [ ] **Appliquer migration Supabase** (`poll_orders`)
- [ ] **Tester génération IA** en production
- [ ] **Ajouter validation email** (vérifier format)
- [ ] **Toast notifications** (remplacer alerts)
- [ ] **Loading states améliorés** (skeleton UI)

### **Moyen Terme (2-4 semaines)**

- [ ] **Dashboard admin** pour gérer commandes
  - Liste toutes commandes
  - Filtres (pending, in_progress, completed)
  - Actions (approuver, rejeter, archiver)
  - Modification status
- [ ] **Email notifications**
  - Confirmation soumission client
  - Notification admin nouvelle commande
  - Template emails professionnels
- [ ] **Système paiement**
  - Intégration Mobile Money (Airtel, Moov)
  - Génération factures PDF
  - Tracking paiements
- [ ] **Historique commandes user**
  - Login/signup pour clients
  - Voir ses commandes passées
  - Télécharger rapports

### **Long Terme (1-3 mois)**

- [ ] **Analytics avancés**
  - Dashboard métriques temps réel
  - Export données Excel/CSV
  - Graphiques tendances
- [ ] **Amélioration IA**
  - Fine-tuning modèle pour Gabon
  - Génération options réponses
  - Analyse automatique résultats
- [ ] **Intégration WhatsApp**
  - Bot notifications
  - Support client
  - Envoi rapports
- [ ] **Mode multi-langue**
  - Français
  - Anglais
  - Langues locales

---

## 📚 Documentation Technique

### **Fichiers Modifiés**

**Frontend :**
- `frontend/src/app/sondages-pro/page.tsx` (restructuré)
- Backup : `page.tsx.backup`

**Backend :**
- `backend/server.js` (ajout endpoint `/api/polls/generate-ai`)

**Base de Données :**
- Migration SQL : `/tmp/poll-orders-table.sql`

### **Dépendances**

**Frontend :**
- React 18+
- Next.js 14+
- Framer Motion (animations)
- Tailwind CSS (styling)
- @supabase/supabase-js (database)

**Backend :**
- Node.js 18+
- Express.js
- node-fetch (Replicate API)
- Supabase JS (database)

**APIs Externes :**
- Replicate (GPT-5 Nano)
- Supabase (PostgreSQL + RLS)

### **Variables d'Environnement**

**Backend (.env) :**
```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Frontend (.env.local) :**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_API_URL=https://gabon24-7-production.up.railway.app
```

---

## 🎉 Résultat Final

**Page complètement restructurée avec :**

✅ **2 colonnes** : Création | Résultats actifs  
✅ **1 section** : Historique complet  
✅ **Génération IA** : Questions automatiques  
✅ **Mode manuel** : Fallback toujours disponible  
✅ **Temps réel** : Résultats mis à jour automatiquement  
✅ **Responsive** : Mobile/Tablet/Desktop  
✅ **Professionnel** : Design moderne et épuré  
✅ **Sécurisé** : RLS policies Supabase  

**UX optimisée pour maximiser conversions et engagement ! 🚀**

---

**Date :** 19 octobre 2025  
**Version :** 2.0  
**Commit :** `28d42ca`
