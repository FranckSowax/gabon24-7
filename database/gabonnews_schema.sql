-- =============================================
-- SCHEMA GABONNEWS - Base de données complète
-- Projet: GabonNews SaaS Platform
-- Description: Plateforme d'agrégation d'actualités gabonaises avec distribution WhatsApp
-- =============================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension pour les fonctions de texte et recherche
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- TABLE: users - Gestion des utilisateurs
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    subscription_type VARCHAR(20) DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium', 'journalist')),
    subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'suspended', 'cancelled')),
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    whatsapp_number VARCHAR(20),
    preferred_language VARCHAR(10) DEFAULT 'fr',
    keywords TEXT[], -- Mots-clés d'intérêt de l'utilisateur
    categories TEXT[], -- Catégories préférées
    notification_preferences JSONB DEFAULT '{"whatsapp": true, "email": false, "sms": false}',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les recherches utilisateurs
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription ON users(subscription_type, subscription_status);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_whatsapp ON users(whatsapp_number);

-- =============================================
-- TABLE: rss_feeds - Sources RSS des médias gabonais
-- =============================================
CREATE TABLE rss_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    language VARCHAR(10) DEFAULT 'fr',
    country VARCHAR(10) DEFAULT 'GA',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'testing')),
    last_fetch_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    fetch_interval_minutes INTEGER DEFAULT 30,
    total_articles_count INTEGER DEFAULT 0,
    is_premium BOOLEAN DEFAULT false, -- Flux premium pour abonnés payants
    priority INTEGER DEFAULT 1, -- Priorité de traitement (1 = haute, 5 = basse)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes RSS
CREATE INDEX idx_rss_feeds_status ON rss_feeds(status);
CREATE INDEX idx_rss_feeds_category ON rss_feeds(category);
CREATE INDEX idx_rss_feeds_priority ON rss_feeds(priority DESC);
CREATE INDEX idx_rss_feeds_fetch_schedule ON rss_feeds(last_fetch_at, fetch_interval_minutes);

-- =============================================
-- TABLE: articles - Articles récupérés depuis les flux RSS
-- =============================================
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- ID externe du flux RSS pour éviter doublons
    title TEXT NOT NULL,
    summary TEXT, -- Résumé original de l'article
    ai_summary TEXT, -- Résumé généré par OpenAI ChatGPT
    content TEXT, -- Contenu complet de l'article
    url TEXT NOT NULL,
    author VARCHAR(255),
    published_at TIMESTAMPTZ,
    language VARCHAR(10) DEFAULT 'fr',
    category VARCHAR(100),
    keywords TEXT[], -- Mots-clés extraits par IA
    sentiment VARCHAR(20) CHECK (sentiment IN ('positif', 'négatif', 'neutre')),
    sentiment_confidence DECIMAL(3,2), -- Confiance de l'analyse sentiment (0.00-1.00)
    read_time_minutes INTEGER,
    image_urls TEXT[], -- URLs des images de l'article
    is_trending BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    whatsapp_share_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false, -- Article premium pour abonnés
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte d'unicité pour éviter les doublons d'articles
    UNIQUE(feed_id, external_id)
);

-- Index pour optimiser les recherches d'articles
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_sentiment ON articles(sentiment);
CREATE INDEX idx_articles_trending ON articles(is_trending) WHERE is_trending = true;
CREATE INDEX idx_articles_keywords ON articles USING GIN(keywords);
CREATE INDEX idx_articles_search ON articles USING GIN(to_tsvector('french', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(ai_summary, '')));

-- =============================================
-- TABLE: whatsapp_messages - Messages WhatsApp envoyés
-- =============================================
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('article', 'summary', 'notification', 'subscription', 'welcome', 'digest')),
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    whapi_message_id VARCHAR(255), -- ID du message dans Whapi
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes WhatsApp
CREATE INDEX idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);

-- =============================================
-- TABLE: subscriptions - Historique des abonnements et paiements
-- =============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('free', 'premium', 'journalist')),
    amount DECIMAL(10,2), -- Montant en XAF
    currency VARCHAR(3) DEFAULT 'XAF',
    payment_method VARCHAR(50), -- 'airtel_money', 'moov_money', 'orange_money'
    payment_reference VARCHAR(255), -- Référence de transaction mobile money
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes d'abonnement
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_dates ON subscriptions(start_date, end_date);
CREATE INDEX idx_subscriptions_payment_ref ON subscriptions(payment_reference);

-- =============================================
-- TABLE: user_interactions - Interactions utilisateurs avec les articles
-- =============================================
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('view', 'share', 'save', 'like', 'comment', 'whatsapp_share')),
    metadata JSONB, -- Données supplémentaires (plateforme de partage, durée de lecture, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes d'interaction
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_article_id ON user_interactions(article_id);
CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_created_at ON user_interactions(created_at DESC);

-- =============================================
-- TABLE: admin_users - Utilisateurs administrateurs
-- =============================================
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor', 'moderator')),
    permissions TEXT[], -- Permissions spécifiques ['rss_manage', 'user_manage', 'analytics_view', etc.]
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes admin
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_role ON admin_users(role);

-- =============================================
-- TABLE: system_logs - Logs système pour monitoring
-- =============================================
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
    component VARCHAR(100) NOT NULL, -- 'rss_parser', 'whatsapp_service', 'payment_service', 'openai_service', etc.
    message TEXT NOT NULL,
    metadata JSONB, -- Données supplémentaires (stack trace, IDs, etc.)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes de logs
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_component ON system_logs(component);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);

