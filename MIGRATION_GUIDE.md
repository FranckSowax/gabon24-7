# Guide de Migration Netlify → Express API

## ✅ Migration Terminée

Tous les appels `/.netlify/functions/*` ont été migrés vers l'API Express (`http://localhost:3001`).

## 🚀 Démarrage Rapide

### 1. Démarrer le Backend Express
```bash
cd backend
npm install  # Si nécessaire
npm start    # Port 3001
```

### 2. Démarrer le Frontend Next.js
```bash
cd frontend
npm install  # Si nécessaire
npm run dev  # Port 3000
```

### 3. Tester l'Application
Ouvrir http://localhost:3000 dans le navigateur

## 📋 Endpoints Migrés

### Articles
- ✅ `GET /api/homepage/articles` - Articles page d'accueil
- ✅ `GET /api/articles/trending?period=day|week` - Articles tendance
- ✅ `GET /api/articles/week` - Articles de la semaine
- ✅ `GET /api/articles/archives` - Archives
- ✅ `POST /api/articles/:id/view` - Tracking des vues

### Événements
- ✅ `GET /api/events` - Liste des événements

### Sondages
- ✅ `GET /api/polls` - Liste des sondages
- ✅ `POST /api/polls/questions` - Questions d'un sondage
- ✅ `GET /api/polls/stats?question_id=X` - Statistiques
- ✅ `POST /api/polls/check-votes` - Vérifier si utilisateur a voté
- ✅ `POST /api/polls/vote` - Enregistrer un vote

### Slides Publicitaires
- ✅ `GET /api/slides` - Liste des slides
- ✅ `POST /api/slides` - Tracking vues/clics

### Trajets/Routes
- ✅ `GET /api/routes` - Trajets Google Maps

### Crédits
- ✅ `GET /api/credits/stats?type=balance&userId=X` - Solde
- ✅ `GET /api/credits/packages` - Packages disponibles
- ✅ `POST /api/credits/packages` - Acheter un package
- ✅ `POST /api/credits/manage` - Gérer les crédits

### Utilisateur
- ✅ `GET /api/user/history?userId=X` - Historique de lecture

### Opportunités
- ✅ `POST /api/opportunities/enhance` - Enrichissement IA

### Météo
- ✅ `GET /api/weather/:city` - Données météo

### YouTube
- ✅ `GET /api/youtube` - Vidéos YouTube

## 🧪 Tests à Effectuer

### Page d'Accueil
- [ ] Les articles s'affichent (onglet "Pour Vous")
- [ ] Le clic sur un article incrémente le compteur de vues
- [ ] Les images s'affichent correctement

### Onglet Tendances
- [ ] Les articles tendance s'affichent
- [ ] Le tri par période fonctionne (jour/semaine)

### Onglet Cette Semaine
- [ ] Les articles de 36h-7j s'affichent

### Onglet Archives
- [ ] Les articles >7j s'affichent

### Widgets
- [ ] Événements s'affichent (EventsSlider)
- [ ] Météo fonctionne (WeatherWidget)
- [ ] Vidéos YouTube chargent (YouTubeWidget)
- [ ] Slides pub s'affichent (PromotionalSlider)
- [ ] Trajets Google Maps (RoutesMapWidget)
- [ ] Sondages fonctionnent (MultiQuestionPollWidget)
- [ ] Profil utilisateur et crédits (UserProfileWidget)

## ⚠️ Points d'Attention

### Image Proxy
L'image proxy reste temporairement sur Netlify:
- `/.netlify/functions/image-proxy`
- À migrer vers `/api/image-proxy` avec cache CDN

### Variables d'Environnement
Pour la production, mettre à jour `.env`:
```bash
NEXT_PUBLIC_API_URL=https://votre-domaine-api.com
```

## 🔧 Optimisations Recommandées

### Pour Fort Trafic
1. **Cache Redis**: Ajouter Redis pour cache articles/tendances
2. **Pool DB**: Vérifier les limites de connexion Supabase
3. **CDN**: Configurer CDN (Cloudflare) pour assets/images
4. **Rate Limiting**: Ajouter `express-rate-limit`
5. **Monitoring**: Mettre en place logs centralisés (Winston + Datadog)
6. **Load Balancer**: Nginx ou AWS ALB si scaling nécessaire

### Prochaines Étapes
1. Migrer image-proxy vers Express avec cache
2. Ajouter tests unitaires (Jest)
3. Ajouter tests e2e (Playwright/Cypress)
4. Configurer CI/CD
5. Déployer backend (Railway/Render/Fly.io)
6. Déployer frontend (Vercel/Netlify statique)

## 📊 Avantages de la Migration

✅ **Latence stable** - Pas de cold starts  
✅ **Pool DB réutilisé** - Pas d'explosion des connexions  
✅ **Cache mémoire** - Plus rapide qu'invocations serverless  
✅ **Coûts prévisibles** - Pas de pay-per-invocation  
✅ **Contrôle total** - Logs, métriques, debugging facile  
✅ **Architecture claire** - Frontend/Backend séparés  

## 🐛 Debugging

### Backend ne démarre pas
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm start
```

### Frontend erreurs CORS
Vérifier que `backend/server.js` a:
```javascript
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
```

### Erreurs 404 sur API
1. Vérifier que le backend tourne (port 3001)
2. Vérifier `NEXT_PUBLIC_API_URL` dans `.env.local`
3. Regarder les logs du backend

### Articles ne chargent pas
1. Vérifier connexion Supabase dans backend
2. Vérifier logs backend pour erreurs SQL
3. Tester endpoint directement: `curl http://localhost:3001/api/homepage/articles`

## 📞 Support

Pour toute question ou problème:
1. Vérifier les logs backend (terminal backend)
2. Vérifier console navigateur (F12)
3. Tester endpoint directement avec curl/Postman

## 🎉 Félicitations!

Votre application est maintenant migrée vers une architecture Express traditionnelle, 
optimisée pour gérer du trafic élevé avec stabilité et performance.
