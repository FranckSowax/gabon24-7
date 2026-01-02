# Guide Complet d'Intégration du Système de Paiement PVIT

> **Gabon24-7** - Guide pas à pas pour intégrer le système de paiement PVIT avec crédits premium et abonnements

---

## Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis](#2-prérequis)
3. [Phase 1: Configuration PVIT](#3-phase-1-configuration-pvit)
4. [Phase 2: Base de Données](#4-phase-2-base-de-données)
5. [Phase 3: Backend PHP (Endpoints PVIT)](#5-phase-3-backend-php-endpoints-pvit)
6. [Phase 4: Backend Node.js (API Crédits)](#6-phase-4-backend-nodejs-api-crédits)
7. [Phase 5: Frontend React](#7-phase-5-frontend-react)
8. [Phase 6: Tests et Déploiement](#8-phase-6-tests-et-déploiement)
9. [Troubleshooting](#9-troubleshooting)
10. [Annexes](#10-annexes)

---

## 1. Vue d'ensemble

### Architecture du Système

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js/React)                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │ TopUpModal  │  │CreditPackages│  │ CreditBalance   │     │
│  └──────┬──────┘  └──────────────┘  └─────────────────┘     │
│         │                                                    │
│         ▼ POST /api/credits-premium/purchase                │
└─────────┬───────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                  BACKEND NODE.JS (Express)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Routes: /packages, /balance, /purchase, /consume       │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│                           ▼ Appel PHP                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    BACKEND PHP (PVIT)                        │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │pvit_payment.php│  │pvit_callback.php│  │pvit_secret.php│ │
│  └───────┬────────┘  └────────┬────────┘  └──────────────┘  │
│          │                    │                              │
│          ▼                    ▼                              │
└──────────┼────────────────────┼─────────────────────────────┘
           │                    │
┌──────────▼────────────────────▼─────────────────────────────┐
│                      API PVIT                                │
│  https://api.mypvit.pro/YH6BCNXXAAQVNXYT/link (RESTLINK)    │
│  Mobile Money (Airtel, Moov) + Cartes Bancaires              │
└──────────┬────────────────────┬─────────────────────────────┘
           │                    │
┌──────────▼────────────────────▼─────────────────────────────┐
│                    SUPABASE (PostgreSQL)                     │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │pvit_payments │  │ user_credits   │  │credit_transactions│ │
│  └──────────────┘  └────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Flux de Paiement

```
1. Utilisateur sélectionne un package de crédits
2. Frontend envoie POST /api/credits-premium/purchase
3. Backend Node.js appelle pvit_payment.php
4. PHP vérifie/renouvelle la clé PVIT si nécessaire
5. PHP envoie la requête à l'API PVIT (RESTLINK)
6. PVIT envoie un prompt SMS à l'utilisateur
7. Utilisateur valide sur son mobile
8. PVIT appelle pvit_callback.php avec le résultat
9. PHP met à jour la base de données
10. Crédits ajoutés au compte utilisateur
```

---

## 2. Prérequis

### Comptes Requis

- [ ] **Compte PVIT Marchand** - https://dashboard.mypvit.pro
- [ ] **Compte Supabase** - https://supabase.com
- [ ] **Hébergement avec PHP 7.4+** (pour les endpoints PVIT)
- [ ] **Node.js 18+** (pour le backend Express)

### Informations à Récupérer

Depuis le Dashboard PVIT:
- `PVIT_OPERATION_ACCOUNT_CODE` (ex: ACC_693C9E5FA50B2)
- `PVIT_SECRET_KEY` (clé initiale)
- `PVIT_RENEW_PASSWORD` (mot de passe de renouvellement)

Codes des URLs (après configuration):
- `PVIT_CALLBACK_URL_CODE`
- `PVIT_RECEPTION_URL_CODE`
- `PVIT_SUCCESS_REDIRECTION_CODE`
- `PVIT_FAILED_REDIRECTION_CODE`

---

## 3. Phase 1: Configuration PVIT

### Étape 1.1: Créer le compte marchand

1. Aller sur https://dashboard.mypvit.pro
2. Cliquer sur "S'inscrire comme marchand"
3. Remplir les informations de l'entreprise
4. Valider l'email et le téléphone
5. Attendre l'activation du compte (24-48h)

### Étape 1.2: Configurer les URLs de callback

Dans le Dashboard PVIT → Paramètres → Webhooks:

| URL Type | Valeur | Description |
|----------|--------|-------------|
| **Callback URL** | `https://votre-domaine.com/api/pvit_callback.php` | Notification de paiement |
| **Reception Secret URL** | `https://votre-domaine.com/api/pvit_reception_secret.php` | Réception nouvelles clés |
| **Success Redirect** | `https://votre-domaine.com/payment-success` | Après paiement réussi |
| **Failed Redirect** | `https://votre-domaine.com/payment-failed` | Après paiement échoué |

### Étape 1.3: Récupérer les codes

Après configuration, notez les codes générés:
```
PVIT_CALLBACK_URL_CODE=UXABP       # Exemple
PVIT_RECEPTION_URL_CODE=6I8PN      # Exemple
PVIT_SUCCESS_REDIRECTION_CODE=ZVDFM
PVIT_FAILED_REDIRECTION_CODE=WU2Q3
```

### Étape 1.4: Créer le fichier .env

```env
# ===== PVIT Configuration =====
PVIT_SECRET_KEY=votre_cle_secrete_pvit_initiale
PVIT_OPERATION_ACCOUNT_CODE=ACC_VOTRE_CODE
PVIT_CALLBACK_URL_CODE=VOTRE_CODE
PVIT_RECEPTION_URL_CODE=VOTRE_CODE
PVIT_SUCCESS_REDIRECTION_CODE=VOTRE_CODE
PVIT_FAILED_REDIRECTION_CODE=VOTRE_CODE
PVIT_RENEW_PASSWORD=VotreMotDePasseRenouvellement

# ===== Supabase =====
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ===== Serveur =====
PORT=3001
NODE_ENV=development
```

---

## 4. Phase 2: Base de Données

### Étape 2.1: Tables PVIT

Exécuter dans Supabase SQL Editor:

```sql
-- =====================================================
-- TABLE: pvit_current_key
-- Stockage sécurisé des clés API PVIT
-- =====================================================
CREATE TABLE IF NOT EXISTS pvit_current_key (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_account_code VARCHAR(255) NOT NULL UNIQUE,
    secret_key TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    key_source VARCHAR(50) DEFAULT 'pvit_api',
    is_valid BOOLEAN DEFAULT true,
    CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Index pour recherche rapide de clé valide
CREATE INDEX idx_pvit_key_valid_expires
ON pvit_current_key(is_valid, expires_at DESC)
WHERE is_valid = true;

-- =====================================================
-- TABLE: pvit_payments
-- Enregistrement des transactions PVIT
-- =====================================================
CREATE TABLE IF NOT EXISTS pvit_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_id VARCHAR(255),
    reference VARCHAR(255) NOT NULL UNIQUE,
    merchant_reference_id VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    pvit_response JSONB,
    callback_data JSONB,
    package_id UUID,
    credits_to_add INTEGER DEFAULT 0,
    bonus_credits INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))
);

-- Index pour recherches fréquentes
CREATE INDEX idx_pvit_payments_reference ON pvit_payments(reference);
CREATE INDEX idx_pvit_payments_user_id ON pvit_payments(user_id);
CREATE INDEX idx_pvit_payments_status ON pvit_payments(status);
CREATE INDEX idx_pvit_payments_created_at ON pvit_payments(created_at DESC);

-- =====================================================
-- TABLE: pvit_callback_logs
-- Logs de tous les callbacks reçus (audit)
-- =====================================================
CREATE TABLE IF NOT EXISTS pvit_callback_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(255),
    merchant_reference_id VARCHAR(255),
    status VARCHAR(50),
    amount DECIMAL(15, 2),
    raw_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pvit_callback_logs_reference ON pvit_callback_logs(reference);
CREATE INDEX idx_pvit_callback_logs_created_at ON pvit_callback_logs(created_at DESC);
```

### Étape 2.2: Tables Crédits

```sql
-- =====================================================
-- TABLE: credit_packages
-- Packages de crédits disponibles à l'achat
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    credits INTEGER NOT NULL CHECK (credits > 0),
    bonus_credits INTEGER DEFAULT 0 CHECK (bonus_credits >= 0),
    price_xaf INTEGER NOT NULL CHECK (price_xaf > 0),
    price_usd DECIMAL(10,2),
    discount_percentage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    max_purchases_per_user INTEGER,
    description TEXT,
    features JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: user_credits
-- Solde de crédits par utilisateur
-- =====================================================
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0 CHECK (balance >= 0),
    bonus_balance INTEGER DEFAULT 0 CHECK (bonus_balance >= 0),
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    last_purchase_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);

-- =====================================================
-- TABLE: credit_transactions
-- Historique complet des transactions de crédits
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'consume', 'bonus', 'refund', 'admin_adjustment', 'welcome_bonus')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    bonus_balance_after INTEGER DEFAULT 0,
    description TEXT NOT NULL,
    service_name TEXT,
    reference_id TEXT,
    package_id UUID REFERENCES credit_packages(id),
    payment_method TEXT CHECK (payment_method IN ('mobile_money', 'credit_card', 'bank_transfer', 'pvit', 'admin', 'free')),
    payment_reference TEXT,
    price_paid_xaf INTEGER,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- =====================================================
-- TABLE: credit_costs
-- Coûts des services en crédits
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    cost_credits INTEGER NOT NULL CHECK (cost_credits > 0),
    description TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Étape 2.3: Fonctions RPC

```sql
-- =====================================================
-- FUNCTION: add_credits
-- Ajoute des crédits au compte utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_credits INTEGER,
    p_bonus_credits INTEGER DEFAULT 0,
    p_package_id UUID DEFAULT NULL,
    p_price_paid_xaf INTEGER DEFAULT 0,
    p_payment_method TEXT DEFAULT 'pvit',
    p_payment_reference TEXT DEFAULT NULL,
    p_description TEXT DEFAULT 'Achat de crédits'
)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
    v_new_balance INTEGER;
    v_new_bonus_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Récupérer ou créer le compte crédits avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO user_credits (user_id, balance, bonus_balance, total_earned)
        VALUES (p_user_id, 0, 0, 0)
        RETURNING * INTO v_user_credits;
    END IF;

    -- Calculer les nouveaux soldes
    v_new_balance := COALESCE(v_user_credits.balance, 0) + p_credits;
    v_new_bonus_balance := COALESCE(v_user_credits.bonus_balance, 0) + p_bonus_credits;

    -- Mettre à jour les soldes
    UPDATE user_credits
    SET
        balance = v_new_balance,
        bonus_balance = v_new_bonus_balance,
        total_earned = COALESCE(total_earned, 0) + p_credits + p_bonus_credits,
        last_purchase_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, package_id, payment_method, payment_reference,
        price_paid_xaf, status
    ) VALUES (
        p_user_id, 'purchase', p_credits + p_bonus_credits,
        v_new_balance, v_new_bonus_balance,
        p_description, p_package_id, p_payment_method,
        p_payment_reference, p_price_paid_xaf, 'completed'
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance', v_new_balance,
        'bonus_balance', v_new_bonus_balance,
        'total_balance', v_new_balance + v_new_bonus_balance,
        'credits_added', p_credits,
        'bonus_added', p_bonus_credits
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: consume_credits
-- Consomme des crédits pour un service
-- =====================================================
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_service_name TEXT,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
    v_new_balance INTEGER;
    v_new_bonus_balance INTEGER;
    v_amount_from_bonus INTEGER;
    v_amount_from_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Vérifier le solde avec verrouillage
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Créer si n'existe pas
    IF NOT FOUND THEN
        INSERT INTO user_credits (user_id, balance, bonus_balance)
        VALUES (p_user_id, 0, 0)
        RETURNING * INTO v_user_credits;
    END IF;

    -- Vérifier solde suffisant
    IF (COALESCE(v_user_credits.balance, 0) + COALESCE(v_user_credits.bonus_balance, 0)) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Solde insuffisant',
            'error_code', 'INSUFFICIENT_BALANCE',
            'balance', COALESCE(v_user_credits.balance, 0),
            'bonus_balance', COALESCE(v_user_credits.bonus_balance, 0),
            'total_balance', COALESCE(v_user_credits.balance, 0) + COALESCE(v_user_credits.bonus_balance, 0),
            'required', p_amount,
            'missing', p_amount - (COALESCE(v_user_credits.balance, 0) + COALESCE(v_user_credits.bonus_balance, 0))
        );
    END IF;

    -- Utiliser les bonus en premier (FIFO)
    v_amount_from_bonus := LEAST(COALESCE(v_user_credits.bonus_balance, 0), p_amount);
    v_amount_from_balance := p_amount - v_amount_from_bonus;

    v_new_bonus_balance := COALESCE(v_user_credits.bonus_balance, 0) - v_amount_from_bonus;
    v_new_balance := COALESCE(v_user_credits.balance, 0) - v_amount_from_balance;

    -- Mettre à jour les soldes
    UPDATE user_credits
    SET
        balance = v_new_balance,
        bonus_balance = v_new_bonus_balance,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Enregistrer la transaction
    INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, bonus_balance_after,
        description, service_name, reference_id, metadata, status
    ) VALUES (
        p_user_id, 'consume', -p_amount, v_new_balance, v_new_bonus_balance,
        p_description, p_service_name, p_reference_id, p_metadata, 'completed'
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'balance', v_new_balance,
        'bonus_balance', v_new_bonus_balance,
        'total_balance', v_new_balance + v_new_bonus_balance,
        'consumed', p_amount,
        'from_bonus', v_amount_from_bonus,
        'from_balance', v_amount_from_balance
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: get_credit_balance
-- Récupère le solde de l'utilisateur
-- =====================================================
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_credits RECORD;
BEGIN
    SELECT * INTO v_user_credits
    FROM user_credits
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        -- Créer un compte avec solde 0
        INSERT INTO user_credits (user_id, balance, bonus_balance)
        VALUES (p_user_id, 0, 0)
        RETURNING * INTO v_user_credits;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'balance', COALESCE(v_user_credits.balance, 0),
        'bonus_balance', COALESCE(v_user_credits.bonus_balance, 0),
        'total_balance', COALESCE(v_user_credits.balance, 0) + COALESCE(v_user_credits.bonus_balance, 0),
        'total_earned', COALESCE(v_user_credits.total_earned, 0),
        'total_spent', COALESCE(v_user_credits.total_spent, 0),
        'last_purchase_at', v_user_credits.last_purchase_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Étape 2.4: Données initiales

```sql
-- =====================================================
-- SEED: Packages de crédits
-- =====================================================
INSERT INTO credit_packages (name, slug, credits, bonus_credits, price_xaf, price_usd, is_popular, sort_order, description, features) VALUES
('Pack Starter', 'starter', 100, 0, 5000, 8.00, false, 1, 'Idéal pour découvrir', '["100 crédits", "Valable 1 an", "Support email"]'),
('Pack Standard', 'standard', 300, 50, 12000, 20.00, true, 2, 'Meilleur rapport qualité-prix', '["300 crédits", "50 bonus", "Valable 1 an", "Support prioritaire"]'),
('Pack Premium', 'premium', 600, 150, 20000, 33.00, false, 3, 'Pour les utilisateurs réguliers', '["600 crédits", "150 bonus", "Valable 1 an", "Support 24/7"]'),
('Pack Business', 'business', 1500, 500, 45000, 75.00, false, 4, 'Pour les professionnels', '["1500 crédits", "500 bonus", "Valable 1 an", "Support dédié", "API access"]')
ON CONFLICT (slug) DO UPDATE SET
    credits = EXCLUDED.credits,
    bonus_credits = EXCLUDED.bonus_credits,
    price_xaf = EXCLUDED.price_xaf,
    updated_at = NOW();

-- =====================================================
-- SEED: Coûts des services
-- =====================================================
INSERT INTO credit_costs (service_name, display_name, cost_credits, description, category) VALUES
('ai_article_summary', 'Résumé IA d''article', 3, 'Génération d''un résumé intelligent', 'AI'),
('ai_article_analysis', 'Analyse IA approfondie', 5, 'Analyse complète avec insights', 'AI'),
('ai_business_plan', 'Générateur Business Plan', 15, 'Business plan complet généré par IA', 'AI'),
('ai_audio_generation', 'Génération Audio', 5, 'Conversion texte en audio', 'AI'),
('ai_image_generation', 'Génération Image', 8, 'Création d''image par IA', 'AI'),
('export_pdf', 'Export PDF', 2, 'Export en format PDF', 'Export'),
('export_excel', 'Export Excel', 2, 'Export en format Excel', 'Export'),
('alert_creation', 'Création d''alerte', 1, 'Nouvelle alerte personnalisée', 'Alerts'),
('poll_creation', 'Création de sondage', 5, 'Nouveau sondage', 'Polls'),
('game_participation', 'Participation au jeu', 10, 'Entrée dans un quiz', 'Game')
ON CONFLICT (service_name) DO UPDATE SET
    cost_credits = EXCLUDED.cost_credits,
    updated_at = NOW();

-- =====================================================
-- SEED: Clé PVIT initiale (à remplacer par la vraie)
-- =====================================================
INSERT INTO pvit_current_key (
    operation_account_code,
    secret_key,
    expires_at,
    key_source,
    is_valid
) VALUES (
    'ACC_VOTRE_CODE', -- Remplacer par votre code
    'VOTRE_CLE_SECRETE_PVIT', -- Remplacer par votre clé
    NOW() + INTERVAL '24 hours',
    'manual',
    true
) ON CONFLICT (operation_account_code) DO UPDATE SET
    secret_key = EXCLUDED.secret_key,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();
```

### Étape 2.5: Row Level Security (RLS)

```sql
-- Activer RLS sur les tables sensibles
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvit_payments ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs ne voient que leurs propres données
CREATE POLICY "Users can view own credits"
ON user_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions"
ON credit_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payments"
ON pvit_payments FOR SELECT
USING (auth.uid() = user_id);

-- Service role peut tout faire
CREATE POLICY "Service role full access to credits"
ON user_credits FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to transactions"
ON credit_transactions FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to payments"
ON pvit_payments FOR ALL
USING (auth.role() = 'service_role');
```

---

## 5. Phase 3: Backend PHP (Endpoints PVIT)

### Étape 3.1: Structure des fichiers

```
backend/
├── api/
│   ├── pvit_payment.php          # Initiation des paiements
│   ├── pvit_callback.php         # Réception callbacks PVIT
│   └── pvit_reception_secret.php # Réception nouvelles clés
└── lib/
    ├── PvitApiClient.php         # Client API PVIT
    └── supabase-php.php          # Client Supabase PHP
```

### Étape 3.2: Créer `backend/lib/supabase-php.php`

```php
<?php
/**
 * Client Supabase simplifié pour PHP
 */
class SupabaseClient {
    private $url;
    private $serviceRoleKey;

    public function __construct() {
        $this->url = getenv('SUPABASE_URL') ?: 'https://votre-projet.supabase.co';
        $this->serviceRoleKey = getenv('SUPABASE_SERVICE_ROLE_KEY');

        if (!$this->serviceRoleKey) {
            throw new Exception('SUPABASE_SERVICE_ROLE_KEY non définie');
        }
    }

    /**
     * Effectue une requête HTTP vers Supabase
     */
    private function request($method, $endpoint, $data = null, $params = []) {
        $url = $this->url . '/rest/v1/' . $endpoint;

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $this->serviceRoleKey,
            'Authorization: Bearer ' . $this->serviceRoleKey,
            'Prefer: return=representation'
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("Erreur cURL: $error");
        }

        return [
            'data' => json_decode($response, true),
            'status' => $httpCode
        ];
    }

    /**
     * SELECT - Récupérer des données
     */
    public function select($table, $columns = '*', $filters = []) {
        $params = ['select' => $columns];
        foreach ($filters as $key => $value) {
            $params[$key] = $value;
        }
        return $this->request('GET', $table, null, $params);
    }

    /**
     * INSERT - Insérer des données
     */
    public function insert($table, $data) {
        return $this->request('POST', $table, $data);
    }

    /**
     * UPDATE - Mettre à jour des données
     */
    public function update($table, $data, $filters = []) {
        $params = [];
        foreach ($filters as $key => $value) {
            $params[$key] = $value;
        }
        return $this->request('PATCH', $table, $data, $params);
    }

    /**
     * UPSERT - Insérer ou mettre à jour
     */
    public function upsert($table, $data, $onConflict = '') {
        $headers = ['Prefer: resolution=merge-duplicates'];
        if ($onConflict) {
            $headers[] = "on_conflict=$onConflict";
        }
        return $this->request('POST', $table, $data);
    }

    /**
     * RPC - Appeler une fonction PostgreSQL
     */
    public function rpc($functionName, $params = []) {
        $url = $this->url . '/rest/v1/rpc/' . $functionName;

        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $this->serviceRoleKey,
            'Authorization: Bearer ' . $this->serviceRoleKey
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [
            'data' => json_decode($response, true),
            'status' => $httpCode
        ];
    }
}
```

### Étape 3.3: Créer `backend/lib/PvitApiClient.php`

```php
<?php
/**
 * Client API PVIT - Gestion des paiements Mobile Money
 */
class PvitApiClient {
    private $baseUrl = 'https://api.mypvit.pro';
    private $supabase;
    private $operationAccountCode;
    private $callbackUrlCode;
    private $receptionUrlCode;
    private $successRedirectionCode;
    private $failedRedirectionCode;
    private $renewPassword;

    public function __construct(SupabaseClient $supabase) {
        $this->supabase = $supabase;
        $this->operationAccountCode = getenv('PVIT_OPERATION_ACCOUNT_CODE');
        $this->callbackUrlCode = getenv('PVIT_CALLBACK_URL_CODE');
        $this->receptionUrlCode = getenv('PVIT_RECEPTION_URL_CODE');
        $this->successRedirectionCode = getenv('PVIT_SUCCESS_REDIRECTION_CODE');
        $this->failedRedirectionCode = getenv('PVIT_FAILED_REDIRECTION_CODE');
        $this->renewPassword = getenv('PVIT_RENEW_PASSWORD');
    }

    /**
     * Récupère la clé secrète PVIT valide depuis la base de données
     */
    public function getPvitSecretKey($operationAccountCode = null) {
        $accountCode = $operationAccountCode ?: $this->operationAccountCode;

        $result = $this->supabase->select(
            'pvit_current_key',
            '*',
            [
                'operation_account_code' => 'eq.' . $accountCode,
                'is_valid' => 'eq.true',
                'expires_at' => 'gt.' . date('c') // ISO 8601
            ]
        );

        if ($result['status'] === 200 && !empty($result['data'])) {
            return $result['data'][0];
        }

        return null;
    }

    /**
     * Régénère la clé secrète PVIT
     */
    public function regeneratePvitKey($operationAccountCode = null) {
        $accountCode = $operationAccountCode ?: $this->operationAccountCode;

        $payload = [
            'operationAccountCode' => $accountCode,
            'receptionUrlCode' => $this->receptionUrlCode,
            'password' => $this->renewPassword
        ];

        $response = $this->makeRequest(
            '/BYQ5LLFX2X0BA0HB/renew-secret',
            $payload,
            false // Ne pas utiliser de clé pour le renouvellement
        );

        return $response;
    }

    /**
     * Vérifie et gère automatiquement la clé PVIT
     */
    public function verifyAndManagePvitKey($operationAccountCode = null) {
        $accountCode = $operationAccountCode ?: $this->operationAccountCode;

        // Vérifier si une clé valide existe
        $currentKey = $this->getPvitSecretKey($accountCode);

        if (!$currentKey) {
            // Tentative de régénération avec retry
            for ($attempt = 1; $attempt <= 3; $attempt++) {
                if ($attempt > 1) {
                    sleep(3); // Attendre 3 secondes entre les tentatives
                }

                $regenerationResult = $this->regeneratePvitKey($accountCode);

                if ($regenerationResult && isset($regenerationResult['success']) && $regenerationResult['success']) {
                    // Attendre que PVIT envoie la nouvelle clé
                    sleep(3);

                    $newKey = $this->getPvitSecretKey($accountCode);

                    if ($newKey) {
                        return [
                            'success' => true,
                            'key_data' => $newKey,
                            'regenerated' => true,
                            'attempts' => $attempt
                        ];
                    }
                }
            }

            return [
                'success' => false,
                'error' => 'Impossible de régénérer la clé PVIT après 3 tentatives',
                'retry_after' => 10
            ];
        }

        return [
            'success' => true,
            'key_data' => $currentKey,
            'regenerated' => false
        ];
    }

    /**
     * Initie un paiement via PVIT RESTLINK (recommandé)
     */
    public function initiatePaymentRestLink($params) {
        // Vérifier/régénérer la clé
        $keyResult = $this->verifyAndManagePvitKey();

        if (!$keyResult['success']) {
            return [
                'success' => false,
                'error' => $keyResult['error'],
                'retry_after' => $keyResult['retry_after'] ?? 10
            ];
        }

        $secretKey = $keyResult['key_data']['secret_key'];

        $payload = [
            'amount' => $params['amount'],
            'currency' => 'XAF',
            'merchantReference' => $params['reference'],
            'customerMsisdn' => $params['phone'],
            'description' => $params['description'] ?? 'Achat de crédits',
            'operationAccountCode' => $this->operationAccountCode,
            'callbackUrlCode' => $this->callbackUrlCode,
            'successRedirectionCode' => $this->successRedirectionCode,
            'failedRedirectionCode' => $this->failedRedirectionCode
        ];

        $response = $this->makeRequest('/YH6BCNXXAAQVNXYT/link', $payload, true, $secretKey);

        return $response;
    }

    /**
     * Vérifie le statut d'une transaction
     */
    public function checkTransactionStatus($merchantReferenceId) {
        $keyResult = $this->verifyAndManagePvitKey();

        if (!$keyResult['success']) {
            return ['success' => false, 'error' => $keyResult['error']];
        }

        $secretKey = $keyResult['key_data']['secret_key'];

        $payload = [
            'merchantReferenceId' => $merchantReferenceId,
            'operationAccountCode' => $this->operationAccountCode
        ];

        return $this->makeRequest('/9CYO5IQF289XH253/status', $payload, true, $secretKey);
    }

    /**
     * Effectue une requête HTTP vers l'API PVIT
     */
    private function makeRequest($endpoint, $payload, $useAuth = true, $secretKey = null) {
        $url = $this->baseUrl . $endpoint;

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];

        if ($useAuth && $secretKey) {
            $headers[] = 'Authorization: Bearer ' . $secretKey;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => "Erreur cURL: $error",
                'http_code' => 0
            ];
        }

        $data = json_decode($response, true);

        return [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'http_code' => $httpCode,
            'data' => $data,
            'raw_response' => $response
        ];
    }

    /**
     * Reçoit et enregistre une nouvelle clé secrète
     */
    public function receiveSecretKey($data) {
        if (!isset($data['operation_account_code'], $data['secret_key'])) {
            return [
                'success' => false,
                'error' => 'Données manquantes'
            ];
        }

        $expiresIn = $data['expires_in'] ?? 86400; // 24h par défaut
        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);

        // Désactiver les anciennes clés
        $this->supabase->update(
            'pvit_current_key',
            ['is_valid' => false],
            ['operation_account_code' => 'eq.' . $data['operation_account_code']]
        );

        // Insérer la nouvelle clé
        $result = $this->supabase->insert('pvit_current_key', [
            'operation_account_code' => $data['operation_account_code'],
            'secret_key' => $data['secret_key'],
            'expires_at' => $expiresAt,
            'key_source' => 'pvit_api',
            'is_valid' => true
        ]);

        return [
            'success' => $result['status'] === 201,
            'expires_at' => $expiresAt
        ];
    }
}
```

### Étape 3.4: Créer `backend/api/pvit_payment.php`

```php
<?php
/**
 * Endpoint d'initiation de paiement PVIT
 * POST /api/pvit_payment.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../lib/supabase-php.php';
require_once __DIR__ . '/../lib/PvitApiClient.php';

try {
    // Récupérer les données de la requête
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Validation des paramètres requis
    $required = ['amount', 'phone', 'reference'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Champ requis manquant: $field");
        }
    }

    // Validation du montant
    $amount = intval($data['amount']);
    if ($amount < 100) {
        throw new Exception('Montant minimum: 100 XAF');
    }

    // Validation du téléphone
    $phone = preg_replace('/[^0-9]/', '', $data['phone']);
    if (strlen($phone) < 9) {
        throw new Exception('Numéro de téléphone invalide');
    }

    // Initialiser les clients
    $supabase = new SupabaseClient();
    $pvitClient = new PvitApiClient($supabase);

    // Préparer les paramètres
    $params = [
        'amount' => $amount,
        'phone' => $phone,
        'reference' => $data['reference'],
        'description' => $data['description'] ?? 'Achat de crédits Gabon24-7'
    ];

    // Enregistrer le paiement en attente
    $paymentData = [
        'order_id' => $data['order_id'] ?? null,
        'reference' => $data['reference'],
        'amount' => $amount,
        'phone' => $phone,
        'description' => $params['description'],
        'status' => 'pending',
        'user_id' => $data['user_id'] ?? null,
        'package_id' => $data['package_id'] ?? null,
        'credits_to_add' => $data['credits'] ?? 0,
        'bonus_credits' => $data['bonus_credits'] ?? 0
    ];

    $insertResult = $supabase->insert('pvit_payments', $paymentData);

    if ($insertResult['status'] !== 201) {
        throw new Exception('Erreur lors de l\'enregistrement du paiement');
    }

    // Initier le paiement PVIT
    $pvitResponse = $pvitClient->initiatePaymentRestLink($params);

    if (!$pvitResponse['success']) {
        // Mettre à jour le statut en échec
        $supabase->update(
            'pvit_payments',
            [
                'status' => 'failed',
                'pvit_response' => json_encode($pvitResponse)
            ],
            ['reference' => 'eq.' . $data['reference']]
        );

        throw new Exception($pvitResponse['error'] ?? 'Erreur PVIT inconnue');
    }

    // Mettre à jour avec la réponse PVIT
    $merchantReferenceId = $pvitResponse['data']['merchantReferenceId'] ?? null;

    $supabase->update(
        'pvit_payments',
        [
            'merchant_reference_id' => $merchantReferenceId,
            'pvit_response' => json_encode($pvitResponse['data'])
        ],
        ['reference' => 'eq.' . $data['reference']]
    );

    // Réponse succès
    echo json_encode([
        'success' => true,
        'data' => [
            'reference' => $data['reference'],
            'merchant_reference_id' => $merchantReferenceId,
            'amount' => $amount,
            'status' => 'pending',
            'message' => 'Paiement initié. Vérifiez votre téléphone.'
        ],
        'pvit_response' => $pvitResponse['data']
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
```

### Étape 3.5: Créer `backend/api/pvit_callback.php`

```php
<?php
/**
 * Endpoint de callback PVIT
 * POST /api/pvit_callback.php
 *
 * Appelé automatiquement par PVIT après chaque transaction
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../lib/supabase-php.php';

// Toujours répondre 200 OK à PVIT rapidement
function respondToPvit($success = true, $message = 'OK') {
    echo json_encode([
        'responseCode' => $success ? 'SUCCESS' : 'ERROR',
        'message' => $message,
        'timestamp' => date('c')
    ]);
}

try {
    $supabase = new SupabaseClient();

    // Récupérer les données du callback
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Log du callback (pour audit)
    $logData = [
        'reference' => $data['merchantReference'] ?? null,
        'merchant_reference_id' => $data['merchantReferenceId'] ?? null,
        'status' => $data['operationStatus'] ?? 'UNKNOWN',
        'amount' => $data['amount'] ?? 0,
        'raw_data' => json_encode($data),
        'processed' => false
    ];

    $supabase->insert('pvit_callback_logs', $logData);

    // Extraire les informations clés
    $reference = $data['merchantReference'] ?? null;
    $merchantReferenceId = $data['merchantReferenceId'] ?? null;
    $operationStatus = strtoupper($data['operationStatus'] ?? '');
    $amount = $data['amount'] ?? 0;

    if (!$reference) {
        respondToPvit(true, 'Reference manquante mais callback enregistré');
        exit;
    }

    // Mapper le statut PVIT vers notre statut interne
    $statusMap = [
        'SUCCESS' => 'completed',
        'SUCCESSFUL' => 'completed',
        'COMPLETED' => 'completed',
        'FAILED' => 'failed',
        'FAILURE' => 'failed',
        'CANCELLED' => 'cancelled',
        'PENDING' => 'pending'
    ];

    $internalStatus = $statusMap[$operationStatus] ?? 'pending';

    // Récupérer le paiement existant
    $paymentResult = $supabase->select(
        'pvit_payments',
        '*',
        ['reference' => 'eq.' . $reference]
    );

    if (empty($paymentResult['data'])) {
        respondToPvit(true, 'Paiement non trouvé mais callback enregistré');
        exit;
    }

    $payment = $paymentResult['data'][0];

    // Ne pas retraiter un paiement déjà complété
    if ($payment['status'] === 'completed') {
        respondToPvit(true, 'Paiement déjà traité');
        exit;
    }

    // Mettre à jour le paiement
    $updateData = [
        'status' => $internalStatus,
        'callback_data' => json_encode($data),
        'updated_at' => date('c')
    ];

    if ($internalStatus === 'completed') {
        $updateData['completed_at'] = date('c');
    }

    $supabase->update(
        'pvit_payments',
        $updateData,
        ['reference' => 'eq.' . $reference]
    );

    // Si paiement réussi, ajouter les crédits
    if ($internalStatus === 'completed' && $payment['user_id']) {
        $creditsToAdd = intval($payment['credits_to_add'] ?? 0);
        $bonusCredits = intval($payment['bonus_credits'] ?? 0);

        if ($creditsToAdd > 0) {
            $rpcResult = $supabase->rpc('add_credits', [
                'p_user_id' => $payment['user_id'],
                'p_credits' => $creditsToAdd,
                'p_bonus_credits' => $bonusCredits,
                'p_package_id' => $payment['package_id'],
                'p_price_paid_xaf' => intval($amount),
                'p_payment_method' => 'pvit',
                'p_payment_reference' => $merchantReferenceId,
                'p_description' => 'Achat via PVIT - ' . $reference
            ]);

            // Marquer le callback comme traité
            $supabase->update(
                'pvit_callback_logs',
                ['processed' => true],
                ['reference' => 'eq.' . $reference]
            );
        }
    }

    respondToPvit(true, 'Callback traité avec succès');

} catch (Exception $e) {
    // Toujours répondre 200 à PVIT même en cas d'erreur
    respondToPvit(true, 'Erreur interne mais callback reçu: ' . $e->getMessage());
}
```

### Étape 3.6: Créer `backend/api/pvit_reception_secret.php`

```php
<?php
/**
 * Endpoint de réception des nouvelles clés secrètes PVIT
 * POST /api/pvit_reception_secret.php
 *
 * Appelé par PVIT après une demande de renouvellement de clé
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../lib/supabase-php.php';
require_once __DIR__ . '/../lib/PvitApiClient.php';

try {
    $supabase = new SupabaseClient();
    $pvitClient = new PvitApiClient($supabase);

    // Récupérer les données
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Log pour debug
    error_log('PVIT Reception Secret: ' . $input);

    // Valider les données requises
    if (!isset($data['operation_account_code']) || !isset($data['secret_key'])) {
        // Essayer d'autres formats possibles
        $data = [
            'operation_account_code' => $data['operationAccountCode'] ?? $data['operation_account_code'] ?? null,
            'secret_key' => $data['secretKey'] ?? $data['secret_key'] ?? null,
            'expires_in' => $data['expiresIn'] ?? $data['expires_in'] ?? 86400
        ];
    }

    if (!$data['operation_account_code'] || !$data['secret_key']) {
        throw new Exception('Données de clé manquantes');
    }

    // Enregistrer la nouvelle clé
    $result = $pvitClient->receiveSecretKey($data);

    if ($result['success']) {
        echo json_encode([
            'responseCode' => 'SUCCESS',
            'message' => 'Clé enregistrée avec succès',
            'expires_at' => $result['expires_at']
        ]);
    } else {
        throw new Exception($result['error'] ?? 'Erreur inconnue');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'responseCode' => 'ERROR',
        'message' => $e->getMessage()
    ]);
}
```

---

## 6. Phase 4: Backend Node.js (API Crédits)

### Étape 4.1: Créer `backend/routes/credits-premium.js`

```javascript
/**
 * Routes API pour la gestion des crédits premium
 * /api/credits-premium/*
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialiser Supabase avec service role
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GET /api/credits-premium/packages
 * Liste tous les packages de crédits disponibles
 */
router.get('/packages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      packages: data
    });
  } catch (error) {
    console.error('Erreur packages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/credits-premium/balance/:userId
 * Récupère le solde de crédits d'un utilisateur
 */
router.get('/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase.rpc('get_credit_balance', {
      p_user_id: userId
    });

    if (error) throw error;

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Erreur balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credits-premium/consume
 * Consomme des crédits pour un service
 */
router.post('/consume', async (req, res) => {
  try {
    const { userId, serviceName, amount, description, referenceId, metadata } = req.body;

    if (!userId || !serviceName || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: userId, serviceName, amount'
      });
    }

    const { data, error } = await supabase.rpc('consume_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_service_name: serviceName,
      p_description: description || `Utilisation: ${serviceName}`,
      p_reference_id: referenceId || null,
      p_metadata: metadata || {}
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Erreur consume:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credits-premium/add
 * Ajoute des crédits (après paiement réussi)
 */
router.post('/add', async (req, res) => {
  try {
    const {
      userId,
      credits,
      bonusCredits = 0,
      packageId,
      pricePaidXaf,
      paymentMethod = 'pvit',
      paymentReference,
      description
    } = req.body;

    if (!userId || !credits) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: userId, credits'
      });
    }

    const { data, error } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_credits: credits,
      p_bonus_credits: bonusCredits,
      p_package_id: packageId || null,
      p_price_paid_xaf: pricePaidXaf || 0,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference || null,
      p_description: description || 'Achat de crédits'
    });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Erreur add:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/credits-premium/check
 * Vérifie si l'utilisateur a assez de crédits
 */
router.post('/check', async (req, res) => {
  try {
    const { userId, serviceName, amount } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    // Récupérer le solde
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      'get_credit_balance',
      { p_user_id: userId }
    );

    if (balanceError) throw balanceError;

    // Si un service est spécifié, récupérer son coût
    let requiredAmount = amount;
    if (serviceName && !amount) {
      const { data: costData } = await supabase
        .from('credit_costs')
        .select('cost_credits')
        .eq('service_name', serviceName)
        .eq('is_active', true)
        .single();

      requiredAmount = costData?.cost_credits || 0;
    }

    const totalBalance = balanceData.total_balance || 0;
    const hasEnough = totalBalance >= (requiredAmount || 0);

    res.json({
      success: true,
      has_enough: hasEnough,
      balance: balanceData.balance,
      bonus_balance: balanceData.bonus_balance,
      total_balance: totalBalance,
      required: requiredAmount,
      missing: hasEnough ? 0 : requiredAmount - totalBalance
    });
  } catch (error) {
    console.error('Erreur check:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/credits-premium/history/:userId
 * Historique des transactions de crédits
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, type } = req.query;

    let query = supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      transactions: data,
      count: data.length,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Erreur history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/credits-premium/costs
 * Liste des coûts de tous les services
 */
router.get('/costs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_costs')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      costs: data
    });
  } catch (error) {
    console.error('Erreur costs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/credits-premium/stats/:userId
 * Statistiques d'utilisation des crédits
 */
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Solde actuel
    const { data: balanceData } = await supabase.rpc('get_credit_balance', {
      p_user_id: userId
    });

    // Statistiques des transactions
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('type, amount, service_name, created_at')
      .eq('user_id', userId);

    // Calculer les stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let monthlySpending = 0;
    const serviceUsage = {};

    transactions?.forEach(t => {
      if (t.type === 'consume') {
        const transDate = new Date(t.created_at);
        if (transDate >= monthStart) {
          monthlySpending += Math.abs(t.amount);
        }
        if (t.service_name) {
          serviceUsage[t.service_name] = (serviceUsage[t.service_name] || 0) + 1;
        }
      }
    });

    // Service le plus utilisé
    let mostUsedService = null;
    let maxUsage = 0;
    Object.entries(serviceUsage).forEach(([service, count]) => {
      if (count > maxUsage) {
        maxUsage = count;
        mostUsedService = service;
      }
    });

    res.json({
      success: true,
      stats: {
        ...balanceData,
        transactions_count: transactions?.length || 0,
        monthly_spending: monthlySpending,
        most_used_service: mostUsedService,
        service_usage: serviceUsage
      }
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### Étape 4.2: Intégrer dans `server.js`

```javascript
// Dans server.js, ajouter:

const creditsPremiumRouter = require('./routes/credits-premium');

// ... autres middlewares ...

// Routes crédits premium
app.use('/api/credits-premium', creditsPremiumRouter);
```

---

## 7. Phase 5: Frontend React

### Étape 5.1: Créer `frontend/src/lib/credits.ts`

```typescript
/**
 * API Client pour les crédits
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  credits: number;
  bonus_credits: number;
  price_xaf: number;
  price_usd: number;
  is_popular: boolean;
  description: string;
  features: string[];
}

export interface CreditBalance {
  balance: number;
  bonus_balance: number;
  total_balance: number;
  total_earned: number;
  total_spent: number;
  last_purchase_at: string | null;
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'consume' | 'bonus' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  service_name: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface CreditCost {
  service_name: string;
  display_name: string;
  cost_credits: number;
  description: string;
  category: string;
}

/**
 * Récupère la liste des packages de crédits
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  const response = await fetch(`${API_BASE_URL}/api/credits-premium/packages`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Erreur lors de la récupération des packages');
  }

  return data.packages;
}

/**
 * Récupère le solde de crédits d'un utilisateur
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const response = await fetch(`${API_BASE_URL}/api/credits-premium/balance/${userId}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Erreur lors de la récupération du solde');
  }

  return {
    balance: data.balance,
    bonus_balance: data.bonus_balance,
    total_balance: data.total_balance,
    total_earned: data.total_earned,
    total_spent: data.total_spent,
    last_purchase_at: data.last_purchase_at
  };
}

/**
 * Consomme des crédits pour un service
 */
export async function consumeCredits(
  userId: string,
  serviceName: string,
  amount: number,
  description: string,
  referenceId?: string
): Promise<{ success: boolean; balance: number; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/credits-premium/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      serviceName,
      amount,
      description,
      referenceId
    })
  });

  return response.json();
}

/**
 * Vérifie si l'utilisateur a assez de crédits
 */
export async function checkCredits(
  userId: string,
  serviceName?: string,
  amount?: number
): Promise<{ has_enough: boolean; missing: number; total_balance: number }> {
  const response = await fetch(`${API_BASE_URL}/api/credits-premium/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, serviceName, amount })
  });

  return response.json();
}

/**
 * Récupère l'historique des transactions
 */
export async function getCreditHistory(
  userId: string,
  limit = 50,
  offset = 0,
  type?: string
): Promise<CreditTransaction[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (type) params.append('type', type);

  const response = await fetch(
    `${API_BASE_URL}/api/credits-premium/history/${userId}?${params}`
  );
  const data = await response.json();

  return data.transactions || [];
}

/**
 * Récupère les coûts des services
 */
export async function getCreditCosts(): Promise<CreditCost[]> {
  const response = await fetch(`${API_BASE_URL}/api/credits-premium/costs`);
  const data = await response.json();

  return data.costs || [];
}

/**
 * Initie un paiement PVIT
 */
export async function initiatePvitPayment(params: {
  userId: string;
  packageId: string;
  phone: string;
  credits: number;
  bonusCredits: number;
  priceXaf: number;
}): Promise<{ success: boolean; reference?: string; error?: string }> {
  const reference = `CR_${params.userId.slice(0, 8)}_${Date.now()}`;

  const response = await fetch(`${API_BASE_URL}/api/pvit_payment.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: params.userId,
      package_id: params.packageId,
      reference,
      amount: params.priceXaf,
      phone: params.phone,
      credits: params.credits,
      bonus_credits: params.bonusCredits,
      description: `Achat ${params.credits} crédits`
    })
  });

  const data = await response.json();

  return {
    success: data.success,
    reference: data.success ? reference : undefined,
    error: data.error
  };
}
```

### Étape 5.2: Créer `frontend/src/lib/creditManager.ts`

```typescript
/**
 * Gestionnaire de crédits côté client
 * Hook et utilitaires pour la gestion des crédits
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCreditBalance,
  consumeCredits,
  checkCredits,
  getCreditCosts,
  CreditBalance,
  CreditCost
} from './credits';

export interface UseCreditManagerResult {
  balance: number;
  bonusBalance: number;
  totalBalance: number;
  loading: boolean;
  error: string | null;
  costs: Map<string, number>;
  refresh: () => Promise<void>;
  debit: (amount: number, serviceName: string, description: string) => Promise<boolean>;
  hasEnough: (amount: number) => boolean;
  getServiceCost: (serviceName: string) => number;
}

/**
 * Hook pour gérer les crédits d'un utilisateur
 */