-- =============================================
-- TABLE: analytics - Données analytiques quotidiennes
-- =============================================
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'daily_users', 'articles_published', 'messages_sent', 'subscriptions_created', etc.
    metric_value INTEGER NOT NULL,
    metadata JSONB, -- Détails supplémentaires par catégorie, source, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date, metric_type)
);

-- Index pour optimiser les requêtes analytiques
CREATE INDEX idx_analytics_date ON analytics(date DESC);
CREATE INDEX idx_analytics_metric_type ON analytics(metric_type);

-- =============================================
-- TABLE: notifications - Notifications système pour utilisateurs
-- =============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT false,
    metadata JSONB, -- Liens, actions, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes de notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- =============================================
-- TABLE: whatsapp_channels - Canaux WhatsApp (gratuit et premium)
-- =============================================
CREATE TABLE whatsapp_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) UNIQUE NOT NULL, -- ID du canal WhatsApp
    description TEXT,
    is_premium BOOLEAN DEFAULT false,
    subscriber_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les requêtes de canaux
CREATE INDEX idx_whatsapp_channels_active ON whatsapp_channels(is_active);
CREATE INDEX idx_whatsapp_channels_premium ON whatsapp_channels(is_premium);

-- =============================================
-- TABLE: user_preferences - Préférences détaillées des utilisateurs
-- =============================================
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    preference_type VARCHAR(50) NOT NULL, -- 'notification_time', 'digest_frequency', 'content_filter', etc.
    preference_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, preference_type)
);

-- Index pour optimiser les requêtes de préférences
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_type ON user_preferences(preference_type);

-- =============================================
-- FONCTIONS ET TRIGGERS
-- =============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at sur toutes les tables concernées
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rss_feeds_updated_at BEFORE UPDATE ON rss_feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_channels_updated_at BEFORE UPDATE ON whatsapp_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour mettre à jour les compteurs d'articles dans rss_feeds
CREATE OR REPLACE FUNCTION update_feed_article_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE rss_feeds 
        SET total_articles_count = total_articles_count + 1 
        WHERE id = NEW.feed_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE rss_feeds 
        SET total_articles_count = total_articles_count - 1 
        WHERE id = OLD.feed_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour automatiquement le compteur d'articles
CREATE TRIGGER update_feed_article_count_trigger
    AFTER INSERT OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_feed_article_count();

-- Fonction pour mettre à jour les compteurs de vues/partages
CREATE OR REPLACE FUNCTION update_article_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.interaction_type = 'view' THEN
        UPDATE articles 
        SET view_count = view_count + 1 
        WHERE id = NEW.article_id;
    ELSIF NEW.interaction_type = 'share' OR NEW.interaction_type = 'whatsapp_share' THEN
        UPDATE articles 
        SET share_count = share_count + 1 
        WHERE id = NEW.article_id;
        
        IF NEW.interaction_type = 'whatsapp_share' THEN
            UPDATE articles 
            SET whatsapp_share_count = whatsapp_share_count + 1 
            WHERE id = NEW.article_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour les compteurs d'interaction
CREATE TRIGGER update_article_counters_trigger
    AFTER INSERT ON user_interactions
    FOR EACH ROW EXECUTE FUNCTION update_article_counters();

-- =============================================
-- VUES UTILES POUR ANALYTICS ET REPORTING
-- =============================================

-- Vue pour les statistiques des utilisateurs
CREATE VIEW user_stats AS
SELECT 
    subscription_type,
    subscription_status,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '30 days') as active_users_30d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d
FROM users 
GROUP BY subscription_type, subscription_status;

-- Vue pour les statistiques des articles par jour
CREATE VIEW daily_article_stats AS
SELECT 
    DATE(created_at) as date,
    category,
    sentiment,
    COUNT(*) as article_count,
    AVG(view_count) as avg_views,
    AVG(share_count) as avg_shares,
    AVG(whatsapp_share_count) as avg_whatsapp_shares
FROM articles 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), category, sentiment
ORDER BY date DESC;

-- Vue pour les flux RSS actifs avec statistiques
CREATE VIEW active_feeds_stats AS
SELECT 
    rf.*,
    COUNT(a.id) as articles_count,
    MAX(a.created_at) as last_article_at,
    AVG(a.view_count) as avg_article_views,
    COUNT(a.id) FILTER (WHERE a.created_at > NOW() - INTERVAL '24 hours') as articles_24h
FROM rss_feeds rf
LEFT JOIN articles a ON rf.id = a.feed_id
WHERE rf.status = 'active'
GROUP BY rf.id
ORDER BY rf.priority, rf.name;

