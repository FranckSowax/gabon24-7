# 📍 Spécifications Techniques - Module Cartes Itinéraires
## SaaS Gabon 24 - Document pour Cascade AI

---

## 1. Vue d'ensemble du projet

### Contexte
Intégration d'un module de gestion et d'affichage de cartes Google Maps avec itinéraires prédéfinis dans le SaaS Gabon 24. Ce module permettra aux administrateurs de créer, gérer et afficher des trajets sur des cartes interactives.

### Objectifs principaux
- Créer un système de slides avec cartes Google Maps intégrées
- Développer une interface d'administration pour gérer les trajets
- Permettre l'affichage public des itinéraires configurés
- Intégrer le module dans l'architecture existante du SaaS Gabon 24

---

## 2. Architecture technique

### Structure des pages

```
/admin/
  └── /dashboard/
      └── /maps-routes/          # Nouvelle page d'administration
          ├── index.php           # Interface de gestion
          └── api/                # Endpoints API
              ├── create.php
              ├── update.php
              ├── delete.php
              └── list.php

/public/
  └── /routes-viewer/            # Page publique des slides
      └── index.php               # Affichage des cartes
```

### Base de données

```sql
-- Table pour stocker les trajets
CREATE TABLE map_routes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(500),
    google_maps_url TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Table pour les analytics (optionnel)
CREATE TABLE route_views (
    id INT PRIMARY KEY AUTO_INCREMENT,
    route_id INT,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    FOREIGN KEY (route_id) REFERENCES map_routes(id)
);
```

---

## 3. Interface d'administration

### 3.1 Accès depuis le dashboard

**Emplacement** : Ajouter un nouvel item dans la barre latérale du dashboard admin

```html
<!-- Item à ajouter dans la sidebar du dashboard -->
<li class="nav-item">
    <a href="/admin/dashboard/maps-routes" class="nav-link">
        <i class="fas fa-map-marked-alt"></i>
        <span>Gestion Trajets</span>
        <span class="badge badge-info">Nouveau</span>
    </a>
</li>
```

### 3.2 Page de gestion des trajets

#### Fonctionnalités principales

1. **Formulaire d'ajout/modification**
   - Champ : Titre du trajet (requis)
   - Champ : Sous-titre/Description (optionnel)
   - Champ : URL Google Maps (requis)
   - Champ : Ordre d'affichage
   - Toggle : Actif/Inactif

2. **Tableau de gestion**
   - Liste paginée des trajets
   - Colonnes : ID, Titre, Sous-titre, Statut, Date création, Actions
   - Actions : Voir, Modifier, Dupliquer, Supprimer
   - Tri par ordre d'affichage (drag & drop)

3. **Prévisualisation**
   - Bouton pour prévisualiser le slide
   - Modal avec iframe de la carte

### 3.3 Code PHP Backend

```php
// /admin/dashboard/maps-routes/api/create.php
<?php
session_start();
require_once '../../../../config/database.php';
require_once '../../../../includes/auth.php';

// Vérifier les permissions admin
if (!isAdmin()) {
    http_response_code(403);
    exit(json_encode(['error' => 'Accès non autorisé']));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title = filter_input(INPUT_POST, 'title', FILTER_SANITIZE_STRING);
    $subtitle = filter_input(INPUT_POST, 'subtitle', FILTER_SANITIZE_STRING);
    $google_maps_url = filter_input(INPUT_POST, 'google_maps_url', FILTER_SANITIZE_URL);
    $display_order = filter_input(INPUT_POST, 'display_order', FILTER_VALIDATE_INT) ?? 0;
    
    // Convertir l'URL en format embed
    $embed_url = convertToEmbedUrl($google_maps_url);
    
    $stmt = $pdo->prepare("
        INSERT INTO map_routes (title, subtitle, google_maps_url, embed_url, display_order, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    $result = $stmt->execute([
        $title,
        $subtitle,
        $google_maps_url,
        $embed_url,
        $display_order,
        $_SESSION['user_id']
    ]);
    
    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Trajet ajouté avec succès',
            'id' => $pdo->lastInsertId()
        ]);
    } else {
        echo json_encode(['error' => 'Erreur lors de l\'ajout']);
    }
}

function convertToEmbedUrl($url) {
    // Logique de conversion URL Google Maps vers embed
    if (strpos($url, 'embed') !== false) {
        return $url;
    }
    
    // Parser l'URL et extraire les coordonnées
    // Implémenter la logique de conversion appropriée
    
    return $url;
}
?>
```

