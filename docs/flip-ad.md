# 🟧 Flip Ad — Animation publicitaire sur la carte profil

## Comment ça marche

Au clic sur n'importe quel bouton de la **section Business** de la sidebar
(BCEG Project / Créer un Projet / Mes Projets), la carte profil orange en
haut de la sidebar **pivote en 3D** pour révéler une carte publicitaire BCEG
au verso. La pub reste visible pendant **N secondes** (configurable, 4 s par
défaut) puis la carte revient automatiquement à la face profil.

**La navigation est immédiate** — l'animation joue en filigrane pendant que
la nouvelle page se charge, donc pas de décalage perçu.

### Comportements

- **Rejouable** : un nouveau clic pendant l'animation annule le timer en
  cours et relance l'animation depuis le début.
- **Désactivable** : si la config est `enabled = false`, les boutons Business
  naviguent directement (l'animation est court-circuitée).
- **`prefers-reduced-motion`** : la rotation 3D est remplacée par un
  cross-fade simple.
- **Plage de diffusion** : si `starts_at` ou `ends_at` est défini, la pub
  n'est active que dans cette fenêtre.

## Architecture

```
frontend/src/components/flip-ad/
  ├── FlipAdContext.tsx       Provider + hook useFlipAd()
  ├── FlipProfileCard.tsx     Wrapper 3D (perspective + preserve-3d)
  └── FlipAdBack.tsx          Face arrière publicitaire

frontend/src/app/admin/flip-ad/page.tsx   Back-office admin

backend/routes/flip-ad.js     API Express
```

### Stack technique

- **CSS 3D** : `perspective: 1200px`, `transform-style: preserve-3d`,
  `backface-visibility: hidden` sur les deux faces.
- **Transition** : `transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)`.
- **ResizeObserver** synchronise la hauteur du wrapper avec celle de la
  carte profil (face avant).
- **Accessibilité** : `role="button"` + `aria-label` + `aria-pressed` +
  support `Enter`/`Space` quand le `redirect_mode` est `on_back_click`.

## Configuration via l'admin

### Accès

URL : `/admin/flip-ad` — **réservé aux utilisateurs `is_admin = true`**.

Lien dans la sidebar admin : **"Flip Ad"** (icône RotateCw, badge NEW), entre
"BCEG Sponsoring" et "Feedbacks".

### Champs configurables

| Champ | Type | Limite | Effet |
|---|---|---|---|
| `enabled` | toggle | — | Active/désactive l'animation |
| `image_url` | upload image | 2 Mo, PNG/JPG/WebP/SVG | Affichée en haut de la face arrière |
| `title` | text | 60 car. | Titre de la pub |
| `subtitle` | textarea | 160 car. | Sous-titre / description |
| `cta_label` | text | 40 car. | Label du CTA (ex: "Découvrir →") |
| `redirect_url` | URL | HTTPS ou chemin `/` | Cible de redirection |
| `redirect_mode` | radio | `none` / `after_flip` / `on_back_click` | Quand naviguer |
| `duration_ms` | slider | 1-10 s, pas 500 ms | Durée d'affichage de la face arrière |
| `background_css` | gradient CSS | regex linear/radial-gradient | Fond de la face arrière |
| `starts_at` / `ends_at` | datetime | — | Plage de diffusion (optionnel) |

### Modes de redirection

- **`none`** : juste l'animation, pas de navigation. Utile pour les pubs
  purement informatives sans action.
- **`after_flip`** (défaut) : navigation immédiate au clic, l'utilisateur
  voit la pub jouer pendant le chargement.
- **`on_back_click`** : navigation uniquement si l'utilisateur clique sur
  la face arrière.

### Aperçu live

L'admin a un **panneau d'aperçu sticky à droite** qui montre la pub avec
les paramètres en cours d'édition. Un bouton **"Tester l'animation"** ouvre
une modale qui rejoue le flip 3D complet.

## Configuration via SQL (urgence)

```sql
UPDATE public.flip_ad_config
SET
  enabled = true,
  title = 'Nouveau titre',
  duration_ms = 5000,
  updated_at = now()
WHERE id = (SELECT id FROM public.flip_ad_config ORDER BY created_at DESC LIMIT 1);
```

Le cache CDN (60 s sur `GET /api/flip-ad`) sera invalidé naturellement à
la prochaine fenêtre.

## Ajouter d'autres déclencheurs

Pour déclencher l'animation depuis un autre bouton :

1. Localise le lien dans la sidebar (`frontend/src/components/layout/Sidebar.tsx`).
2. Remplace son `onClick={() => onMobileClose?.()}` par :
   ```tsx
   onClick={(e) => handleBusinessClick(e, '/veille')}
   ```
3. C'est tout — le contexte `FlipAdContext` est déjà fourni en racine via
   `<FlipAdProvider>` dans `app/layout.tsx`.

Pour déclencher depuis un composant arbitraire :

```tsx
import { useFlipAd } from '@/components/flip-ad/FlipAdContext'

function MyComponent() {
  const { triggerFlip } = useFlipAd()
  return <button onClick={() => triggerFlip('/business/live-opportunities')}>Voir BCEG</button>
}
```

## API publique

`GET /api/flip-ad`

Renvoie la config active (au plus une — celle dans la fenêtre
`starts_at`/`ends_at`). Cache CDN 60 s.

```json
{
  "success": true,
  "config": {
    "id": "uuid",
    "enabled": true,
    "duration_ms": 4000,
    "redirect_url": "/business/live-opportunities",
    "redirect_mode": "after_flip",
    "image_url": "https://…/flip-ads/123.jpg",
    "title": "BCEG · Crédits dès 5 %",
    "subtitle": "Programme CATR / FAMAD…",
    "cta_label": "Découvrir →",
    "background_css": "linear-gradient(135deg, #697357…)",
    "starts_at": null,
    "ends_at": null
  }
}
```

## Modèle de données

Voir migrations Supabase :
- `create_flip_ad_config` : table principale + historique + RLS
- `create_flip_ads_bucket` : Storage bucket `flip-ads` + policies

### Historique (10 dernières snapshots)

Chaque `UPDATE` sur `flip_ad_config` déclenche un trigger qui copie l'état
précédent dans `flip_ad_config_history`. L'admin peut restaurer une
snapshot via `POST /api/flip-ad/restore/:historyId`.

## Sécurité

- **Backend** : `requireAuth + requireAdmin` sur PUT, POST sign-upload, GET history, POST restore.
- **RLS DB** : `is_admin = true` sur INSERT/UPDATE/DELETE. SELECT public uniquement pour les configs actives dans la fenêtre.
- **Storage** : bucket public en lecture (images doivent être chargées par tous les visiteurs), admin en écriture.
- **Validation** : sanitization HTML (`<[^>]*>` strippés), regex anti-`javascript:`/anti-`expression(` sur le gradient, URL acceptée uniquement `https://` ou `/`.
- **Taille** : 2 Mo max au niveau du bucket.

## Désactivation d'urgence

```sql
UPDATE public.flip_ad_config SET enabled = false WHERE id IN (
  SELECT id FROM public.flip_ad_config
);
```

Les boutons Business reviennent à un comportement de navigation directe en
moins de 60 secondes (TTL cache).
