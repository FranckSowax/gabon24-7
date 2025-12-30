# 📚 Cahier des charges - Système de Formation IA Personnalisée

## 🎯 Vue d'ensemble

Développer un système de formation personnalisée qui génère automatiquement des parcours d'apprentissage sur-mesure basés sur l'analyse des besoins utilisateur, les données d'articles de veille, et les résultats d'analyse secteur via NanoGPT-5.

---

## 🔄 Flux utilisateur complet

### 1. Point d'entrée
```
Dashboard articles → Bouton "Formation" sur article pertinent
→ Page de chargement "Génération de votre sommaire..."
→ Appel API NanoGPT-5 avec données contextuelles
→ Affichage sommaire structuré + options d'achat
```

### 2. Génération du sommaire (IA)
```
Collecte automatique :
- Données formulaire d'analyse utilisateur (budget, compétences, délai)
- Contenu article (problématique, résumé, titre, contenu)
- Résultats analyse (secteur, propositions sélectionnées)

↓ Prompt NanoGPT-5 ↓

Sommaire personnalisé :
- 8-12 modules de formation
- Durées calculées selon délai_lancement
- Priorités et niveaux adaptés
- Ancrage contexte gabonais
```

### 3. Monétisation et accès
```
Sommaire affiché GRATUITEMENT
Options d'achat :
- Module individuel : X crédits/module
- Formation complète : Y crédits (prix avantageux)
- Sauvegarde à vie dans "Mes Projets"
```

---

## 🛠️ Spécifications techniques

### Architecture générale
- **Frontend** : Next.js 14 + TypeScript + Tailwind CSS
- **Backend** : Node.js/Express + API NanoGPT-5
- **Base données** : Supabase (formations, achats, progression)
- **Protection contenu** : Système anti-capture + watermarking
- **Paiements** : Système de crédits (Stripe)

### Structure base de données

