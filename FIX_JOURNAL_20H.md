# 🔧 Correction - Affichage du Journal de 20h

## 🔴 Problème identifié

Le widget YouTube affichait le **Journal de 13h** au lieu du **Journal de 20h** alors que ce dernier était plus récent.

### Cause racine

Le flux RSS YouTube **n'est pas trié par date de publication** mais par ordre d'upload sur la plateforme. Le journal de 13h peut être uploadé APRÈS le journal de 20h, ce qui le place en première position dans le flux.

**Exemple du flux RSS:**
```
Position 1: Journal de 13h (uploadé à 21:01)
Position 2: Journal de 13h (uploadé à 20:18)  
Position 3: Journal de 20h (uploadé à 20:17) ← Le plus important !
```

L'ancien code prenait simplement `videos[0]` sans tri ni priorisation.

## ✅ Solution implémentée

### 1. Filtrage des journaux TV

Ajout d'un filtre pour ne garder que les vrais journaux TV (pas les émissions spéciales) :

```javascript
const journalKeywords = ['journal télévisé', 'journal tv', 'jt de', 'journal de'];
const journalVideos = videos.filter(video => {
  const titleLower = video.title.toLowerCase();
  return journalKeywords.some(keyword => titleLower.includes(keyword));
});
```

### 2. Tri par date de publication

Tri des journaux par date de publication (plus récent en premier) :

```javascript
journalVideos.sort((a, b) => {
  const dateA = new Date(a.pubDate);
  const dateB = new Date(b.pubDate);
  return dateB - dateA; // Tri décroissant
});
```

### 3. Priorisation des éditions principales (20h et 23h)

Les journaux de 20h et 23h sont les éditions principales et doivent être priorisés :

```javascript
const priorityJournals = journalVideos.filter(video => {
  const titleLower = video.title.toLowerCase();
  return titleLower.includes('20h') || titleLower.includes('23h');
});

// Trier les journaux prioritaires par date (le plus récent en premier)
// Ex: Si on a 23h et 20h du même jour, le 23h sera en premier
if (priorityJournals.length > 0) {
  priorityJournals.sort((a, b) => {
    const dateA = new Date(a.pubDate);
    const dateB = new Date(b.pubDate);
    return dateB - dateA; // Tri décroissant (plus récent d'abord)
  });
}

// Utiliser le journal prioritaire le plus récent
const sortedVideos = priorityJournals.length > 0 ? priorityJournals : journalVideos;
```

### 4. Sélection du journal final

```javascript
const latestVideo = sortedVideos[0]; // Maintenant c'est le bon !
```

## 📊 Résultat

**Avant la correction:**
```
✅ Journal trouvé: 09/11 21:01 - Journal Télévisé de 13h du 09 novembre 2025
```

**Après la correction:**
```
✅ Journal trouvé: 09/11 20:17 - Journal Télévisé de 20h du 09 novembre 2025 ⭐
```

## 📁 Fichier modifié

`/backend/youtube-journal-extractor.js` (lignes 106-144)

## 🧪 Test de la correction

```bash
cd backend
node youtube-journal-extractor.js
```

Le script affiche maintenant :
- Liste des vidéos trouvées
- Filtrage des journaux TV
- Tri par date
- **Priorisation avec ⭐ pour les journaux de 20h/23h**
- Journal final sélectionné

## 🎯 Impact

- ✅ Le widget YouTube affiche maintenant le journal de 20h (édition principale)
- ✅ Fallback intelligent sur le journal de 23h si pas de 20h
- ✅ Fallback sur le journal le plus récent si ni 20h ni 23h
- ✅ Sauvegarde automatique dans `youtube_cache` pour le widget

## 📝 Scénarios de priorisation

### Scénario 1: Journal 23h + 20h du même jour
✅ **Résultat:** Journal de **23h** sélectionné (le plus récent)

### Scénario 2: Seulement journal de 20h
✅ **Résultat:** Journal de **20h** sélectionné

### Scénario 3: Journal 23h du 8 nov + 20h du 9 nov
✅ **Résultat:** Journal de **20h du 9 nov** sélectionné (le plus récent)

### Scénario 4: Seulement journal de 13h
✅ **Résultat:** Journal de **13h** sélectionné (fallback)

## 📝 Note importante

Cette logique de priorisation garantit que les utilisateurs voient toujours **l'édition la plus récente parmi les éditions principales** (20h ou 23h) plutôt qu'un journal de 13h uploadé plus tard.
