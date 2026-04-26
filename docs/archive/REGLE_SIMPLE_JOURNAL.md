# 📺 Règle simple de sélection du journal TV

## 🎯 Règle unique

**Afficher le journal le plus récent parmi les éditions prioritaires (20h/23h)**

## 📋 Ordre de priorité

1. **Journal de 23h du jour J** (le plus récent)
2. Journal de 20h du jour J
3. Journal de 23h du jour J-1
4. Journal de 20h du jour J-1
5. Fallback: Journal le plus récent (13h, etc.)

## ✅ Exemples concrets

### Cas 1: Samedi 9 novembre à 23h30
**Disponibles:**
- Journal 13h du 9 nov (uploadé à 21:01)
- Journal 20h du 9 nov (uploadé à 20:17)
- Journal 23h du 9 nov (uploadé à 23:32) ⭐

**Affiché:** Journal de **23h du 9 nov** (le plus récent)

---

### Cas 2: Samedi 9 novembre à 21h00
**Disponibles:**
- Journal 13h du 9 nov (uploadé à 21:01)
- Journal 20h du 9 nov (uploadé à 20:17) ⭐
- Journal 23h du 8 nov (uploadé hier)

**Affiché:** Journal de **20h du 9 nov** (plus récent que le 23h d'hier)

---

### Cas 3: Samedi 9 novembre à 14h00
**Disponibles:**
- Journal 13h du 9 nov (uploadé à 13:37) ⭐
- Journal 23h du 8 nov (uploadé hier)
- Journal 20h du 8 nov (uploadé hier)

**Affiché:** Journal de **13h du 9 nov** (aucun 20h/23h du jour disponible)

---

## 🔑 Principe clé

**La date de publication (pubDate) prime sur l'édition du journal.**

Un journal de 20h du 9 novembre est plus récent qu'un journal de 23h du 8 novembre, donc c'est le 20h qui sera affiché.

## 🧪 Test rapide

```bash
cd backend
node test-journal-20h.js
```

Affiche le journal actuellement sélectionné et vérifie qu'il respecte la règle de priorisation.