```sql
-- Table formations générées
CREATE TABLE ai_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  article_id UUID REFERENCES articles(id),
  
  -- Données source pour IA
  user_analysis JSONB, -- budget, compétences, délai
  article_context JSONB, -- titre, problématique, contenu
  sector_results JSONB, -- secteur, propositions
  
  -- Sortie IA
  training_title TEXT,
  modules JSONB, -- [{title, objective, priority, level, duration, content}]
  total_duration TEXT,
  execution_margin TEXT,
  
  -- Business
  price_per_module INTEGER, -- en crédits
  price_total INTEGER, -- en crédits
  generated_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'generated' -- generated, purchased, completed
);

-- Table achats modules
CREATE TABLE training_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  training_id UUID REFERENCES ai_trainings(id),
  module_ids INTEGER[], -- null = formation complète
  credits_spent INTEGER,
  purchased_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- null = à vie
);

-- Table progression utilisateur
CREATE TABLE training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  training_id UUID REFERENCES ai_trainings(id),
  module_id INTEGER,
  progress_percent INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  time_spent_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table crédits utilisateur
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  credits_balance INTEGER DEFAULT 0,
  last_purchase_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🤖 Intégration NanoGPT-5

### Prompt système optimisé
```javascript
const generateTrainingPrompt = (userAnalysis, article, sectorResults) => `
Act like un concepteur pédagogique et chef de projet go-to-market (focus Gabon), spécialisé en lancements rapides.

OBJECTIF
Générer un sommaire court et exhaustif des compétences à acquérir pour lancer une proposition de business donnée, avec des durées de formation directement dérivées de la variable délai_lancement fournie par l'utilisateur.

ENTRÉES
<PROPOSITION>
titre=${article.title}
offre=${sectorResults.selectedPropositions.join(', ')}
client_cible=${sectorResults.targetAudience}
modele_revenu=${sectorResults.revenueModel}
</PROPOSITION>

<CONTRAINTES_USER>
budget=${userAnalysis.budget}
competences_actuelles=${userAnalysis.currentSkills}
delai_lancement=${userAnalysis.launchDeadline}
disponibilite_apprenant_optionnelle=${userAnalysis.weeklyAvailability || 'Non spécifié'}
</CONTRAINTES_USER>

<CONTEXTE_GABON_OPTIONNEL>
points_locaux=${sectorResults.localInsights}
</CONTEXTE_GABON_OPTIONNEL>

ÉTAPES
1) Identifier le secteur et la complexité du projet.
2) Lister les compétences indispensables au lancement (8–12 max).
3) Croiser avec budget, compétences_actuelles et contexte gabonais.
4) Prioriser chaque compétence (Haute/Moyenne/Basse) + niveau requis (Débutant/Intermédiaire).
5) Calculer une durée indicative par compétence (heures/jours) proportionnelle à la priorité et à l'écart de compétence.
   • Contraintes: la somme des durées de formation doit entrer dans le delai_lancement et conserver une marge pour l'exécution.
6) Ajuster selon disponibilite_apprenant_optionnelle si fournie.
7) S'il manque des infos, formuler "Hypothèse: …".

FORMAT DE SORTIE (JSON strict)
{
  "title": "Sommaire des compétences — [Nom du projet]",
  "modules": [
    {
      "id": 1,
      "competence": "Nom compétence",
      "objective": "objectif opérationnel concret",
      "priority": "Haute|Moyenne|Basse",
      "level": "Débutant|Intermédiaire",
      "duration": "X heures" ou "X jours",
      "duration_numeric": nombre_heures
    }
  ],
  "total_formation": "X heures total",
  "execution_margin": "Y jours conservés pour exécution",
  "gabon_specifics": "Points spécifiques au contexte gabonais"
}

RÈGLES DE STYLE
• Français clair, pédagogique, friendly & pro.
• Couvre "jour 0–90".
• Priorisation et durées cohérentes avec delai_lancement, budget et compétences_actuelles.
• Ancrage Gabon explicite quand pertinent.

Take a deep breath and work on this problem step-by-step.
`;
```

### API d'appel NanoGPT-5
```javascript
const generateTrainingSummary = async (userAnalysis, article, sectorResults) => {
  const response = await fetch('https://api.nanogpt5.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NANOGPT5_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "nanogpt-5",
      messages: [{
        role: "system", 
        content: generateTrainingPrompt(userAnalysis, article, sectorResults)
      }],
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
};
```

---

## 💰 Système de monétisation

### Modèle de crédits
```javascript
const PRICING = {
  // Prix d'achat crédits (FCFA)
  credit_packs: {
    starter: { credits: 10, price: 5000 },
    pro: { credits: 25, price: 10000 },
    enterprise: { credits: 50, price: 18000 }
  },
  
  // Coût formations (crédits)
  training_costs: {
    module_unit: 2, // crédits par module
    full_discount: 0.7 // 30% de réduction formation complète
  }
};

const calculateTrainingPrice = (modules) => {
  const modulePrice = modules.length * PRICING.training_costs.module_unit;
  const fullPrice = Math.floor(modulePrice * PRICING.training_costs.full_discount);
  
  return {
    per_module: PRICING.training_costs.module_unit,
    total_modules: modulePrice,
    full_training: fullPrice,
    savings: modulePrice - fullPrice
  };
};
```

### Interface de paiement
```jsx
const TrainingPurchaseModal = ({ training, userCredits }) => (
  <div className="modal">
    <h3>{training.title}</h3>
    <div className="pricing-options">
      <div className="option">
        <h4>Par module</h4>
        <p>{pricing.per_module} crédits/module</p>
        <small>Flexibilité maximale</small>
      </div>
      
      <div className="option recommended">
        <h4>Formation complète</h4>
        <p>{pricing.full_training} crédits</p>
        <span className="savings">-{pricing.savings} crédits</span>
        <small>Meilleur rapport qualité-prix</small>
      </div>
    </div>
    
    <div className="user-credits">
      Vos crédits : {userCredits}
      {userCredits < pricing.full_training && (
        <Link href="/credits/buy">Acheter des crédits</Link>
      )}
    </div>
  </div>
);
```

---

## 🔒 Protection du contenu

### Système anti-capture
```javascript
// Protection côté client
const ContentProtection = {
  // Désactiver clic droit
  disableContextMenu: () => {
    document.addEventListener('contextmenu', e => e.preventDefault());
  },
  
  // Désactiver raccourcis clavier
  disableKeyboardShortcuts: () => {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && ['s', 'a', 'c', 'v', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
    });
  },
  
  // Watermark dynamique
  addWatermark: (userId) => {
    const watermark = document.createElement('div');
    watermark.textContent = `Formation - User: ${userId.slice(-8)}`;
    watermark.className = 'watermark';
    document.body.appendChild(watermark);
  },
  
  // Détection dev tools
  detectDevTools: () => {
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > 200) {
        document.body.innerHTML = '<h1>Accès non autorisé détecté</h1>';
      }
    }, 1000);
  }
};
```

### CSS de protection
```css
.training-content {
  /* Anti-sélection */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  
  /* Anti-copie */
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  
  /* Protection impression */
  @media print {
    display: none !important;
  }
}

.watermark {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 2rem;
  color: rgba(0,0,0,0.1);
  pointer-events: none;
  z-index: 9999;
  user-select: none;
}

