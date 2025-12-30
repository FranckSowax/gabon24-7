# 🤖 Génération d'Articles Sponsorisés avec IA

Système de génération automatique d'articles sponsorisés via Replicate GPT-5 Nano avec prompt de rédacteur en chef gabonais professionnel.

## 🎯 Fonctionnalités

### ✅ Génération IA (Optionnelle)
- **Prompt contextualisé** : Rédacteur en chef web gabonais de Gabon24-7
- **Article complet** : 600-800 mots structurés professionnellement
- **Délai** : 20-30 secondes de génération
- **Éditable** : Possibilité de modifier avant soumission

### ✅ Mode Manuel (Toujours Disponible)
- **Pas obligatoire** : L'utilisateur peut remplir manuellement
- **Flexible** : Mélange IA + édition manuelle possible
- **Fallback** : Si IA échoue, formulaire manuel reste accessible

---

## 📋 Workflow Utilisateur

```
1. Utilisateur remplit brief minimal:
   - Entreprise *
   - Produit/Service *
   - Message clé *
   - Audience cible (optionnel)
   - Call-to-action (optionnel)
   - Catégorie (business/tech/santé/etc.)
   
2. OPTION A - Avec IA:
   ├─ Clique "🤖 Générer avec IA"
   ├─ Attente 20-30 secondes
   ├─ Article généré automatiquement
   ├─ Champs remplis: titre, sous-titre, contenu, résumé
   └─ Modifie si souhaité avant soumission

3. OPTION B - Manuel:
   ├─ Remplit directement tous les champs
   └─ Saute l'étape de génération IA

4. Soumet formulaire normalement
   ├─ Ajoute au panier
   └─ Procède au paiement
```

---

## 🏗️ Architecture

### Backend - Service IA

**Fichier:** `backend/services/gpt5-nano-analyzer.js`

```javascript
async function generateSponsoredArticle(briefInfo) {
  // 1. Validation brief client
  const { 
    company_name,      // Nom entreprise (requis)
    product_service,   // Produit/Service (requis)
    key_message,       // Message principal (requis)
    target_audience,   // Audience cible (défaut: "Grand public gabonais")
    call_to_action,    // CTA (défaut: "Contactez-nous...")
    tone,              // Ton (défaut: "professionnel")
    category           // Catégorie (défaut: "business")
  } = briefInfo

  // 2. Construction prompt rédacteur en chef gabonais
  const prompt = `Tu es un rédacteur en chef web gabonais expérimenté...`

  // 3. Appel API Replicate
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'db03cf8353c6e0b3b66ff7d6e8f89f41a7b1d43e5c8b9e8c4f5e6d7c8b9a0f1e',
      input: {
        prompt: prompt,
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
      }
    })
  })

  // 4. Polling résultat (60 tentatives max, 2s intervalle)
  const result = await pollPredictionResult(prediction.id)

  // 5. Parse réponse JSON
  return {
    success: true,
    article: {
      title: "...",
      subtitle: "...",
      summary: "...",
      content: "...",
      author: "Équipe Rédaction Gabon24-7",
      category: "...",
      keywords: [...]
    }
  }
}
```

### Backend - API Endpoint

**Fichier:** `backend/server.js`

```javascript
app.post('/api/generate-sponsored-article', async (req, res) => {
  // Validation champs requis
  if (!company_name || !product_service || !key_message) {
    return res.status(400).json({
      success: false,
      error: 'Champs requis: company_name, product_service, key_message'
    })
  }

  // Appel service IA
  const result = await generateSponsoredArticle({
    company_name,
    product_service,
    key_message,
    target_audience: target_audience || 'Grand public gabonais',
    call_to_action: call_to_action || 'Contactez-nous',
    tone: tone || 'professionnel',
    category: category || 'business'
  })

  // Retour résultat
  res.json({
    success: true,
    article: result.article
  })
})
```

### Frontend - Intégration

**Fichier:** `frontend/src/app/marketing/publicite/article-trending/page.tsx`

```typescript
const handleGenerateContent = async () => {
  // Validation brief
  if (!formData.companyName || !formData.productService || !formData.keyMessage) {
    alert('⚠️ Champs obligatoires pour génération IA')
    return
  }

  setLoading(true)

  try {
    // Appel API backend
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${API_URL}/api/generate-sponsored-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: formData.companyName,
        product_service: formData.productService,
        key_message: formData.keyMessage,
        target_audience: formData.targetAudience || 'Grand public gabonais',
        call_to_action: formData.callToAction || 'Contactez-nous',
        tone: 'professionnel',
        category: formData.articleCategory
      })
    })

    const result = await response.json()

    // Remplir automatiquement formulaire
    setFormData(prev => ({
      ...prev,
      articleTitle: result.article.title,
      articleSubtitle: result.article.subtitle || '',
      articleSummary: result.article.summary,
      articleContent: result.article.content,
      articleAuthor: result.article.author || 'Équipe Rédaction Gabon24-7'
    }))

    alert('✅ Article généré ! Vous pouvez modifier avant soumission.')
  } catch (error) {
    alert(`❌ Erreur IA: ${error.message}\n\nVous pouvez remplir manuellement.`)
  } finally {
    setLoading(false)
  }
}
```

