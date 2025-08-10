# GabonNews WhatsApp SaaS

Une plateforme SaaS qui agrège les actualités gabonaises depuis les flux RSS, utilise l'API GPT pour la synthèse d'articles, et distribue des actualités personnalisées via WhatsApp.

## 🎯 Fonctionnalités Principales

- **Agrégation RSS** : Surveillance continue des médias gabonais
- **IA Summarization** : Résumés automatiques avec GPT-5
- **Distribution WhatsApp** : Canal gratuit + messages directs premium
- **Filtrage Personnalisé** : Mots-clés et catégories sur mesure
- **Outils Éditoriaux** : Génération de contenu pour journalistes
- **Paiements Mobile Money** : Airtel Money & Moov Money

## 💰 Tarification

- **GRATUIT** : Accès au canal WhatsApp public
- **PREMIUM** : 2,500 XAF - Messages personnalisés + filtres
- **JOURNALISTE** : 5,000 XAF - Outils éditoriaux complets

## 🛠 Stack Technique

### Frontend
- **Next.js 14** avec App Router
- **React 18** + **TypeScript 5**
- **Tailwind CSS** + **Shadcn/ui**
- **Zustand** (état global) + **TanStack Query** (données serveur)

### Backend
- **Node.js** + **Express**
- **Supabase** (PostgreSQL)
- **Redis** (cache) + **BullMQ** (queues)
- **OpenAI GPT API** + **Whapi API**

### Infrastructure
- **Docker** containerization
- **Load Balancer** + microservices
- **Monitoring** & **Security** complets

## 📁 Structure du Projet

```
gabon-24-7-saas/
├── frontend/          # Application Next.js
├── backend/           # API Node.js + Workers
├── shared/            # Types et utilitaires partagés
├── documentations/    # Documentation complète
└── docker/           # Configuration Docker
```

## 🚀 Démarrage Rapide

```bash
# Installation des dépendances
npm install

# Configuration de l'environnement
cp .env.example .env.local

# Démarrage en développement
npm run dev
```

## 📋 Roadmap

- [x] Analyse de la documentation
- [ ] Configuration de l'infrastructure de base
- [ ] Développement de l'API backend
- [ ] Interface utilisateur frontend
- [ ] Intégration WhatsApp et paiements
- [ ] Tests et déploiement

## 🔒 Sécurité

- Authentification JWT sécurisée
- Chiffrement des données sensibles
- Conformité GDPR
- Audit de sécurité complet

---

**Développé pour l'écosystème médiatique gabonais** 🇬🇦
