# 🚀 CHECKLIST PRODUCTION GABON24-7

## ✅ CORRECTIONS EFFECTUÉES

### 1. Sécurité - Clés API
- [x] `whapiService.js` - Token Whapi déplacé vers `process.env.WHAPI_TOKEN`
- [x] `server.js` - Clé RapidAPI Football déplacée vers `process.env.RAPIDAPI_KEY`
- [x] `server.js` - Clé RapidAPI TikTok déplacée vers `process.env.RAPIDAPI_KEY`
- [x] `weather.js` - Clé RapidAPI Météo déplacée vers `process.env.RAPIDAPI_KEY`
- [x] `WeatherWidget.tsx` - Clé RapidAPI supprimée (utilise backend proxy)

### 2. Rate Limiting
- [x] Rate limiting général: 100 requêtes / 15 minutes par IP
- [x] Rate limiting IA: 20 requêtes / 15 minutes
- [x] Rate limiting Auth: 5 tentatives / 15 minutes

### 3. Documentation
- [x] `.env.example` mis à jour avec toutes les variables nécessaires

### 4. Correctifs Bugs & Améliorations (Dec 2025)
- [x] **Publicité:** Correction du prix bannière accueil (50 000 FCFA/semaine)
- [x] **Projets:** Ajout bouton "Sauvegarder" dans l'analyseur d'opportunités
- [x] **Actu++:** Ajout de l'endpoint de sauvegarde `/api/actu-plus/save`
- [x] **Journal TV:** Correction ID chaîne YouTube (Gabon 24) + Fallback auto sur dernière vidéo
- [x] **Gemini 3:** Migration complète des fonctions IA (Text, JSON, Image)
- [x] **Replicate:** Conservation pour TTS et Fallback Image

---

## ⚠️ ACTIONS REQUISES AVANT PRODUCTION

### 1. Configurer les variables d'environnement Railway

**CRITIQUE :** Ajouter `SUPABASE_SERVICE_ROLE_KEY` pour que les fonctions backend (crédits, sondages) fonctionnent correctement.

```bash
# Dans Railway Dashboard > Variables, ajouter:

# OBLIGATOIRES
GEMINI_API_KEY=AIza...
REPLICATE_API_TOKEN=r8_... (Pour TTS et Fallback)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Clé SERVICE_ROLE (pas anon!)
RAPIDAPI_KEY=c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7
WHAPI_TOKEN=fKUGctmyoUq5pex25GdAcjrUyjl55nrd
SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
NODE_ENV=production

# OPTIONNELLES
OPENAI_API_KEY=sk-proj-...
JWT_SECRET=un_secret_fort_32_chars
```

### 2. Renouveler le token Replicate

Le token actuel est invalide (erreur 401). Pour le renouveler:

1. Aller sur https://replicate.com/account/api-tokens
2. Créer un nouveau token
3. Mettre à jour dans Railway

### 3. Configurer les variables Netlify

Dans Netlify Dashboard > Site settings > Environment variables:

```bash
NEXT_PUBLIC_API_URL=https://gabon24-7-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://ykytsadwfqoyusleoflf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Vérifier les fonctions Netlify Scheduled

Tester chaque fonction dans Netlify Dashboard > Functions:

- [ ] `scheduled-rss-sync` (*/15 min)
- [ ] `scheduled-ai-processor` (*/3 min)
- [ ] `process-ticker-news` (*/3h)
- [ ] `scheduled-alert-processor` (*/5 min)
- [ ] `scheduled-digest-notifications` (8h UTC)
- [ ] `generate-daily-poll` (18h UTC)
- [ ] `scheduled-poll-closer` (18h55 UTC)
- [ ] `scheduled-poll-publisher` (19h UTC)
- [ ] `scheduled-audio-daily` (6h UTC)
- [ ] `scheduled-audio-cleanup` (*/1h)

### 5. Backup base de données

Avant mise en production, effectuer un backup Supabase:
1. Supabase Dashboard > Settings > Database
2. Backups > Create backup

---

## 📊 MÉTRIQUES À SURVEILLER

### Performance
- Temps de réponse API < 500ms
- Taux d'erreur < 1%
- Uptime > 99.5%

### Sécurité
- Tentatives de connexion échouées
- Requêtes bloquées par rate limiting
- Erreurs CORS

### Business
- Nombre d'articles RSS synchronisés
- Générations IA par jour
- Notifications WhatsApp envoyées

---

## 🔧 COMMANDES UTILES

```bash
# Tester le backend localement
cd backend && npm run dev

# Tester le frontend localement
cd frontend && npm run dev

# Vérifier les logs Railway
railway logs

# Vérifier les logs Netlify
netlify functions:list
```

---

## 📞 CONTACTS SUPPORT

- **Supabase**: https://supabase.com/dashboard/support
- **Railway**: https://railway.app/help
- **Netlify**: https://www.netlify.com/support/
- **Replicate**: https://replicate.com/support

---

*Dernière mise à jour: 2 décembre 2025*
