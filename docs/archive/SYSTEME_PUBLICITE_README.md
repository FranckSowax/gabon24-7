# 📢 Système de Publicité - Gabon Insight

## Vue d'Ensemble

Système complet de gestion publicitaire permettant aux entreprises de promouvoir leurs produits/services sur Gabon Insight avec validation admin, analytics en temps réel et génération assistée par IA.

---

## 🎯 Fonctionnalités

### Pour les Utilisateurs Pro

1. **4 Types de Publicité**
   - 🏠 **Bannière Page d'Accueil** (50,000 FCFA/semaine)
   - 📰 **Bannière Feed Articles** (30,000 FCFA/semaine)
   - 🎬 **Vidéo Home** (75,000 FCFA/semaine)
   - 🔥 **Article Sponsorisé Tendances** (40,000 FCFA/semaine)

2. **Création de Campagne**
   - Upload manuel de fichiers (images, vidéos)
   - Génération assistée par IA (Replicate, DALL-E)
   - Rédaction automatique (GPT-4)
   - Prévisualisation en temps réel

3. **Analytics Temps Réel**
   - Nombre de vues
   - Nombre de clics
   - Taux de clic (CTR)
   - Graphiques de performance
   - Comparaison avec moyennes

### Pour les Admins

1. **Dashboard de Validation**
   - Liste des campagnes en attente
   - Prévisualisation complète
   - Approbation/Rejet avec raison
   - Stats globales

2. **Gestion des Campagnes**
   - Activation/Désactivation
   - Modification des dates
   - Suivi des revenus
   - Historique complet

---

## 📁 Structure des Fichiers

```
frontend/
├── src/
│   ├── app/
│   │   ├── marketing/
│   │   │   └── publicite/
│   │   │       └── page.tsx              # Interface utilisateur
│   │   └── admin/
│   │       └── campaigns/
│   │           └── page.tsx              # Interface admin
│   └── components/
│       └── layout/
│           └── Sidebar.tsx               # Navigation (section Marketing)

backend/
├── routes/
│   └── campaigns.js                      # Routes API (à créer)
├── services/
│   ├── campaign-service.js               # Logique métier (à créer)
│   └── ai-generator-service.js           # Génération IA (à créer)
└── models/
    └── campaign.model.js                 # Modèle de données (à créer)
```

---

## 🗄️ Base de Données (Supabase)

### Table: `campaigns`

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL, -- 'banner-home', 'banner-feed', 'video-home', 'article-trending'
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'rejected', 'paused', 'completed'
  
  -- Médias
  image_url TEXT,
  video_url TEXT,
  target_url TEXT,
  
  -- Budget & Durée
  budget INTEGER NOT NULL,
  duration INTEGER NOT NULL, -- en jours
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  
  -- Analytics
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  
  -- Validation
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_type ON campaigns(type);
```

### Table: `campaign_analytics`

```sql
CREATE TABLE campaign_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'view', 'click', 'impression'
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaign_analytics_campaign_id ON campaign_analytics(campaign_id);
CREATE INDEX idx_campaign_analytics_event_type ON campaign_analytics(event_type);
CREATE INDEX idx_campaign_analytics_created_at ON campaign_analytics(created_at);
```

---

## 🔌 API Endpoints

### Pour les Utilisateurs

```javascript
// Créer une campagne
POST /api/campaigns
Body: {
  type: 'banner-home',
  name: 'Ma campagne',
  description: 'Description',
  imageUrl: 'https://...',
  targetUrl: 'https://...',
  budget: 50000,
  duration: 7
}

// Mes campagnes
GET /api/campaigns/my-campaigns

// Détails d'une campagne
GET /api/campaigns/:id

// Analytics d'une campagne
GET /api/campaigns/:id/analytics

// Générer avec IA
POST /api/campaigns/generate-with-ai
Body: {
  type: 'banner-home',
  prompt: 'Créer une bannière pour...',
  style: 'modern'
}
```

### Pour les Admins

```javascript
// Toutes les campagnes
GET /api/admin/campaigns?status=pending

// Approuver
POST /api/admin/campaigns/:id/approve

// Rejeter
POST /api/admin/campaigns/:id/reject
Body: {
  reason: 'Contenu inapproprié'
}

// Stats globales
GET /api/admin/campaigns/stats
```

---

## 🤖 Génération IA

### Service de Génération d'Images (Replicate)

```javascript
// backend/services/ai-generator-service.js
const Replicate = require('replicate')