-- Vue pour les top articles par engagement
CREATE VIEW top_articles AS
SELECT 
    a.*,
    rf.name as feed_name,
    (a.view_count * 1 + a.share_count * 3 + a.whatsapp_share_count * 5) as engagement_score
FROM articles a
JOIN rss_feeds rf ON a.feed_id = rf.id
WHERE a.created_at > NOW() - INTERVAL '7 days'
ORDER BY engagement_score DESC
LIMIT 50;

-- Vue pour les revenus par abonnement
CREATE VIEW subscription_revenue AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    plan_type,
    COUNT(*) as subscription_count,
    SUM(amount) as total_revenue,
    AVG(amount) as avg_revenue
FROM subscriptions 
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', created_at), plan_type
ORDER BY month DESC;

-- =============================================
-- POLITIQUES RLS (Row Level Security)
-- =============================================

-- Activer RLS sur les tables sensibles
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs ne voient que leurs propres données
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can view own interactions" ON user_interactions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can view own messages" ON whatsapp_messages FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage own preferences" ON user_preferences FOR ALL USING (auth.uid()::text = user_id::text);

-- Les articles sont publics en lecture (sauf premium pour non-abonnés)
CREATE POLICY "Articles are publicly readable" ON articles FOR SELECT USING (
    is_published = true AND 
    (is_premium = false OR auth.uid() IS NOT NULL)
);

-- Les flux RSS sont publics en lecture
CREATE POLICY "RSS feeds are publicly readable" ON rss_feeds FOR SELECT USING (true);

-- =============================================
-- DONNÉES INITIALES DE TEST
-- =============================================

-- Insérer un utilisateur admin par défaut
INSERT INTO admin_users (email, full_name, role, permissions) VALUES 
('admin@gabonnews.com', 'Administrateur GabonNews', 'super_admin', ARRAY['all']);

-- Insérer les flux RSS des médias gabonais principaux
INSERT INTO rss_feeds (name, url, category, description, priority) VALUES 
('L''Union', 'https://www.lunion.ga/rss', 'Actualités', 'Journal officiel du Gabon', 1),
('Gabon Review', 'https://www.gabonreview.com/rss', 'Économie', 'Actualités économiques et politiques du Gabon', 1),
('Info241', 'https://www.info241.com/feed', 'Actualités', 'Premier portail d''information du Gabon', 1),
('Gabon Eco', 'https://www.gaboneco.com/rss', 'Économie', 'Actualités économiques du Gabon', 2),
('Gabon Matin', 'https://www.gabonmatin.com/rss', 'Actualités', 'Quotidien d''information gabonais', 2);

-- Insérer un canal WhatsApp gratuit par défaut
INSERT INTO whatsapp_channels (name, channel_id, description, is_premium) VALUES 
('GabonNews Gratuit', 'gabonnews_free', 'Canal gratuit d''actualités gabonaises', false),
('GabonNews Premium', 'gabonnews_premium', 'Canal premium avec analyses approfondies', true);

-- Insérer quelques métriques analytiques de base
INSERT INTO analytics (date, metric_type, metric_value) VALUES 
(CURRENT_DATE, 'daily_users', 0),
(CURRENT_DATE, 'articles_published', 0),
(CURRENT_DATE, 'messages_sent', 0),
(CURRENT_DATE, 'subscriptions_created', 0);

-- =============================================
-- COMMENTAIRES ET DOCUMENTATION
-- =============================================

COMMENT ON SCHEMA public IS 'Schéma principal de GabonNews - Plateforme SaaS d''agrégation d''actualités gabonaises avec distribution WhatsApp';

COMMENT ON TABLE users IS 'Utilisateurs de la plateforme avec gestion des abonnements et préférences';
COMMENT ON TABLE rss_feeds IS 'Sources RSS des médias gabonais pour récupération automatique d''articles';
COMMENT ON TABLE articles IS 'Articles récupérés depuis les flux RSS avec enrichissement IA (résumés, sentiment, mots-clés)';
COMMENT ON TABLE whatsapp_messages IS 'Messages WhatsApp envoyés aux utilisateurs via Whapi API';
COMMENT ON TABLE subscriptions IS 'Historique des abonnements et paiements mobile money';
COMMENT ON TABLE user_interactions IS 'Interactions des utilisateurs avec les articles (vues, partages, likes)';
COMMENT ON TABLE admin_users IS 'Utilisateurs administrateurs avec permissions granulaires';
COMMENT ON TABLE system_logs IS 'Logs système pour monitoring et debugging';
COMMENT ON TABLE analytics IS 'Métriques quotidiennes pour analytics et reporting';
COMMENT ON TABLE notifications IS 'Notifications système pour les utilisateurs';
COMMENT ON TABLE whatsapp_channels IS 'Canaux WhatsApp (gratuit et premium)';
COMMENT ON TABLE user_preferences IS 'Préférences détaillées des utilisateurs';

-- =============================================
-- FIN DU SCHEMA GABONNEWS
-- =============================================
