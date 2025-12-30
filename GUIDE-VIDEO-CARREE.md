# 📹 Guide: Créer une Vidéo Carrée 1080x1080 pour Vidéo Home

## ⚠️ FORMAT REQUIS

**Résolution OBLIGATOIRE:** 1080x1080 pixels (format carré 1:1)

### Pourquoi le format carré?
- ✅ **S'adapte parfaitement desktop ET mobile** sans déformation
- ✅ Pas de bandes noires sur les côtés
- ✅ Format standard des réseaux sociaux (Instagram, Facebook)
- ✅ Maximise l'espace d'affichage dans le modal
- ✅ Même expérience visuelle sur tous les appareils

---

## 🎯 Spécifications Techniques

| Paramètre | Valeur |
|-----------|--------|
| **Résolution** | 1080x1080 pixels (obligatoire) |
| **Ratio d'aspect** | 1:1 (carré) |
| **Format** | MP4 (codec H.264) recommandé |
| **Durée** | 15-30 secondes |
| **Taille max** | 10 MB |
| **Framerate** | 30 fps ou 60 fps |
| **Audio** | Optionnel (la vidéo sera en autoplay muted) |

---

## 🛠️ Méthodes de Création

### 1. Canva (Recommandé - Facile) ⭐

**Avantages:** Interface visuelle, templates, gratuit

**Étapes:**
1. Aller sur [canva.com](https://www.canva.com)
2. Créer un design → "Custom size"
3. Dimensions: **1080 x 1080 px**
4. Importer votre vidéo/images
5. Ajuster au format carré
6. Ajouter texte, animations, effets
7. Télécharger → MP4

**Tutoriel:** [Guide Canva Vidéo Carrée](https://www.canva.com/learn/square-video/)

---

### 2. Adobe Premiere Pro (Professionnel) 🎬

**Avantages:** Contrôle total, qualité maximale

**Étapes:**
1. Nouveau projet
2. Séquence → Réglages personnalisés
   - Largeur: **1080**
   - Hauteur: **1080**
   - Framerate: 30 fps
3. Importer vos médias
4. Éditer votre vidéo
5. Fichier → Exporter → Média
   - Format: H.264
   - Résolution: 1080x1080
   - Bitrate: 5-8 Mbps (pour rester sous 10MB)

---

### 3. CapCut (Mobile & Desktop) 📱

**Avantages:** Gratuit, facile, mobile-friendly

**Étapes:**
1. Télécharger CapCut (iOS, Android, Windows, Mac)
2. Nouveau projet
3. Ratio → 1:1 (carré)
4. Importer vidéo
5. Ajuster et éditer
6. Exporter en 1080p

---

### 4. FFmpeg (Ligne de commande - Avancé) 💻

**Avantages:** Automatisation, batch processing, gratuit

**Convertir une vidéo existante en carré:**

```bash
# Méthode 1: Recadrage centré (crop)
ffmpeg -i input.mp4 \
  -vf "crop=min(iw\,ih):min(iw\,ih),scale=1080:1080" \
  -c:v libx264 -preset slow -crf 22 \
  -c:a aac -b:a 128k \
  output-square.mp4

# Méthode 2: Padding avec fond noir
ffmpeg -i input.mp4 \
  -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset slow -crf 22 \
  -c:a aac -b:a 128k \
  output-square-padded.mp4

# Méthode 3: Padding avec fond flouté
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=20[bg];[0:v]scale=1080:1080:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" \
  -c:v libx264 -preset slow -crf 22 \
  -c:a aac -b:a 128k \
  output-square-blur.mp4
```

**Installer FFmpeg:**
- Mac: `brew install ffmpeg`
- Windows: [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
- Linux: `sudo apt install ffmpeg`

---

### 5. HandBrake (Compression) 🗜️

**Avantages:** Réduire la taille si vidéo > 10MB

**Étapes:**
1. Télécharger [HandBrake](https://handbrake.fr/)
2. Ouvrir votre vidéo carrée
3. Dimensions → Résolution: 1080x1080
4. Video → Quality: RF 22-25 (compromis qualité/taille)
5. Audio → Codec: AAC, Bitrate: 128 kbps
6. Start Encode

---

## 📐 Conseils de Composition Vidéo Carrée

### Zone de sécurité (Safe Zone)
```
┌─────────────────────────┐
│  [Marge 50px]           │  ← Éviter texte important
│  ┌─────────────────┐    │
│  │                 │    │
│  │  CONTENU SAFE   │    │  ← Zone sûre pour texte/logo
│  │                 │    │
│  └─────────────────┘    │
│  [Marge 50px]           │  ← Éviter boutons
└─────────────────────────┘
```

### Composition recommandée:
1. **Zone centrale:** Message principal
2. **Haut:** Logo ou branding (petite taille)
3. **Bas:** Call-to-action (visible même sur mobile)
4. **Éviter:** Texte trop près des bords

---

## 🎨 Templates Gratuits

### Sites avec templates vidéo carrée:
- **Canva:** Templates Instagram (1080x1080)
- **Kapwing:** [kapwing.com/templates](https://www.kapwing.com/templates)
- **Renderforest:** [renderforest.com](https://www.renderforest.com)
- **Biteable:** [biteable.com](https://www.biteable.com)

---

## ✅ Checklist Avant Upload

- [ ] Résolution: **1080x1080 pixels** exactement
- [ ] Format: **MP4** (H.264)
- [ ] Durée: **15-30 secondes**
- [ ] Taille: **< 10 MB**
- [ ] Ratio: **1:1** (carré)
- [ ] Test preview: Vérifie affichage desktop + mobile
- [ ] Texte lisible: Police assez grande (min 48px)
- [ ] Call-to-action: Visible et clair
- [ ] Audio: Pas obligatoire (sera muted en autoplay)

---

## 🚫 Erreurs Courantes à Éviter

❌ **Vidéo 16:9 (paysage)** → Bandes noires haut/bas sur mobile  
❌ **Vidéo 9:16 (portrait)** → Bandes noires gauche/droite sur desktop  
✅ **Vidéo 1:1 (carré)** → Parfait sur tous les écrans!

❌ **Texte trop petit** → Illisible sur mobile  
✅ **Police 48px+** → Lisible partout

❌ **Vidéo > 10MB** → Chargement lent, refusée  
✅ **Vidéo < 10MB** → Chargement rapide, acceptée

---

## 📊 Exemples de Conversion

### Vidéo paysage (1920x1080) → Carré (1080x1080)

**Option A: Crop (recadrage)**
- Coupe les côtés
- Garde la hauteur totale
- Perd contenu latéral

**Option B: Padding (ajout de bandes)**
- Garde tout le contenu
- Ajoute bandes noires/colorées haut et bas
- Vidéo plus petite

**Option C: Blur background (fond flouté)**
- Garde tout le contenu
- Fond = version floue de la vidéo
- Look professionnel

---

## 🎯 Résumé

1. **Format CARRÉ obligatoire:** 1080x1080 pixels
2. **Outils recommandés:** Canva (facile) ou Premiere Pro (pro)
3. **Taille max:** 10 MB
4. **Durée:** 15-30 secondes
5. **Format:** MP4 (H.264)

**Besoin d'aide?** Notre option "Créer la vidéo pour moi" (+300,000 FCFA) inclut la création d'une vidéo carrée professionnelle optimisée!

---

## 📞 Support

Questions? Contactez-nous:
- Email: support@gabon24-7.com
- WhatsApp: +241 XX XX XX XX

**Bon tournage!** 🎬✨