async function generateBanner(prompt, dimensions) {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
  })

  const output = await replicate.run(
    "stability-ai/sdxl:latest",
    {
      input: {
        prompt: `Professional marketing banner: ${prompt}. High quality, modern design, vibrant colors.`,
        width: dimensions.width,
        height: dimensions.height,
        num_outputs: 1
      }
    }
  )

  return output[0] // URL de l'image générée
}
```

### Service de Génération de Contenu (OpenAI)

```javascript
async function generateAdCopy(businessInfo, targetAudience) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "Tu es un expert en rédaction publicitaire pour le marché gabonais."
    }, {
      role: "user",
      content: `Crée un texte publicitaire accrocheur pour: ${businessInfo}. Cible: ${targetAudience}`
    }]
  })

  return completion.choices[0].message.content
}
```

---

## 📊 Tracking Analytics

### Tracking côté Frontend

```javascript
// Incrémenter les vues
async function trackView(campaignId) {
  await fetch(`/api/campaigns/${campaignId}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'view' })
  })
}

// Incrémenter les clics
async function trackClick(campaignId) {
  await fetch(`/api/campaigns/${campaignId}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'click' })
  })
}
```

### Affichage des Bannières

```javascript
// components/AdBanner.tsx
export function AdBanner({ position }) {
  const [ad, setAd] = useState(null)

  useEffect(() => {
    // Récupérer une pub active pour cette position
    fetch(`/api/campaigns/active?position=${position}`)
      .then(res => res.json())
      .then(data => {
        setAd(data)
        // Tracker la vue
        trackView(data.id)
      })
  }, [position])

  if (!ad) return null

  return (
    <a 
      href={ad.targetUrl}
      target="_blank"
      onClick={() => trackClick(ad.id)}
      className="block w-full"
    >
      <img 
        src={ad.imageUrl} 
        alt={ad.name}
        className="w-full h-auto rounded-lg"
      />
      <span className="text-xs text-gray-400">Sponsorisé</span>
    </a>
  )
}
```

---

## 💰 Tarification

| Type | Prix | Position | Format |
|------|------|----------|---------|
| Bannière Accueil | 50,000 FCFA/semaine | Top page | 1200x300px |
| Bannière Feed | 30,000 FCFA/semaine | Entre articles | 800x200px |
| Vidéo Home | 75,000 FCFA/semaine | Page accueil | 16:9 ou 9:16 |
| Article Sponsorisé | 40,000 FCFA/semaine | Section Tendances | Article complet |

---

## 🚀 Prochaines Étapes

### Phase 1: MVP (Actuel)
- ✅ Interface utilisateur
- ✅ Interface admin
- ✅ Structure base de données
- ⏳ API Backend

### Phase 2: Fonctionnalités Avancées
- ⏳ Upload de fichiers
- ⏳ Génération IA d'images
- ⏳ Génération IA de contenu
- ⏳ Système de paiement

### Phase 3: Analytics Avancés
- ⏳ Dashboard analytics détaillé
- ⏳ A/B Testing
- ⏳ Ciblage géographique
- ⏳ Recommandations IA

### Phase 4: Automatisation
- ⏳ Validation auto (IA modération)
- ⏳ Optimisation des enchères
- ⏳ Rapports automatiques
- ⏳ Renouvellement auto

---

## 🔧 Configuration

### Variables d'Environnement

```bash
# Backend .env
REPLICATE_API_TOKEN=r8_xxx...
OPENAI_API_KEY=sk-xxx...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
STRIPE_SECRET_KEY=sk_test_xxx... # Pour les paiements
```

---

## 📱 Intégrations

### Paiement (Stripe ou Mobile Money)

```javascript
// Pour l'intégration future
async function createPayment(campaignId, amount) {
  const payment = await stripe.paymentIntents.create({
    amount: amount * 100, // Convertir en centimes
    currency: 'xaf', // Franc CFA
    metadata: { campaignId }
  })
  return payment
}
```

---

## 📈 Métriques de Succès

- **CTR Moyen**: 2-5%
- **Temps de validation**: < 24h
- **Taux d'approbation**: > 80%
- **Revenus mensuels cible**: 500,000 FCFA

---

## 🆘 Support

Pour toute question ou problème:
- Email: support@gaboninsight.ga
- Dashboard Admin: `/admin/campaigns`
- Documentation API: `/api/docs`

---

**Date de création**: 2025-01-09  
**Version**: 1.0.0  
**Statut**: ✅ MVP Prêt - Backend à finaliser