---

## 4. Interface publique (Slides)

### 4.1 Structure HTML

```html
<!-- /public/routes-viewer/index.php -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trajets - Gabon 24</title>
    <link rel="stylesheet" href="/assets/css/routes-viewer.css">
</head>
<body>
    <div class="routes-container">
        <div class="slides-wrapper" id="slidesWrapper">
            <!-- Les slides seront chargés dynamiquement -->
        </div>
        
        <div class="navigation-controls">
            <button class="nav-btn prev" onclick="changeSlide(-1)">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button class="nav-btn next" onclick="changeSlide(1)">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        
        <div class="slide-indicators" id="slideIndicators">
            <!-- Indicateurs générés dynamiquement -->
        </div>
    </div>
    
    <script src="/assets/js/routes-viewer.js"></script>
</body>
</html>
```

### 4.2 JavaScript Frontend

```javascript
// /assets/js/routes-viewer.js
class RoutesViewer {
    constructor() {
        this.currentSlide = 0;
        this.routes = [];
        this.init();
    }
    
    async init() {
        await this.loadRoutes();
        this.renderSlides();
        this.setupKeyboardNavigation();
        this.setupTouchNavigation();
    }
    
    async loadRoutes() {
        try {
            const response = await fetch('/api/routes/list');
            const data = await response.json();
            this.routes = data.routes.filter(r => r.is_active);
        } catch (error) {
            console.error('Erreur chargement trajets:', error);
        }
    }
    
    renderSlides() {
        const wrapper = document.getElementById('slidesWrapper');
        const indicators = document.getElementById('slideIndicators');
        
        wrapper.innerHTML = '';
        indicators.innerHTML = '';
        
        this.routes.forEach((route, index) => {
            // Créer le slide
            const slide = document.createElement('div');
            slide.className = `slide ${index === 0 ? 'active' : ''}`;
            slide.innerHTML = `
                <div class="slide-header">
                    <h2>${route.title}</h2>
                    ${route.subtitle ? `<p>${route.subtitle}</p>` : ''}
                </div>
                <div class="map-frame">
                    <iframe 
                        src="${route.embed_url}"
                        allowfullscreen
                        loading="lazy">
                    </iframe>
                </div>
            `;
            wrapper.appendChild(slide);
            
            // Créer l'indicateur
            const dot = document.createElement('span');
            dot.className = `indicator ${index === 0 ? 'active' : ''}`;
            dot.onclick = () => this.goToSlide(index);
            indicators.appendChild(dot);
        });
    }
    
    changeSlide(direction) {
        const slides = document.querySelectorAll('.slide');
        const indicators = document.querySelectorAll('.indicator');
        
        slides[this.currentSlide].classList.remove('active');
        indicators[this.currentSlide].classList.remove('active');
        
        this.currentSlide += direction;
        
        if (this.currentSlide >= slides.length) {
            this.currentSlide = 0;
        } else if (this.currentSlide < 0) {
            this.currentSlide = slides.length - 1;
        }
        
        slides[this.currentSlide].classList.add('active');
        indicators[this.currentSlide].classList.add('active');
        
        // Track view
        this.trackView(this.routes[this.currentSlide].id);
    }
    
    goToSlide(index) {
        const slides = document.querySelectorAll('.slide');
        const indicators = document.querySelectorAll('.indicator');
        
        slides[this.currentSlide].classList.remove('active');
        indicators[this.currentSlide].classList.remove('active');
        
        this.currentSlide = index;
        
        slides[this.currentSlide].classList.add('active');
        indicators[this.currentSlide].classList.add('active');
    }
    
    async trackView(routeId) {
        // Analytics tracking
        try {
            await fetch('/api/routes/track', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({route_id: routeId})
            });
        } catch (error) {
            console.error('Erreur tracking:', error);
        }
    }
    
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.changeSlide(-1);
            if (e.key === 'ArrowRight') this.changeSlide(1);
        });
    }
    
    setupTouchNavigation() {
        let touchStartX = 0;
        const wrapper = document.getElementById('slidesWrapper');
        
        wrapper.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        wrapper.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    this.changeSlide(1); // Swipe left
                } else {
                    this.changeSlide(-1); // Swipe right
                }
            }
        });
    }
}

// Initialiser
document.addEventListener('DOMContentLoaded', () => {
    window.routesViewer = new RoutesViewer();
});

// Fonction globale pour la navigation
function changeSlide(direction) {
    window.routesViewer.changeSlide(direction);
}
```

