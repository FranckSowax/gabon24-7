# 🎯 Logique de priorisation des journaux TV

## 📋 Règle principale

**Le journal le plus récent parmi les éditions prioritaires (20h/23h) doit toujours être affiché.**

## 🔄 Algorithme de sélection

### Étape 1: Filtrage
Ne garder que les vrais journaux TV (pas les émissions spéciales)

```javascript
const journalKeywords = ['journal télévisé', 'journal tv', 'jt de', 'journal de'];
const journalVideos = videos.filter(video => {
  const titleLower = video.title.toLowerCase();
  return journalKeywords.some(keyword => titleLower.includes(keyword));
});
```

### Étape 2: Tri par date
Trier tous les journaux par date de publication (plus récent en premier)

```javascript
journalVideos.sort((a, b) => {
  const dateA = new Date(a.pubDate);
  const dateB = new Date(b.pubDate);
  return dateB - dateA; // Tri décroissant
});
```

### Étape 3: Priorisation des éditions principales
Filtrer pour ne garder que les journaux de 20h et 23h

```javascript
const priorityJournals = journalVideos.filter(video => {
  const titleLower = video.title.toLowerCase();
  return titleLower.includes('20h') || titleLower.includes('23h');
});
```

### Étape 4: Tri des journaux prioritaires
**IMPORTANT:** Trier les journaux prioritaires par date pour garantir que le plus récent est sélectionné

```javascript
if (priorityJournals.length > 0) {
  priorityJournals.sort((a, b) => {
    const dateA = new Date(a.pubDate);
    const dateB = new Date(b.pubDate);
    return dateB - dateA; // Le plus récent en premier
  });
}
```

### Étape 5: Sélection finale
Utiliser le journal prioritaire le plus récent, sinon le journal le plus récent tout court

```javascript
const sortedVideos = priorityJournals.length > 0 ? priorityJournals : journalVideos;
const latestVideo = sortedVideos[0];
```

## 📊 Exemples de scénarios

### ✅ Scénario 1: Journal 23h + 20h du même jour (9 nov)

**Flux RSS:**
- 21:01 - Journal de 13h du 9 nov
- 20:17 - Journal de 20h du 9 nov ⭐
- 23:32 - Journal de 23h du 9 nov ⭐

**Résultat:** Journal de **23h du 9 nov** (le plus récent parmi les prioritaires)

**Pourquoi?** Le journal de 23h est plus récent que le journal de 20h du même jour.

---

### ✅ Scénario 2: Seulement journal de 20h

**Flux RSS:**
- 21:01 - Journal de 13h du 9 nov
- 20:17 - Journal de 20h du 9 nov ⭐

**Résultat:** Journal de **20h du 9 nov**

**Pourquoi?** C'est le seul journal prioritaire disponible.

---

### ✅ Scénario 3: Journal 23h du 8 nov + 20h du 9 nov

**Flux RSS:**
- 23:32 - Journal de 23h du 8 nov ⭐
- 20:17 - Journal de 20h du 9 nov ⭐

**Résultat:** Journal de **20h du 9 nov** (le plus récent)

**Pourquoi?** Même si le 23h est une édition "supérieure", le 20h du 9 nov est plus récent que le 23h du 8 nov.

---

### ✅ Scénario 4: Seulement journal de 13h

**Flux RSS:**
- 21:01 - Journal de 13h du 9 nov
- 13:37 - Journal de 13h du 9 nov

**Résultat:** Journal de **13h du 9 nov** (21:01)

**Pourquoi?** Aucun journal prioritaire (20h/23h) n'est disponible, donc fallback sur le plus récent.

---

## 🎯 Priorités en résumé

1. **Priorité 1:** Journal de 20h ou 23h le plus récent
2. **Priorité 2:** Si pas de 20h/23h, prendre le journal le plus récent (13h, etc.)

## ⚠️ Point important

La date de publication (`pubDate`) dans le flux RSS correspond à **l'heure d'upload sur YouTube**, pas à l'heure du journal lui-même.

**Exemple:**
- Journal de 13h uploadé à 21:01 → `pubDate = 21:01`
- Journal de 20h uploadé à 20:17 → `pubDate = 20:17`

C'est pourquoi on doit **filtrer par titre** pour identifier les éditions (13h, 20h, 23h) et ensuite trier par `pubDate` pour avoir le plus récent.

## 🧪 Tests

### Test de priorisation
```bash
cd backend
node test-priorite-journal.js
```

### Test avec données réelles
```bash
cd backend
node test-journal-20h.js
```

### Extraction manuelle
```bash
cd backend
node youtube-journal-extractor.js
```

## ✅ Validation

La logique garantit que:
- ✅ Le journal de 23h est toujours préféré au journal de 20h du même jour
- ✅ Le journal de 20h du jour J est préféré au journal de 23h du jour J-1
- ✅ En l'absence de 20h/23h, le journal le plus récent est sélectionné
- ✅ Les émissions spéciales sont exclues du processus de sélection
