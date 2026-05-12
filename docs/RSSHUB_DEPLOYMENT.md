# 📡 Déployer RSSHub sur Railway

RSSHub est un microservice qui génère des flux RSS depuis Facebook, Twitter,
YouTube, Instagram, Telegram… (sources qui n'exposent pas de RSS nativement).

On le déploie comme **service séparé** sur Railway, à côté du backend Gabon
Insight. Les URLs générées par RSSHub sont ensuite ajoutées dans la table
`rss_feeds` (via `/admin/rss-monitoring` ou la migration SQL).

---

## ⏱️ Déploiement en 5 minutes

### 1. Créer le service Railway

1. Aller sur https://railway.app/dashboard
2. Cliquer **New Project** → **Deploy from Docker Image**
3. Image Docker : `diygod/rsshub:latest`
4. Cliquer **Deploy**

### 2. Configurer les variables d'environnement

Onglet **Variables** du service `rsshub` :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `CACHE_TYPE` | `memory` | Cache local (pas besoin de Redis pour démarrer) |
| `CACHE_EXPIRE` | `3600` | TTL cache 1h (économise des appels) |
| `CACHE_CONTENT_EXPIRE` | `7200` | TTL contenu 2h |
| `LISTEN_INET6` | `false` | Évite warnings IPv6 |
| `PORT` | `1200` | Port par défaut RSSHub |
| `REQUEST_RETRY` | `1` | Réessaie 1x en cas d'erreur transient |
| `ACCESS_KEY` | `(génère un secret 32 chars)` | Protège ton instance — voir section "Sécurité" |

**Génère ton ACCESS_KEY** :
```bash
openssl rand -hex 16
# ex: 8f3a91c7b2e4d6a8f1b3c5d7e9a2f4b6
```

### 3. Exposer un domaine public

Onglet **Settings** → **Networking** :
- **Generate Domain** → Railway te donne `rsshub-production-xxxx.up.railway.app`
- **Custom Domain** (optionnel) : `rsshub.gaboninsight.com`

Note l'URL : c'est ton **`__RSSHUB_HOST__`** à utiliser partout.

### 4. Tester

```bash
# Sans ACCESS_KEY
curl "https://rsshub-production-xxxx.up.railway.app/facebook/page/presidencegouvga"

# Avec ACCESS_KEY (recommandé pour la prod)
curl "https://rsshub-production-xxxx.up.railway.app/facebook/page/presidencegouvga?key=TON_ACCESS_KEY"
```

Tu devrais voir du XML RSS avec les derniers posts de la page.

---

## 🔒 Sécurité — ACCESS_KEY

Sans clé, ton RSSHub est utilisable par n'importe qui sur Internet → risque
d'abus (consommation CPU/bande passante, IP bannie par Facebook…).

Avec `ACCESS_KEY` configurée, RSSHub exige un paramètre `?key=...` ou
`?code=...` (hash MD5 de la route+key) sur toutes les requêtes.

**Pour Gabon Insight**, on utilise simplement `?key=TON_KEY` à la fin de
chaque URL stockée dans `rss_feeds`.

---

## 💰 Coûts

- RAM : ~150-300 Mo selon usage
- CPU : pic à chaque sync (toutes les 15 min)
- **Coût Railway estimé : 3-5 $/mois** (vs ~19 $/mois pour rss.app)

---

## 📋 Routes RSSHub utiles pour Gabon Insight

| Source | Route |
|---|---|
| Page Facebook publique | `/facebook/page/<slug>` |
| Compte Twitter / X | `/twitter/user/<username>` |
| Chaîne YouTube (par username) | `/youtube/user/<username>` |
| Chaîne YouTube (par channel_id) | `/youtube/channel/<id>` |
| Telegram canal | `/telegram/channel/<name>` |
| Compte Instagram | `/instagram/user/<username>` |
| TikTok | `/tiktok/user/@<username>` |

📚 Catalogue complet : https://docs.rsshub.app/

---

## 🧭 Mapping des ministères gabonais → URLs RSSHub

Une fois RSSHub déployé, voici les URLs à mettre dans `rss_feeds`
(remplace `__RSSHUB_HOST__` par ton domaine Railway) :

```
__RSSHUB_HOST__/facebook/page/presidencegouvga              # Présidence
__RSSHUB_HOST__/facebook/page/communicationgouvga           # Communication
__RSSHUB_HOST__/facebook/page/agriculturegouvga             # Agriculture
__RSSHUB_HOST__/facebook/page/numeriquegouvga               # Économie Numérique
__RSSHUB_HOST__/facebook/page/educationgouvga               # Éducation
__RSSHUB_HOST__/facebook/page/esupgouvga                    # Enseignement Supérieur
__RSSHUB_HOST__/facebook/page/ministereindustriegabon       # Industrie
__RSSHUB_HOST__/facebook/page/interieurgouvga               # Intérieur
__RSSHUB_HOST__/facebook/page/justicegouvga                 # Justice
__RSSHUB_HOST__/facebook/page/minesgouvga                   # Mines
__RSSHUB_HOST__/facebook/page/transportsgouvga              # Transports
__RSSHUB_HOST__/facebook/page/equipementgouvga              # Travaux Publics
__RSSHUB_HOST__/facebook/page/commercepmepmigouvga          # Commerce
__RSSHUB_HOST__/facebook/page/petrolegouvga                 # Pétrole
__RSSHUB_HOST__/facebook/page/tourismegouvga                # Tourisme
__RSSHUB_HOST__/facebook/page/eaugouvga                     # Énergie
__RSSHUB_HOST__/facebook/page/habitatgouvga                 # Logement
```

Si tu utilises ACCESS_KEY, ajoute `?key=TON_KEY` à la fin.

---

## 🚀 Une fois RSSHub déployé : 3 façons d'ajouter les flux

### Option 1 — Migration SQL en bulk (rapide)

Édite [backend/migrations/migrate_rss_to_native_urls.sql](../backend/migrations/migrate_rss_to_native_urls.sql),
fais une **recherche-remplace** de `__RSSHUB_HOST__` par ton domaine Railway,
puis exécute sur Supabase SQL Editor.

### Option 2 — UI admin (cas par cas)

Va sur `/admin/rss-monitoring`, clique **Ajouter un flux** pour chaque
ministère. Plus de contrôle, plus lent.

### Option 3 — Import groupé via le script seed

(à créer plus tard si tu ajoutes souvent des flux en bulk)

---

## 🔧 Troubleshooting

| Symptôme | Cause probable | Fix |
|---|---|---|
| HTTP 403 sur Facebook | Page privée ou Facebook bloque | Tester avec une autre page, ou utiliser un proxy résidentiel |
| HTTP 503 RSSHub | Service Railway endormi (free tier) | Passer en plan Hobby (5 $/mois) |
| Flux vide | Route invalide ou page sans publication récente | Tester `/facebook/page/<slug>` dans le navigateur |
| Lenteur | Cache trop court | Augmenter `CACHE_EXPIRE` à `7200` |
| Erreur ACCESS_KEY | Clé non incluse dans l'URL | Ajouter `?key=...` |

---

## 🔄 Mise à jour de RSSHub

L'image `diygod/rsshub:latest` est rebuildée régulièrement. Sur Railway :
**Settings** → **Redeploy** force un pull de la dernière image.

Pour épingler une version stable :
```
Image: diygod/rsshub:2026-04-01
```