---

## 5. Styles CSS

```css
/* /assets/css/routes-viewer.css */
.routes-container {
    position: relative;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
}

.slides-wrapper {
    position: relative;
    width: 100%;
    height: 600px;
}

.slide {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.5s ease;
}

.slide.active {
    opacity: 1;
    transform: translateX(0);
}

.slide-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px 30px;
    z-index: 10;
}

.slide-header h2 {
    margin: 0;
    font-size: 1.8rem;
}

.slide-header p {
    margin: 5px 0 0;
    opacity: 0.9;
}

.map-frame {
    width: 100%;
    height: 100%;
    padding-top: 80px;
}

.map-frame iframe {
    width: 100%;
    height: 100%;
    border: none;
}

.navigation-controls {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding: 0 20px;
    pointer-events: none;
}

.nav-btn {
    background: rgba(255,255,255,0.9);
    border: none;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
    pointer-events: all;
}

.nav-btn:hover {
    transform: scale(1.1);
    background: white;
}

.nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.slide-indicators {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 10;
}

.indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    border: 2px solid white;
    cursor: pointer;
    transition: all 0.3s ease;
}

.indicator.active {
    background: white;
    transform: scale(1.3);
}

/* Responsive */
@media (max-width: 768px) {
    .slides-wrapper {
        height: 400px;
    }
    
    .slide-header {
        padding: 15px 20px;
    }
    
    .slide-header h2 {
        font-size: 1.4rem;
    }
    
    .nav-btn {
        width: 40px;
        height: 40px;
    }
}
```

---

## 6. API Endpoints

### 6.1 Liste des endpoints

| Méthode | Endpoint | Description | Paramètres |
|---------|----------|-------------|------------|
| GET | `/api/routes/list` | Liste tous les trajets actifs | `page`, `limit` |
| GET | `/api/routes/{id}` | Détails d'un trajet | `id` |
| POST | `/api/routes/create` | Créer un nouveau trajet | `title`, `subtitle`, `google_maps_url` |
| PUT | `/api/routes/{id}` | Modifier un trajet | `id`, données à modifier |
| DELETE | `/api/routes/{id}` | Supprimer un trajet | `id` |
| POST | `/api/routes/track` | Tracker une vue | `route_id` |
| POST | `/api/routes/reorder` | Réorganiser l'ordre | `orders[]` |

### 6.2 Format des réponses

```json
// Succès
{
    "success": true,
    "message": "Opération réussie",
    "data": {
        "id": 1,
        "title": "Centre-ville vers Aéroport",
        "subtitle": "Distance: 15km | Durée: 25 min",
        "embed_url": "https://...",
        "is_active": true,
        "display_order": 1
    }
}

// Erreur
{
    "success": false,
    "error": "Message d'erreur",
    "code": "ERROR_CODE"
}
```

---

## 7. Sécurité

### Mesures de sécurité à implémenter

1. **Authentification**
   - Vérifier les sessions admin pour l'accès au dashboard
   - Token CSRF pour les formulaires

2. **Validation des données**
   - Sanitizer toutes les entrées utilisateur
   - Valider les URLs Google Maps
   - Limiter la taille des champs

3. **Protection XSS**
   - Échapper les sorties HTML
   - Content Security Policy pour les iframes

