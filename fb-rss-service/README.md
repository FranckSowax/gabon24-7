# fb-rss-service

Microservice qui génère un flux RSS 2.0 à partir d'une page Facebook publique
en scrapant `mbasic.facebook.com` (HTML mobile léger).

Utilisé par Gabon Insight pour les **pages des ministères gabonais** et la
**Présidence de la République** — sources qui n'exposent pas de RSS natif.

---

## 🛠️ Routes

| Route | Description |
|---|---|
| `GET /` | Health check (JSON status, cache, cookie configuré) |
| `GET /feed/:slug` | RSS XML des derniers posts de `facebook.com/<slug>` |

Exemple :
```
GET /feed/presidencegouvga
→ application/rss+xml
```

---

## 🔑 Variables d'environnement

| Var | Obligatoire | Description |
|---|---|---|
| `FB_COOKIE` | ✅ | Cookie de session Facebook complet (voir ci-dessous) |
| `PORT` | ❌ | Port d'écoute (défaut 3000) |
| `CACHE_TTL_MS` | ❌ | TTL cache mémoire en ms (défaut 1h = 3 600 000) |
| `FETCH_TIMEOUT_MS` | ❌ | Timeout requête FB en ms (défaut 15 000) |
| `USER_AGENT` | ❌ | User-Agent custom (défaut Chrome Android) |

---

## 🍪 Comment récupérer le `FB_COOKIE`

Le service a besoin d'un cookie de session FB valide. **Compte burner conseillé**
(Facebook peut bannir un compte qu'il détecte comme automatisé).

### Étapes

1. Crée un compte Facebook dédié (ou utilise un compte secondaire)
2. Connecte-toi à https://mbasic.facebook.com (version mobile)
3. Ouvre les **DevTools** du navigateur (F12)
4. Onglet **Application** (Chrome) ou **Storage** (Firefox) → **Cookies** → `https://mbasic.facebook.com`
5. Copie **tous les cookies** sous forme `nom1=valeur1; nom2=valeur2; ...`
   - Clés essentielles : `c_user`, `xs`, `datr`, `fr`, `sb`
6. Colle la chaîne complète dans la variable `FB_COOKIE` sur Railway

Le cookie expire généralement après 1-3 mois — il faudra le renouveler.

### Astuce : extension navigateur

Tu peux utiliser une extension comme **Cookie-Editor** (Chrome/Firefox) qui
exporte directement au format string `key=value; key=value; ...`.

---

## 🚀 Déploiement Railway

Le service est conçu pour tourner sur Railway comme **service séparé**
du backend principal. Il est isolé pour :

- Pouvoir scale indépendamment
- Éviter de polluer le quota du backend
- Permettre redéploiement sans toucher au reste

### Setup initial

1. Sur Railway → **New** → **Empty Service** → connect ce repo
2. **Root directory** : `fb-rss-service`
3. Variables d'env : ajouter `FB_COOKIE` (voir section précédente)
4. **Generate Domain** → on obtient `fb-rss-xxx.up.railway.app`
5. Tester : `curl https://fb-rss-xxx.up.railway.app/feed/presidencegouvga`

---

## 🔌 Intégration dans rss_feeds

Une fois le service en ligne, mettre à jour les URLs des 20 flux Facebook
désactivés en DB Supabase :

```sql
UPDATE rss_feeds
SET url = 'https://fb-rss-xxx.up.railway.app/feed/<slug>',
    status = 'active',
    last_error = NULL,
    updated_at = NOW()
WHERE name ILIKE '%<nom_ministère>%' AND status = 'inactive';
```

Slugs Facebook (voir `backend/server.js` mapping `getMediaNameFromUrl`) :

| Ministère | Slug |
|---|---|
| Présidence | `presidencegouvga` |
| Communication | `communicationgouvga` |
| Agriculture | `agriculturegouvga` |
| Éducation Nationale | `educationgouvga` |
| Enseignement Supérieur | `esupgouvga` |
| Industrie | `ministereindustriegabon` |
| Intérieur | `interieurgouvga` |
| Justice | `justicegouvga` |
| Mines | `minesgouvga` |
| Transports | `transportsgouvga` |
| Travaux Publics | `equipementgouvga` |
| Commerce | `commercepmepmigouvga` |
| Pétrole | `petrolegouvga` |
| Tourisme | `tourismegouvga` |
| Énergie | `eaugouvga` |
| Logement | `habitatgouvga` |
| Économie Numérique | `numeriquegouvga` |
| Travail | (à confirmer) |

---

## ⚠️ Limitations connues

- **Facebook change son DOM régulièrement** : les sélecteurs CSS du parser
  peuvent casser. Si `/feed/<slug>` renvoie *"Aucun post trouvé"*, c'est
  probablement ça → revoir les sélecteurs dans `server.js`
- **Rate limiting Facebook** : si trop de requêtes en peu de temps, FB peut
  bloquer le cookie temporairement (HTTP 429 ou login forcé). Le cache 1h
  limite ce risque.
- **Compte burner peut être suspendu** : si ça arrive, créer un nouveau
  compte et mettre à jour `FB_COOKIE`.
- **Date des posts non extraite** : mbasic n'expose pas toujours une date
  parsable. Les posts héritent de `pubDate = maintenant` (peut créer des
  doublons côté dédup par titre — utiliser le titre comme clé de dédup).

---

## 🧪 Test local

```bash
cd fb-rss-service
npm install
FB_COOKIE="c_user=...; xs=...; datr=..." npm start

# Dans un autre terminal :
curl http://localhost:3000/feed/presidencegouvga
```

---

## 📦 Stack

- Node.js 20+
- Express 4
- Cheerio 1 (parsing HTML)
- `fetch` natif Node 18+
- Cache mémoire (pas de Redis nécessaire)

---

## 🔄 Alternatives si ce service casse

1. **RSSHub avec cookies** (déjà déployé, route Facebook hors service en version actuelle)
2. **Renouveler rss.app** uniquement pour ces 20 flux (~10-20$/mois)
3. **Service tiers** : FetchRSS, Feedity, etc.
4. **Migrer vers Twitter/X officiel** des ministères s'ils ont un compte actif
