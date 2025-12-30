# 🔍 TESTS À EFFECTUER POUR VÉRIFIER LE FILTRAGE

## 1. Ouvrir la Console du Navigateur

**Chrome/Edge :** `Cmd + Option + J` (Mac) ou `F12` (Windows)
**Firefox :** `Cmd + Option + K` (Mac) ou `F12` (Windows)

## 2. Rafraîchir la Page

- Aller sur http://localhost:3000
- Ouvrir la console développeur
- Rafraîchir la page (Cmd+R ou F5)

## 3. Tester le Filtre Sport

1. Cliquer sur le bouton **"Filtres"**
2. Dans "Catégorie", cliquer sur **"Sport"**
3. Cliquer sur **"Appliquer les filtres"**

**Ce qui devrait apparaître dans la console :**
```
🔍 Application des filtres: { 
  category: 'Sport', 
  source: 'all',
  dateRange: 'all',
  sortBy: 'recent'
}

🔄 Filtres changés - Mise à jour des articles { 
  selectedCategory: 'Sport', 
  selectedSource: 'all', 
  selectedDateRange: 'all', 
  selectedSortBy: 'recent'
}
```

**Ce qui devrait se passer :**
- ✅ Le dropdown se ferme
- ✅ Les articles s'actualisent
- ✅ Seuls les articles avec catégorie "Sport" s'affichent
- ✅ Le nombre d'articles diminue

## 4. Vérifier les Données

Dans la console, taper :
```javascript
// Voir les articles affichés
console.log(document.querySelectorAll('.article-card').length)

// Voir les catégories des premiers articles
Array.from(document.querySelectorAll('.article-card')).slice(0, 5).forEach((el, i) => {
  console.log(`Article ${i+1}:`, el.querySelector('h2, h3')?.textContent)
})
```

## 5. Si Aucun Log n'Apparaît

**Problème:** Les modifications TypeScript ne sont pas compilées

**Solution:**
```bash
cd frontend
npm run dev
# Puis rafraîchir http://localhost:3000
```

## 6. Si les Logs Apparaissent Mais Aucun Filtrage

**Vérifier dans la console:**
```javascript
// Chercher des articles Sport dans les données
fetch('http://localhost:3001/api/articles?limit=50')
  .then(r => r.json())
  .then(data => {
    const sportArticles = data.articles.filter(a => 
      a.category?.toLowerCase().includes('sport')
    )
    console.log('Articles Sport trouvés:', sportArticles.length)
    console.log('Exemples:', sportArticles.slice(0, 3).map(a => ({
      title: a.title,
      category: a.category
    })))
  })
```

**Résultat attendu:**
```
Articles Sport trouvés: 35
Exemples: [
  { title: "Handball/Championnats d'Afrique...", category: "Sport" },
  { title: "Foot/Ligue 1 Gabon...", category: "Sport" },
  { title: "CAN 2025...", category: "Sport" }
]
```

## 7. Si Peu d'Articles Sport

**C'est normal si :**
- La plupart des articles ne sont pas encore enrichis
- Les articles enrichis n'ont pas tous des catégories "Sport"

**Solution:**
```bash
cd backend
node enrich-all-unenriched.js
# Attendre la fin de l'enrichissement
```

## 8. Test Complet de Tous les Filtres

Tester chaque filtre individuellement :

### Source
1. Ouvrir Filtres
2. Sélectionner une source (ex: "Gabon Actu")
3. Appliquer
4. Vérifier que seuls les articles de cette source s'affichent

### Période
1. Ouvrir Filtres
2. Sélectionner "Aujourd'hui"
3. Appliquer
4. Vérifier que seuls les articles d'aujourd'hui s'affichent

### Tri
1. Ouvrir Filtres
2. Sélectionner "🔥 Populaire"
3. Appliquer
4. Vérifier que les articles sont triés par nombre de vues

## 9. Réinitialiser les Filtres

1. Ouvrir Filtres
2. Cliquer sur "Réinitialiser" (en haut à droite)
3. Vérifier que tous les articles réapparaissent

---

**Si rien ne fonctionne après ces tests, copier les logs de la console et les partager.**