/* Masquer si dev tools ouvert */
@media (max-height: 500px) {
  .training-content {
    filter: blur(10px);
  }
  .training-content::after {
    content: "Veuillez fermer les outils de développement";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}
```

---

## 📱 Interface utilisateur

### Page sommaire de formation
```jsx
const TrainingSummaryPage = ({ training, user }) => (
  <div className="training-summary">
    <header>
      <h1>{training.title}</h1>
      <div className="metadata">
        <span>Durée totale : {training.total_duration}</span>
        <span>Marge d'exécution : {training.execution_margin}</span>
      </div>
    </header>

    <div className="modules-preview">
      {training.modules.map(module => (
        <div key={module.id} className="module-card">
          <div className="module-header">
            <h3>{module.competence}</h3>
            <span className={`priority ${module.priority.toLowerCase()}`}>
              {module.priority}
            </span>
          </div>
          <p>{module.objective}</p>
          <div className="module-details">
            <span>Niveau : {module.level}</span>
            <span>Durée : {module.duration}</span>
          </div>
          <button className="btn-preview">Aperçu gratuit</button>
        </div>
      ))}
    </div>

    <div className="purchase-section">
      <h3>Démarrer la formation</h3>
      <div className="pricing-cards">
        <div className="card">
          <h4>Par module</h4>
          <div className="price">{pricing.per_module} crédits</div>
          <button>Choisir les modules</button>
        </div>
        <div className="card featured">
          <h4>Formation complète</h4>
          <div className="price">{pricing.full_training} crédits</div>
          <div className="savings">Économisez {pricing.savings} crédits</div>
          <button>Acheter la formation</button>
        </div>
      </div>
    </div>
  </div>
);
```

### Page de formation style Teachable
```jsx
const TrainingContentPage = ({ module, progress, userAccess }) => (
  <div className="training-platform">
    <aside className="sidebar">
      <div className="progress-tracker">
        <h4>Votre progression</h4>
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }}></div>
        </div>
        <span>{progress}% terminé</span>
      </div>
      
      <nav className="module-navigation">
        {training.modules.map(mod => (
          <div key={mod.id} className={`nav-item ${
            userAccess.includes(mod.id) ? 'accessible' : 'locked'
          }`}>
            <span>{mod.competence}</span>
            {userAccess.includes(mod.id) ? '✓' : '🔒'}
          </div>
        ))}
      </nav>
    </aside>

    <main className="content-area" data-user-id={user.id}>
      <div className="module-content training-content">
        <h1>{module.competence}</h1>
        <div className="objective-box">
          <strong>Objectif :</strong> {module.objective}
        </div>
        
        <div className="lesson-content" dangerouslySetInnerHTML={{
          __html: module.generated_content
        }} />
        
        <div className="module-actions">
          <button onClick={markAsCompleted}>Marquer comme terminé</button>
          <button onClick={downloadCertificate}>Télécharger certificat</button>
        </div>
      </div>
    </main>
  </div>
);
```

---

## ⚡ APIs nécessaires

### Routes formation
```javascript
// Génération sommaire
POST /api/training/generate
Body: { articleId, userAnalysis, sectorResults }
Response: { trainingId, summary, pricing }

// Achat formation/module
POST /api/training/purchase
Body: { trainingId, moduleIds?, credits }
Response: { success, purchaseId, userCredits }

// Accès contenu
GET /api/training/:id/content
Headers: { Authorization }
Response: { modules, userAccess, progress }

// Progression
PUT /api/training/:id/progress
Body: { moduleId, progressPercent, timeSpent }
Response: { success, totalProgress }

// Mes projets
GET /api/user/trainings
Response: { trainings: [{ title, progress, purchasedAt, expiresAt }] }
```

### Routes crédits
```javascript
// Solde utilisateur
GET /api/user/credits
Response: { balance, lastPurchase, history }

// Achat crédits
POST /api/credits/purchase
Body: { packType, paymentMethodId }
Response: { success, newBalance, transactionId }

// Historique dépenses
GET /api/credits/history
Response: { transactions: [{ type, amount, description, date }] }
```

---

## 🎯 Métriques de succès

### Business KPIs
- **Taux de conversion** : Sommaire vu → Formation achetée (>15%)
- **Revenus par formation** : Moyenne crédits dépensés par utilisateur
- **Complétion rate** : % d'utilisateurs finissant les formations (>60%)
- **NPS formations** : Satisfaction utilisateur post-formation (>8/10)

### Techniques KPIs  
- **Temps génération IA** : <30 secondes par sommaire
- **Disponibilité plateforme** : >99.5% uptime
- **Protection contenu** : <1% de contenu piraté détecté
- **Performance mobile** : Score PageSpeed >90

---

## 🚀 Planning de développement

### Phase 1 - Core IA (2 semaines)
- ✅ Intégration NanoGPT-5 
- ✅ Génération sommaires personnalisés
- ✅ Interface sommaire + pricing
- ✅ Système de crédits basique

### Phase 2 - Plateforme formation (3 semaines)
- ✅ Interface style Teachable
- ✅ Système de protection contenu
- ✅ Progression utilisateur
- ✅ Section "Mes Projets"

### Phase 3 - Business & UX (2 semaines)
- ✅ Paiements Stripe complets
- ✅ Analytics utilisateur
- ✅ Mobile optimization
- ✅ Tests utilisateurs

**Budget estimé :** 3,000,000 - 5,000,000 FCFA  
**ROI attendu :** Break-even à 100 formations vendues (3-4 mois)