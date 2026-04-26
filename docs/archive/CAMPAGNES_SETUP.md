# 🚀 Setup Système de Campagnes Publicitaires

## ✅ Ce qui a été créé

### Frontend (Next.js)
- ✅ Page principale `/marketing/publicite`
- ✅ Page Bannière Accueil `/marketing/publicite/banner-home`
- ✅ Page Bannière Feed `/marketing/publicite/banner-feed`
- ✅ Page Vidéo Home `/marketing/publicite/video-home`
- ✅ Page Article Sponsorisé `/marketing/publicite/article-trending`
- ✅ Page Admin Campagnes `/admin/campaigns`
- ✅ Navigation Sidebar (section Marketing)

### Backend (Express.js)
- ✅ Routes `/api/campaigns` - Gestion campagnes utilisateurs
- ✅ Routes `/api/upload` - Upload images/vidéos
- ✅ Routes `/api/ai` - Génération contenu IA
- ✅ Routes `/api/admin/campaigns` - Gestion admin
- ✅ Service Upload vers Supabase Storage
- ✅ Service Génération IA (OpenAI GPT-4)

### Base de Données (Supabase)
- ✅ Table `campaigns` avec tous les champs
- ✅ Table `campaign_analytics` pour tracking
- ✅ RLS (Row Level Security) configurée
- ✅ Fonctions SQL (calcul CTR)

---

## 🔧 Installation

### 1. Backend

```bash
cd backend
npm install
```

**Nouvelle dépendance ajoutée:**
- `sharp` (v0.33.0) - Redimensionnement d'images

Les autres dépendances étaient déjà présentes :
- `multer` - Upload fichiers
- `uuid` - ID uniques
- `openai` - Génération IA

### 2. Variables d'Environnement

Vérifiez que votre `.env` contient :

```env
# Supabase (déjà configuré normalement)
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

# OpenAI (NOUVEAU - pour génération d'articles)
OPENAI_API_KEY=sk-xxx...

# Port serveur
PORT=3001
```

**Pour obtenir une clé OpenAI :**
1. Aller sur https://platform.openai.com/api-keys
2. Créer une nouvelle clé API
3. L'ajouter au fichier `.env`

> ⚠️ **Note**: La génération IA est optionnelle. Le système fonctionne sans, mais ne pourra pas générer d'articles automatiquement.

### 3. Créer les Buckets Supabase Storage

Les buckets doivent être créés une seule fois dans Supabase.

**Option A : Via interface Supabase**
1. Aller sur https://supabase.com/dashboard
2. Storage → Create bucket
3. Créer deux buckets :
   - `campaigns-images` (public, 10MB max)
   - `campaigns-videos` (public, 50MB max)

**Option B : Via code (automatique)**

Le code suivant créera automatiquement les buckets au premier lancement :

```javascript
const uploadService = require('./services/upload-service');
await uploadService.createBuckets();
```

Ou directement dans le terminal Node:

```bash
node -e "const u = require('./services/upload-service'); u.createBuckets();"
```

---

## 🚀 Démarrage

### 1. Backend

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/backend
npm run dev
```

Vous devriez voir :
```
✅ Routes campagnes publicitaires chargées
🚀 Serveur Gabon Insight démarré sur le port 3001
```

### 2. Frontend

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/frontend
npm run dev
```

### 3. Tester

Ouvrir http://localhost:3000/marketing/publicite

---

## 📋 Checklist de Vérification

### Backend
- [ ] `npm install` exécuté
- [ ] `.env` configuré avec SUPABASE_URL et SUPABASE_ANON_KEY
- [ ] `.env` contient OPENAI_API_KEY (optionnel)
- [ ] Serveur démarre sans erreur sur port 3001
- [ ] Message "Routes campagnes publicitaires chargées" affiché

### Supabase
- [ ] Table `campaigns` créée (via MCP Supabase)
- [ ] Table `campaign_analytics` créée
- [ ] Buckets `campaigns-images` et `campaigns-videos` créés
- [ ] RLS activée sur les tables

### Frontend
- [ ] Page `/marketing/publicite` accessible
- [ ] 4 cartes de types de publicité affichées
- [ ] Clic sur "Créer ma campagne" ouvre la bonne page
- [ ] Navigation Sidebar contient "Marketing > Publicité"

---

## 🧪 Tests Rapides