---

## 📝 Prompt Rédacteur en Chef

### Contexte
```
Tu es un rédacteur en chef web gabonais expérimenté pour Gabon24-7, 
le premier média digital du Gabon.
```

### Consignes Éditoriales

#### 1. TITRE (60-80 caractères)
- Accrocheur, informatif, SEO-friendly
- Commence par verbe d'action ou chiffre
- Évite clickbait, reste crédible
- Exemple: "TechGabon révolutionne le digital au Gabon"

#### 2. SOUS-TITRE (100-150 caractères)
- Complète le titre avec info clé
- Précise valeur ajoutée unique
- Ton neutre et informatif

#### 3. CHAPÔ / RÉSUMÉ (150-200 mots)
- Répond aux 5W (Who, What, When, Where, Why)
- Contextualisation gabonaise importante
- Mentionne impact local ou économique
- Style journalistique neutre

#### 4. CORPS DE L'ARTICLE (600-800 mots)

**Paragraphe 1 - Introduction contextuelle (120-150 mots)**
- Situation actuelle marché gabonais
- Enjeux du secteur
- Transition naturelle vers l'entreprise

**Paragraphe 2 - Présentation entreprise (150-180 mots)**
- Historique, valeurs, mission
- Équipe, expertise locale
- Ancrage territorial (ville, quartier)
- Références ou témoignages

**Paragraphe 3 - Produit/service détaillé (180-200 mots)**
- Caractéristiques techniques/fonctionnelles
- Avantages concrets pour Gabonais
- Innovation ou différenciation
- Prix/tarifs (en FCFA)

**Paragraphe 4 - Impact et bénéfices (120-150 mots)**
- Résultats mesurables ou attendus
- Témoignages clients gabonais (réalistes)
- Impact économique ou social local

**Paragraphe 5 - Conclusion & CTA (80-100 mots)**
- Résumé points clés
- Appel à l'action naturel
- Informations pratiques (contact, site, adresse)

#### 5. STYLE RÉDACTIONNEL GABONAIS
- Vocabulaire adapté contexte local
- Références culturelles gabonaises pertinentes
- Lieux réels: Libreville, Port-Gentil, quartiers connus
- Ton professionnel mais accessible
- Évite jargon excessif
- Phrases courtes (15-20 mots max)

#### 6. SEO & MOTS-CLÉS
- Intègre naturellement: produit, catégorie, "Gabon", entreprise
- Utilise synonymes et variations
- Structure avec sous-titres H3 pertinents

#### 7. ADAPTATION PAR CATÉGORIE
- **business** → économie, entrepreneuriat, développement
- **tech** → innovation, digital, technologie
- **santé** → bien-être, médecine, prévention
- **éducation** → formation, apprentissage, jeunesse

---

## 🎨 Format de Sortie JSON

```json
{
  "title": "Titre accrocheur 60-80 caractères",
  "subtitle": "Sous-titre informatif 100-150 caractères",
  "summary": "Chapô/résumé 150-200 mots avec 5W et contexte gabonais",
  "content": "Corps complet 600-800 mots, structuré en paragraphes.\n\nChaque paragraphe séparé par deux retours à la ligne.\n\n### Sous-titres pour structure\n\nIntègre naturellement les infos du client.",
  "author": "Équipe Rédaction Gabon24-7",
  "category": "business",
  "keywords": ["mot-clé1", "mot-clé2", "mot-clé3", "mot-clé4", "mot-clé5"]
}
```

---

## ⚙️ Configuration

### Variables d'Environnement

**Backend (.env):**
```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=https://gabon24-7-production.up.railway.app
```

### Obtenir Token Replicate