export function useCreditManager(userId: string | null): UseCreditManagerResult {
  const [balance, setBalance] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<Map<string, number>>(new Map());

  // Charger le solde
  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [balanceData, costsData] = await Promise.all([
        getCreditBalance(userId),
        getCreditCosts()
      ]);

      setBalance(balanceData.balance);
      setBonusBalance(balanceData.bonus_balance);

      const costsMap = new Map<string, number>();
      costsData.forEach(cost => {
        costsMap.set(cost.service_name, cost.cost_credits);
      });
      setCosts(costsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Charger au montage
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Débiter des crédits
  const debit = useCallback(async (
    amount: number,
    serviceName: string,
    description: string
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const result = await consumeCredits(userId, serviceName, amount, description);

      if (result.success) {
        // Mettre à jour le solde local
        await refresh();
        return true;
      }

      setError(result.error || 'Erreur lors du débit');
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      return false;
    }
  }, [userId, refresh]);

  // Vérifier si assez de crédits
  const hasEnough = useCallback((amount: number): boolean => {
    return (balance + bonusBalance) >= amount;
  }, [balance, bonusBalance]);

  // Obtenir le coût d'un service
  const getServiceCost = useCallback((serviceName: string): number => {
    return costs.get(serviceName) || 0;
  }, [costs]);

  return {
    balance,
    bonusBalance,
    totalBalance: balance + bonusBalance,
    loading,
    error,
    costs,
    refresh,
    debit,
    hasEnough,
    getServiceCost
  };
}

