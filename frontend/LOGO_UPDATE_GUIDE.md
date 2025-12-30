# 🎨 Guide de Mise à Jour du Logo - Gabon Insight

## ✅ Modifications Effectuées

Toutes les références à "Gabon 24/7" ont été remplacées par "Gabon Insight" dans :

### Frontend
- ✅ `/frontend/src/app/layout.tsx` - Métadonnées et SEO
- ✅ `/frontend/src/components/layout/Header.tsx` - Logo du header
- ✅ `/frontend/src/app/page.tsx` - Page d'accueil
- ✅ `/frontend/src/app/admin/layout.tsx` - Interface admin
- ✅ `/frontend/src/app/admin/page.tsx` - Dashboard admin
- ✅ `/frontend/src/app/campaign-request/page.tsx`
- ✅ `/frontend/src/app/advertise/page.tsx`
- ✅ `/frontend/src/app/archives-generales/page.tsx`
- ✅ `/frontend/src/app/sondages/page.tsx`
- ✅ `/frontend/src/app/auth/signin/page.tsx`
- ✅ `/frontend/src/app/article/[id]/ArticlePageClient.tsx`
- ✅ `/frontend/src/components/features/ArticleCard.tsx`
- ✅ `/frontend/src/components/widgets/YouTubeWidget.tsx`

### Backend
- ✅ `/backend/server.js` - API messages et logs

## 📸 Installation du Nouveau Logo

### Étape 1: Sauvegarder le Logo

Sauvegardez l'image du logo fournie dans le dossier public :

```bash
# Depuis la racine du projet
mv /path/to/your/logo.png /Volumes/Samsung_T5/gabon24-7-main/frontend/public/gabon-insight-logo.png
```

**OU** manuellement :
1. Ouvrez le Finder
2. Naviguez vers `/Volumes/Samsung_T5/gabon24-7-main/frontend/public/`
3. Copiez-collez l'image du logo
4. Renommez-la en `gabon-insight-logo.png`

### Étape 2: Vérifier l'Image

Le fichier doit être:
- **Format:** PNG (avec transparence recommandée)
- **Dimensions recommandées:** 600x200 pixels minimum
- **Nom:** `gabon-insight-logo.png`
- **Emplacement:** `/frontend/public/gabon-insight-logo.png`

### Étape 3: Redémarrer l'Application

```bash
# Redémarrer le frontend
cd /Volumes/Samsung_T5/gabon24-7-main/frontend
npm run dev

# Redémarrer le backend (si nécessaire)
cd /Volumes/Samsung_T5/gabon24-7-main/backend
node server.js
```

## 🔍 Vérification

1. **Header:** Le nouveau logo apparaît dans le header de toutes les pages
2. **Favicon:** Vérifier l'icône dans l'onglet du navigateur
3. **Meta tags:** Vérifier les aperçus sur les réseaux sociaux

### Tests Rapides

```bash
# Vérifier que le fichier existe
ls -lh /Volumes/Samsung_T5/gabon24-7-main/frontend/public/gabon-insight-logo.png

# Ouvrir l'application
open http://localhost:3000
```

## 📝 Références Mises à Jour

### Titre de l'Application
- **Ancien:** "Gabon 24/7"
- **Nouveau:** "Gabon Insight"

### Métadonnées SEO
```typescript
title: 'Gabon Insight - Actualités Gabonaises via WhatsApp'
siteName: 'Gabon Insight'
creator: 'Gabon Insight'
publisher: 'Gabon Insight'
```

### Messages Partage
```
Via Gabon Insight
```

### API Backend
```
Service: 'Gabon Insight API'
Console: 'Serveur Gabon Insight démarré sur le port 3001'
```

## 🎯 Prochaines Étapes

1. ✅ Placer le logo dans `/frontend/public/gabon-insight-logo.png`
2. ✅ Redémarrer l'application
3. ✅ Vérifier l'affichage sur toutes les pages
4. ⬜ Mettre à jour les favicons si nécessaire
5. ⬜ Mettre à jour les images Open Graph pour les réseaux sociaux

## 🔧 Dépannage

### Le logo ne s'affiche pas
```bash
# Vérifier le chemin
ls /Volumes/Samsung_T5/gabon24-7-main/frontend/public/gabon-insight-logo.png

# Vider le cache du navigateur
# Chrome: Cmd+Shift+R
# Firefox: Cmd+Shift+R
# Safari: Cmd+Option+R
```

### Le logo est trop grand/petit
Modifiez la classe CSS dans `/frontend/src/components/layout/Header.tsx`:
```tsx
className="h-8 sm:h-9 md:h-10 w-auto object-contain select-none"
// Ajustez h-8, h-9, h-10 selon vos besoins
```

---

**Date de mise à jour:** 2025-10-09
**Version:** 1.0.0