4. **Rate limiting**
   - Limiter les requêtes API par IP
   - Protection contre le spam de création

### Code de sécurité

```php
// Fonction de validation URL Google Maps
function validateGoogleMapsUrl($url) {
    $allowed_domains = [
        'maps.google.com',
        'www.google.com/maps',
        'goo.gl/maps'
    ];
    
    $parsed = parse_url($url);
    
    foreach ($allowed_domains as $domain) {
        if (strpos($parsed['host'] . $parsed['path'], $domain) !== false) {
            return true;
        }
    }
    
    return false;
}

// Protection CSRF
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && 
           hash_equals($_SESSION['csrf_token'], $token);
}
```

---

## 8. Fonctionnalités avancées (Phase 2)

### 8.1 Analytics dashboard
- Nombre de vues par trajet
- Graphiques de tendances
- Temps moyen passé par slide
- Taux de complétion des parcours

### 8.2 Personnalisation avancée
- Templates de slides personnalisables
- Couleurs et thèmes configurables
- Ajout de points d'intérêt sur les cartes
- Descriptions détaillées avec rich text editor

### 8.3 Fonctionnalités sociales
- Partage sur réseaux sociaux
- QR codes pour accès mobile
- Favoris utilisateurs
- Commentaires et notes

### 8.4 Optimisations
- Lazy loading des iframes
- Cache des trajets
- Compression des assets
- CDN pour les ressources statiques

---

## 9. Tests à effectuer

### Tests fonctionnels
- [ ] Création de trajet avec différents types d'URLs
- [ ] Modification et suppression de trajets
- [ ] Navigation entre slides (clavier, souris, tactile)
- [ ] Réorganisation de l'ordre d'affichage
- [ ] Activation/désactivation de trajets

### Tests de sécurité
- [ ] Injection SQL
- [ ] XSS dans les champs
- [ ] CSRF sur les formulaires
- [ ] Validation des URLs

### Tests de performance
- [ ] Chargement avec 50+ trajets
- [ ] Performance sur mobile
- [ ] Temps de réponse API

### Tests de compatibilité
- [ ] Chrome, Firefox, Safari, Edge
- [ ] iOS Safari, Chrome Mobile
- [ ] Différentes résolutions d'écran

---

## 10. Déploiement

### Checklist de déploiement

1. **Base de données**
   - [ ] Créer les tables dans la DB production
   - [ ] Configurer les index appropriés
   - [ ] Backup de la DB existante

2. **Fichiers**
   - [ ] Uploader les fichiers PHP
   - [ ] Uploader les assets (CSS, JS, images)
   - [ ] Vérifier les permissions des dossiers

3. **Configuration**
   - [ ] Variables d'environnement
   - [ ] URLs de production
   - [ ] Clés API Google Maps (si nécessaire)

4. **Tests post-déploiement**
   - [ ] Test de création de trajet
   - [ ] Test d'affichage public
   - [ ] Vérification des logs d'erreur

---

## 11. Maintenance

### Tâches de maintenance régulières

- **Quotidien** : Vérifier les logs d'erreur
- **Hebdomadaire** : Backup de la base de données
- **Mensuel** : Analyser les performances et l'utilisation
- **Trimestriel** : Mise à jour des dépendances

### Monitoring
- Mettre en place des alertes pour :
  - Erreurs 500
  - Temps de réponse > 3s
  - Échecs de chargement des cartes

---

## 12. Support et documentation

### Documentation utilisateur
- Guide d'utilisation pour les administrateurs
- FAQ sur l'ajout de trajets
- Tutoriel vidéo de configuration

### Documentation technique
- Architecture du système
- API documentation (Swagger/OpenAPI)
- Guide de contribution

---

## Contacts et ressources

**Équipe de développement**
- Frontend : [À définir]
- Backend : [À définir]
- Design : [À définir]

**Ressources externes**
- [Google Maps Embed API](https://developers.google.com/maps/documentation/embed/get-started)
- [Documentation Gabon 24 interne]

---

*Document préparé pour Cascade AI - Version 1.0*
*Date : Septembre 2025*