/**
 * Formater un nombre de crédits
 */
export function formatCredits(credits: number): string {
  return credits.toLocaleString('fr-FR');
}

/**
 * Formater un prix en XAF
 */
export function formatPriceXAF(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}
```

### Étape 5.3: Créer `frontend/src/components/credits/CreditBalance.tsx`

```tsx
/**
 * Composant d'affichage du solde de crédits
 */

'use client';

import { useState } from 'react';
import { Coins, TrendingUp, AlertTriangle, Plus } from 'lucide-react';
import { formatCredits } from '@/lib/creditManager';
import TopUpModal from './TopUpModal';

interface CreditBalanceProps {
  balance: number;
  bonusBalance: number;
  loading?: boolean;
  onRefresh?: () => void;
}

export default function CreditBalance({
  balance,
  bonusBalance,
  loading = false,
  onRefresh
}: CreditBalanceProps) {
  const [showTopUp, setShowTopUp] = useState(false);

  const totalBalance = balance + bonusBalance;
  const isLowBalance = totalBalance < 10;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            Mes Crédits
          </h3>
          <button
            onClick={() => setShowTopUp(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Recharger
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ) : (
          <>
            {/* Solde total */}
            <div className="mb-4">
              <div className="text-3xl font-bold text-gray-900">
                {formatCredits(totalBalance)}
                <span className="text-lg font-normal text-gray-500 ml-2">crédits</span>
              </div>

              {isLowBalance && (
                <div className="flex items-center gap-2 mt-2 text-amber-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Solde faible - Pensez à recharger
                </div>
              )}
            </div>

            {/* Détail */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm text-gray-500">Crédits achetés</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCredits(balance)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  Bonus
                </div>
                <div className="text-lg font-semibold text-green-600">
                  +{formatCredits(bonusBalance)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de recharge */}
      <TopUpModal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        onPurchased={() => {
          setShowTopUp(false);
          onRefresh?.();
        }}
      />
    </>
  );
}
```

### Étape 5.4: Créer `frontend/src/components/credits/CreditPackages.tsx`

```tsx
/**
 * Composant d'affichage des packages de crédits
 */

'use client';

import { Coins, Star, Zap, Crown } from 'lucide-react';
import { CreditPackage } from '@/lib/credits';
import { formatCredits, formatPriceXAF } from '@/lib/creditManager';

interface CreditPackagesProps {
  packages: CreditPackage[];
  selectedId: string | null;
  onSelect: (pkg: CreditPackage) => void;
  loading?: boolean;
}

const packageIcons: Record<string, React.ReactNode> = {
  starter: <Coins className="w-6 h-6 text-gray-500" />,
  standard: <Star className="w-6 h-6 text-yellow-500" />,
  premium: <Zap className="w-6 h-6 text-purple-500" />,
  business: <Crown className="w-6 h-6 text-amber-500" />
};

export default function CreditPackages({
  packages,
  selectedId,
  onSelect,
  loading = false
}: CreditPackagesProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-40" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {packages.map(pkg => (
        <div
          key={pkg.id}
          onClick={() => onSelect(pkg)}
          className={`
            relative p-5 rounded-xl border-2 cursor-pointer transition-all
            ${selectedId === pkg.id
              ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          {/* Badge populaire */}
          {pkg.is_popular && (
            <div className="absolute -top-3 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
              POPULAIRE
            </div>
          )}

          <div className="flex items-start gap-4">
            {/* Icône */}
            <div className="p-3 rounded-lg bg-gray-100">
              {packageIcons[pkg.slug] || <Coins className="w-6 h-6" />}
            </div>

            {/* Contenu */}
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{pkg.name}</h4>

              {/* Crédits */}
              <div className="mt-1">
                <span className="text-2xl font-bold text-gray-900">
                  {formatCredits(pkg.credits)}
                </span>
                {pkg.bonus_credits > 0 && (
                  <span className="ml-2 text-green-600 font-medium">
                    +{formatCredits(pkg.bonus_credits)} bonus
                  </span>
                )}
              </div>

              {/* Prix */}
              <div className="mt-2 text-lg font-semibold text-gray-700">
                {formatPriceXAF(pkg.price_xaf)}
              </div>

              {/* Description */}
              {pkg.description && (
                <p className="mt-2 text-sm text-gray-500">{pkg.description}</p>
              )}
            </div>

            {/* Radio */}
            <div className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center
              ${selectedId === pkg.id
                ? 'border-green-500 bg-green-500'
                : 'border-gray-300'
              }
            `}>
              {selectedId === pkg.id && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Étape 5.5: Créer `frontend/src/components/credits/TopUpModal.tsx`

```tsx
/**
 * Modal d'achat de crédits avec paiement PVIT
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Phone, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getCreditPackages, initiatePvitPayment, CreditPackage } from '@/lib/credits';
import { formatPriceXAF } from '@/lib/creditManager';
import CreditPackages from './CreditPackages';
import { useAuth } from '@/contexts/AuthContext';

interface TopUpModalProps {
  open: boolean;
  onClose: () => void;
  onPurchased?: (newBalance: number) => void;
}

type Step = 'select' | 'phone' | 'processing' | 'success' | 'error';

export default function TopUpModal({ open, onClose, onPurchased }: TopUpModalProps) {
  const { user } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les packages
  useEffect(() => {
    if (open) {
      getCreditPackages()
        .then(setPackages)
        .catch(err => setError(err.message));
    }
  }, [open]);

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setStep('select');
      setSelectedPackage(null);
      setPhone('');
      setError(null);
    }
  }, [open]);

  // Gérer le paiement
  const handlePayment = async () => {
    if (!selectedPackage || !phone || !user) return;

    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      const result = await initiatePvitPayment({
        userId: user.id,
        packageId: selectedPackage.id,
        phone: phone.replace(/\s/g, ''),
        credits: selectedPackage.credits,
        bonusCredits: selectedPackage.bonus_credits,
        priceXaf: selectedPackage.price_xaf
      });

      if (result.success) {
        setStep('success');
        // Le callback PVIT mettra à jour les crédits automatiquement
        setTimeout(() => {
          onPurchased?.(selectedPackage.credits + selectedPackage.bonus_credits);
          onClose();
        }, 3000);
      } else {
        throw new Error(result.error || 'Erreur lors du paiement');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'select' && 'Choisir un pack de crédits'}
            {step === 'phone' && 'Numéro de téléphone'}
            {step === 'processing' && 'Paiement en cours...'}
            {step === 'success' && 'Paiement réussi !'}
            {step === 'error' && 'Erreur de paiement'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Étape 1: Sélection du package */}
          {step === 'select' && (
            <CreditPackages
              packages={packages}
              selectedId={selectedPackage?.id || null}
              onSelect={setSelectedPackage}
            />
          )}

          {/* Étape 2: Numéro de téléphone */}
          {step === 'phone' && selectedPackage && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Pack sélectionné</div>
                <div className="font-semibold text-gray-900">
                  {selectedPackage.name} - {selectedPackage.credits} crédits
                </div>
                <div className="text-green-600 font-semibold">
                  {formatPriceXAF(selectedPackage.price_xaf)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Numéro Mobile Money
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Ex: 074 00 00 00"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Vous recevrez une demande de paiement sur ce numéro
                </p>
              </div>
            </div>
          )}

          {/* Étape 3: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-4" />
              <p className="text-gray-600 text-center">
                Vérifiez votre téléphone et validez le paiement...
              </p>
            </div>
          )}

          {/* Étape 4: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Paiement réussi !
              </h3>
              <p className="text-gray-600 text-center">
                Vos crédits ont été ajoutés à votre compte.
              </p>
            </div>
          )}

          {/* Étape 5: Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Erreur de paiement
              </h3>
              <p className="text-red-600 text-center mb-4">{error}</p>
              <button
                onClick={() => setStep('phone')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'select' || step === 'phone') && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            {step === 'phone' && (
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Retour
              </button>
            )}
            {step === 'select' && <div />}

            <button
              onClick={() => {
                if (step === 'select' && selectedPackage) {
                  setStep('phone');
                } else if (step === 'phone' && phone.length >= 9) {
                  handlePayment();
                }
              }}
              disabled={
                (step === 'select' && !selectedPackage) ||
                (step === 'phone' && phone.length < 9) ||
                loading
              }
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {step === 'select' ? 'Continuer' : 'Payer maintenant'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Étape 5.6: Créer la page crédits `frontend/src/app/credits/page.tsx`

```tsx
/**
 * Page de gestion des crédits
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreditManager } from '@/lib/creditManager';
import { getCreditHistory, CreditTransaction } from '@/lib/credits';
import CreditBalance from '@/components/credits/CreditBalance';
import { ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react';

export default function CreditsPage() {
  const { user } = useAuth();
  const { balance, bonusBalance, loading, refresh } = useCreditManager(user?.id || null);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Charger l'historique
  useEffect(() => {
    if (user?.id) {
      setHistoryLoading(true);
      getCreditHistory(user.id, 20)
        .then(setHistory)
        .finally(() => setHistoryLoading(false));
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Connectez-vous pour voir vos crédits</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Mes Crédits</h1>

      {/* Solde */}
      <CreditBalance
        balance={balance}
        bonusBalance={bonusBalance}
        loading={loading}
        onRefresh={refresh}
      />

      {/* Historique */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Historique des transactions
          </h3>
        </div>

        <div className="divide-y">
          {historyLoading ? (
            <div className="p-6 text-center text-gray-500">Chargement...</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Aucune transaction pour le moment
            </div>
          ) : (
            history.map(tx => (
              <div key={tx.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {tx.amount > 0 ? (
                    <ArrowUpCircle className="w-8 h-8 text-green-500" />
                  ) : (
                    <ArrowDownCircle className="w-8 h-8 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">
                      {tx.description}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                <div className={`text-lg font-semibold ${
                  tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 8. Phase 6: Tests et Déploiement

### Étape 6.1: Tests manuels

#### Test 1: Vérifier la connexion Supabase
```bash
# Dans le SQL Editor Supabase
SELECT * FROM credit_packages;
SELECT * FROM pvit_current_key;
```

#### Test 2: Tester l'endpoint packages
```bash
curl http://localhost:3001/api/credits-premium/packages
```

#### Test 3: Tester l'initiation de paiement
```bash
curl -X POST http://localhost:3001/api/pvit_payment.php \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "phone": "074000000",
    "reference": "TEST_123",
    "description": "Test paiement"
  }'
```

#### Test 4: Simuler un callback PVIT
```bash
curl -X POST http://localhost:3001/api/pvit_callback.php \
  -H "Content-Type: application/json" \
  -d '{
    "merchantReference": "TEST_123",
    "operationStatus": "SUCCESS",
    "amount": 5000
  }'
```

### Étape 6.2: Checklist pré-déploiement

- [ ] Variables d'environnement configurées
- [ ] Tables SQL créées et seed effectué
- [ ] Clé PVIT initiale insérée
- [ ] URLs de callback configurées dans PVIT
- [ ] Tests manuels passés
- [ ] CORS configuré pour le domaine production
- [ ] HTTPS activé sur tous les endpoints

### Étape 6.3: Déploiement

```bash
# Frontend (Netlify)
cd frontend
npm run build
# Déployer via Netlify CLI ou Git push

# Backend Node.js (Railway)
cd backend
# Railway déploie automatiquement depuis Git

# Backend PHP (Serveur)
# Copier les fichiers dans /var/www/html/api/
scp backend/api/*.php user@server:/var/www/html/api/
scp backend/lib/*.php user@server:/var/www/html/lib/
```

### Étape 6.4: Monitoring post-déploiement

Vérifier régulièrement:
1. Logs des callbacks PVIT: `SELECT * FROM pvit_callback_logs ORDER BY created_at DESC LIMIT 20;`
2. Paiements en attente: `SELECT * FROM pvit_payments WHERE status = 'pending' AND created_at > NOW() - INTERVAL '1 hour';`
3. Clés PVIT: `SELECT * FROM pvit_current_key WHERE is_valid = true;`

---

## 9. Troubleshooting

### Problème: Clé PVIT expirée

**Symptôme:** Erreur "Clé secrète invalide" lors des paiements

**Solution:**
1. Vérifier la table `pvit_current_key`
2. Si expirée, déclencher le renouvellement manuellement:
```php
$pvitClient = new PvitApiClient($supabase);
$result = $pvitClient->regeneratePvitKey();
var_dump($result);
```

### Problème: Callback non reçu

**Symptôme:** Paiement validé sur mobile mais crédits non ajoutés

**Vérifications:**
1. URL de callback accessible publiquement
2. Pas de blocage firewall sur POST
3. Vérifier les logs: `SELECT * FROM pvit_callback_logs;`

**Solution temporaire:**
```sql
-- Ajouter les crédits manuellement
SELECT add_credits(
  'USER_UUID',
  300, -- crédits
  50,  -- bonus
  NULL, -- package_id
  12000, -- prix payé
  'admin',
  'MANUAL_FIX_123'
);
```

### Problème: Erreur CORS

**Symptôme:** Requêtes bloquées depuis le frontend

**Solution:** Ajouter les headers dans les fichiers PHP:
```php
header('Access-Control-Allow-Origin: https://votre-domaine.com');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
```

---

## 10. Annexes

### A. Endpoints PVIT

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/YH6BCNXXAAQVNXYT/link` | POST | Paiement RESTLINK (recommandé) |
| `/FP86L0YEUPA3LWDR/rest` | POST | Paiement REST classique |
| `/9CYO5IQF289XH253/status` | POST | Vérifier statut transaction |
| `/XGEQSGFKR7S7K3P9/balance` | POST | Consulter solde marchand |
| `/BYQ5LLFX2X0BA0HB/renew-secret` | POST | Régénérer clé secrète |

### B. Codes de statut PVIT

| Code | Signification |
|------|---------------|
| SUCCESS | Paiement réussi |
| FAILED | Paiement échoué |
| PENDING | En attente de validation |
| CANCELLED | Annulé par l'utilisateur |

### C. Structure des tables récapitulative

```
pvit_current_key       → Stockage clés API PVIT
pvit_payments          → Transactions de paiement
pvit_callback_logs     → Logs des callbacks (audit)
credit_packages        → Packages disponibles
user_credits           → Soldes par utilisateur
credit_transactions    → Historique des mouvements
credit_costs           → Coûts des services
```

### D. Contacts Support

- **PVIT Support:** support@mypvit.pro
- **Documentation PVIT:** https://docs.mypvit.pro

---

## Conclusion

Ce guide vous permet d'intégrer de bout en bout le système de paiement PVIT avec gestion des crédits premium. Suivez les phases dans l'ordre et testez chaque étape avant de passer à la suivante.

**Temps estimé d'intégration complète:** 5-7 jours de développement

**Points critiques à surveiller:**
1. Renouvellement automatique des clés PVIT
2. Traitement correct des callbacks
3. Intégrité des transactions de crédits
