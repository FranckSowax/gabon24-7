# 🔍 INSTRUCTIONS POUR TESTER LE FILTRAGE

## Étapes à Suivre

### 1. Rafraîchir la Page
- Appuyez sur `Cmd + R` (Mac) ou `F5` (Windows)
- La console doit rester ouverte

### 2. Ouvrir les Filtres
- Cliquer sur le bouton **"Filtres"** (orange)

### 3. Sélectionner "Sport"
- Dans la section "Catégorie", cliquer sur **"Sport"**

### 4. Cliquer sur "Appliquer les filtres"

## 📊 Logs Attendus dans la Console

Vous devriez voir :

```
🔍 Application des filtres: {category: 'Sport', ...}
🔄 Filtres changés - Mise à jour des articles {selectedCategory: 'Sport', ...}

🔍 Article: "Rugby/Une nouvelle étape pour le rugby..." | Category: "Sport" | Matches: true
🔍 Article: "Football/Élim Coupe du monde..." | Category: "Sport" | Matches: true
🔍 Article: "Gambie vs Gabon..." | Category: "Sport" | Matches: true

✅ Filtrage terminé: 3 articles correspondent à la catégorie "Sport"
Exemples: [
  { title: "Rugby/Une nouvelle étape pour le rugby...", category: "Sport" },
  { title: "Football/Élim Coupe du monde...", category: "Sport" },
  { title: "Gambie vs Gabon...", category: "Sport" }
]
```

## 🎯 Résultat Visuel Attendu

Sur la page, vous devriez voir :
- ✅ **3 articles Sport** affichés
- ✅ Tous les autres articles masqués
- ✅ Le compteur d'articles diminue

## ❓ Si Aucun Log n'Apparaît

1. La page n'a pas été rafraîchie → Rafraîchir avec `Cmd+R`
2. Le frontend n'a pas recompilé → Attendre 2-3 secondes
3. Erreur de compilation → Vérifier les logs du terminal frontend

## ❓ Si les Logs Montrent "0 articles"

**Cause possible :** Les articles ne sont pas dans le bon onglet

**Solution :**
- Vérifier que vous êtes sur l'onglet "Pour Vous" (premier onglet)
- Les 3 articles Sport sont dans les 100 premiers articles

## ❓ Si les Articles ne S'affichent Pas Visuellement

**Vérifier dans la console :**
```javascript
// Compter les articles affichés
document.querySelectorAll('article, .article-card').length
```

**Si le nombre est > 3 :**
- Le filtrage ne s'applique pas visuellement
- Problème de rendu React

**Si le nombre est = 3 :**
- ✅ Le filtrage fonctionne !
- Les articles sont peut-être hors de vue → Scroller vers le haut

---

**Partagez les logs de la console après avoir suivi ces étapes.**