### 1. Test Upload Image

```bash
curl -X POST http://localhost:3001/api/upload/image \
  -F "file=@/path/to/image.jpg" \
  -H "x-user-id: test-user-123"
```

### 2. Test Génération Article

```bash
curl -X POST http://localhost:3001/api/ai/generate-article \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "TechGabon",
    "productService": "Application mobile",
    "targetAudience": "Entrepreneurs gabonais",
    "category": "tech"
  }'
```

### 3. Test Création Campagne

```bash
curl -X POST http://localhost:3001/api/campaigns \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-123" \
  -d '{
    "campaign_type": "banner-home",
    "name": "Test Campaign",
    "banner_title": "Titre test",
    "banner_description": "Description test",
    "redirect_url": "https://example.com",
    "budget": 50000,
    "duration_days": 7
  }'
```

---

## 🐛 Troubleshooting

### Erreur "Cannot find module './routes/campaigns'"

**Solution**: Vérifiez que tous les fichiers de routes ont été créés :
- `backend/routes/campaigns.js`
- `backend/routes/upload.js`
- `backend/routes/ai.js`
- `backend/routes/admin-campaigns.js`

### Erreur "Bucket not found"

**Solution**: Créez les buckets Supabase Storage (voir section 3 de l'installation).

### Erreur "OpenAI API key not configured"

**Solution**: 
- Si vous voulez utiliser l'IA : Ajoutez `OPENAI_API_KEY` dans `.env`
- Sinon : C'est normal, la génération IA ne sera pas disponible

### Erreur "sharp" lors du npm install

**Solution**: 
```bash
npm install --platform=darwin --arch=arm64 sharp
```

### Upload échoue avec erreur CORS

**Solution**: Vérifiez que les buckets Supabase sont configurés en "public".

---

## 📁 Structure des Fichiers Créés

```
backend/
├── routes/
│   ├── campaigns.js              # Routes campagnes utilisateurs
│   ├── upload.js                 # Routes upload fichiers
│   ├── ai.js                     # Routes génération IA
│   └── admin-campaigns.js        # Routes admin
├── services/
│   ├── upload-service.js         # Service upload Supabase
│   └── ai-generator-service.js   # Service génération IA
├── config/
│   └── supabase.js               # Config Supabase
├── CAMPAIGNS_API_README.md       # Documentation API
└── package.json                  # Dépendances mises à jour

frontend/
├── src/
│   ├── app/
│   │   ├── marketing/
│   │   │   └── publicite/
│   │   │       ├── page.tsx                  # Page principale
│   │   │       ├── banner-home/page.tsx      # Bannière accueil
│   │   │       ├── banner-feed/page.tsx      # Bannière feed
│   │   │       ├── video-home/page.tsx       # Vidéo home
│   │   │       └── article-trending/page.tsx # Article sponsorisé
│   │   └── admin/
│   │       └── campaigns/page.tsx            # Admin campagnes
│   └── components/
│       └── layout/
│           └── Sidebar.tsx                   # Section Marketing ajoutée

database/
└── Supabase
    ├── campaigns (table)
    └── campaign_analytics (table)
```

---

## 📊 Prochaines Étapes

### Court Terme
- [ ] Tester toutes les pages de création
- [ ] Tester l'upload d'images
- [ ] Tester la génération d'articles IA
- [ ] Tester l'interface admin

### Moyen Terme
- [ ] Implémenter JWT pour authentification
- [ ] Ajouter système de paiement (Mobile Money)
- [ ] Emails de notification (création, validation)
- [ ] Affichage des publicités sur le site
- [ ] Dashboard analytics avancé

### Long Terme
- [ ] A/B Testing des publicités
- [ ] Ciblage géographique
- [ ] Optimisation automatique (IA)
- [ ] Renouvellement automatique
- [ ] Système d'enchères

---

## 📞 Support

- Documentation API: `backend/CAMPAIGNS_API_README.md`
- Documentation Système: `SYSTEME_PUBLICITE_README.md`
- Base de données: Tables créées via MCP Supabase

**Tout est prêt côté code !** 🎉

Il reste à :
1. Installer `sharp` : `npm install`
2. Créer les buckets Supabase
3. Ajouter la clé OpenAI (optionnel)
4. Redémarrer le serveur

**Status**: ✅ Backend complet | ✅ Frontend complet | ✅ BDD créée