1. Créer compte sur [Replicate.com](https://replicate.com)
2. Aller dans Settings → API Tokens
3. Créer nouveau token
4. Copier dans `.env` backend

---

## 🧪 Exemples de Génération

### Exemple 1: Tech

**Brief:**
```
- Entreprise: TechGabon
- Produit: Plateforme e-commerce locale
- Message clé: "Première solution 100% gabonaise adaptée aux PME"
- Audience: Entrepreneurs gabonais
- CTA: "Créez votre boutique en ligne gratuitement"
- Catégorie: tech
```

**Résultat:**
- Titre: "TechGabon lance la première plateforme e-commerce made in Gabon"
- 750 mots structurés
- Références: Libreville, quartiers commerciaux
- Prix en FCFA
- Témoignages entrepreneurs locaux
- Contexte: digitalisation économie gabonaise

### Exemple 2: Santé

**Brief:**
```
- Entreprise: CliniquePlus
- Produit: Téléconsultation médicale
- Message clé: "Consultez un médecin en 5 minutes depuis chez vous"
- Audience: Familles gabonaises
- CTA: "Téléchargez l'app et consultez maintenant"
- Catégorie: santé
```

**Résultat:**
- Titre: "La télémédecine s'installe au Gabon avec CliniquePlus"
- 680 mots professionnels
- Références: centres de santé, couverture réseau
- Contexte: accès aux soins zones rurales
- Témoignages patients anonymisés

---

## 🚨 Gestion des Erreurs

### Erreur: REPLICATE_API_TOKEN manquant

**Cause:** Variable d'environnement non définie

**Solution:**
```bash
# Backend .env
REPLICATE_API_TOKEN=your_token_here
```

### Erreur: Timeout génération

**Cause:** Génération prend plus de 2 minutes

**Solution:**
- Timeout max: 60 tentatives × 2s = 120s
- Si dépassé, l'utilisateur peut remplir manuellement

### Erreur: Format JSON invalide

**Cause:** IA ne retourne pas JSON valide

**Solution:**
- Regex extraction: `/{[\s\S]*}/`
- Si échoue, erreur retournée + fallback manuel

### Erreur: Champs requis manquants

**Cause:** Brief incomplet

**Solution:**
- Validation frontend avant appel
- Alert utilisateur: "Champs obligatoires: ..."

---

## 💡 Avantages

### Pour l'Utilisateur
✅ **Gain de temps** : Article complet en 30 secondes  
✅ **Qualité professionnelle** : Style journalistique crédible  
✅ **Contextualisé** : Adapté au marché gabonais  
✅ **Éditable** : Possibilité de personnaliser  
✅ **Pas obligatoire** : Mode manuel toujours disponible  

### Pour Gabon24-7
✅ **Scalabilité** : Génération automatique à la demande  
✅ **Cohérence** : Ligne éditoriale uniforme  
✅ **SEO** : Mots-clés intégrés naturellement  
✅ **Monétisation** : Valeur ajoutée service publicité  

### Technique
✅ **API Replicate** : Infrastructure robuste et scalable  
✅ **GPT-5 Nano** : Modèle lightweight et rapide  
✅ **Polling async** : Pas de blocage utilisateur  
✅ **Fallback gracieux** : Mode manuel si échec  

---

## 📊 Métriques

### Performance
- **Délai moyen** : 20-30 secondes
- **Timeout max** : 120 secondes
- **Longueur** : 600-800 mots
- **Qualité** : Style journalistique professionnel

### Coûts Replicate
- **Tarification** : Pay-per-use
- **Estimation** : ~$0.01-0.05 par génération
- **Alternative gratuite** : Mode manuel

---

## 🔄 Améliorations Futures

### Phase 2
- [ ] Upload image → Génération description automatique
- [ ] Génération multiple variantes (A/B testing)
- [ ] Traduction automatique (FR/EN)
- [ ] Optimisation SEO automatique (meta tags)
- [ ] Suggestions mots-clés via Google Trends

### Phase 3
- [ ] Intégration image AI (DALL-E, Midjourney)
- [ ] Analyse sentiment post-génération
- [ ] Fact-checking automatique
- [ ] Personnalisation ton (formel, décontracté, etc.)
- [ ] Templates par industrie (tech, santé, finance...)

---

## 📞 Support

**En cas de problème :**
- Vérifier token Replicate valide
- Vérifier variable d'environnement backend
- Consulter logs backend pour erreurs
- Utiliser mode manuel si IA échoue

**Contact :**
- Email: support@gabon24-7.com
- Docs Replicate: https://replicate.com/docs

---

## ✅ Checklist Déploiement

- [x] Service IA créé (`gpt5-nano-analyzer.js`)
- [x] Endpoint API créé (`/api/generate-sponsored-article`)
- [x] Frontend intégré (bouton génération IA)
- [x] Variable env `REPLICATE_API_TOKEN` configurée
- [x] Tests génération réussie
- [x] Mode manuel fonctionnel (fallback)
- [x] Gestion erreurs complète
- [x] Documentation utilisateur

---

**Système de génération IA prêt pour production !** 🚀
