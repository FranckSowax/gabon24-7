-- =============================================
-- MIGRATION GABONNEWS - Script de mise à jour sécurisé
-- Vérifie l'existence des tables avant création
-- =============================================

-- Extension pour UUID (si pas déjà installée)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- TABLE: rss_feeds - Sources RSS des médias gabonais
-- =============================================
CREATE TABLE IF NOT EXISTS rss_feeds (
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
    is_premium BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour rss_feeds (seulement si pas déjà existants)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rss_feeds_status') THEN
        CREATE INDEX idx_rss_feeds_status ON rss_feeds(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rss_feeds_category') THEN
        CREATE INDEX idx_rss_feeds_category ON rss_feeds(category);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rss_feeds_priority') THEN
        CREATE INDEX idx_rss_feeds_priority ON rss_feeds(priority DESC);
    END IF;
END $$;

-- =============================================
-- TABLE: articles - Articles récupérés depuis les flux RSS
-- =============================================
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    title TEXT NOT NULL,
    summary TEXT,
    ai_summary TEXT,
    content TEXT,
    url TEXT NOT NULL,
    author VARCHAR(255),
    published_at TIMESTAMPTZ,
    language VARCHAR(10) DEFAULT 'fr',
    category VARCHAR(100),
    keywords TEXT[],
    sentiment VARCHAR(20) CHECK (sentiment IN ('positif', 'négatif', 'neutre')),
    sentiment_confidence DECIMAL(3,2),
    read_time_minutes INTEGER,
    image_urls TEXT[],
    is_trending BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    whatsapp_share_count INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(feed_id, external_id)
);

-- Index pour articles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articles_feed_id') THEN
        CREATE INDEX idx_articles_feed_id ON articles(feed_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articles_published_at') THEN
        CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articles_category') THEN
        CREATE INDEX idx_articles_category ON articles(category);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articles_sentiment') THEN
        CREATE INDEX idx_articles_sentiment ON articles(sentiment);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articles_keywords') THEN
        CREATE INDEX idx_articles_keywords ON articles USING GIN(keywords);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_articles_search') THEN
        CREATE INDEX idx_articles_search ON articles USING GIN(to_tsvector('french', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(ai_summary, '')));
    END IF;
END $$;

-- =============================================
-- TABLE: whatsapp_messages - Messages WhatsApp envoyés
-- =============================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('article', 'summary', 'notification', 'subscription', 'welcome', 'digest')),
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    whapi_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour whatsapp_messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_user_id') THEN
        CREATE INDEX idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_status') THEN
        CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_created_at') THEN
        CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
    END IF;
END $$;

-- =============================================
-- TABLE: subscriptions - Historique des abonnements
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('free', 'premium', 'journalist')),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'XAF',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour subscriptions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_user_id') THEN
        CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_status') THEN
        CREATE INDEX idx_subscriptions_status ON subscriptions(status);
    END IF;
END $$;

-- =============================================
-- TABLE: user_interactions - Interactions utilisateurs
-- =============================================
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('view', 'share', 'save', 'like', 'comment', 'whatsapp_share')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour user_interactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_user_id') THEN
        CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_article_id') THEN
        CREATE INDEX idx_user_interactions_article_id ON user_interactions(article_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_type') THEN
        CREATE INDEX idx_user_interactions_type ON user_interactions(interaction_type);
    END IF;
END $$;

-- =============================================
-- TABLE: admin_users - Utilisateurs administrateurs
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor', 'moderator')),
    permissions TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour admin_users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_admin_users_email') THEN
        CREATE INDEX idx_admin_users_email ON admin_users(email);
    END IF;
END $$;

-- =============================================
-- TABLE: system_logs - Logs système
-- =============================================
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour system_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_system_logs_level') THEN
        CREATE INDEX idx_system_logs_level ON system_logs(level);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_system_logs_component') THEN
        CREATE INDEX idx_system_logs_component ON system_logs(component);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_system_logs_created_at') THEN
        CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);
    END IF;
END $$;

-- =============================================
-- TABLE: analytics - Données analytiques
-- =============================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_value INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date, metric_type)
);

-- Index pour analytics
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_date') THEN
        CREATE INDEX idx_analytics_date ON analytics(date DESC);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_metric_type') THEN
        CREATE INDEX idx_analytics_metric_type ON analytics(metric_type);
    END IF;
END $$;

-- =============================================
-- TABLE: notifications - Notifications système
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour notifications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_id') THEN
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_unread') THEN
        CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
    END IF;
END $$;

-- =============================================
-- AJOUTER COLONNES MANQUANTES À LA TABLE USERS EXISTANTE
-- =============================================

-- Ajouter les colonnes spécifiques à GabonNews si elles n'existent pas
DO $$
BEGIN
    -- Subscription type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_type') THEN
        ALTER TABLE auth.users ADD COLUMN subscription_type VARCHAR(20) DEFAULT 'free' CHECK (subscription_type IN ('free', 'premium', 'journalist'));
    END IF;
    
    -- Subscription status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_status') THEN
        ALTER TABLE auth.users ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'suspended', 'cancelled'));
    END IF;
    
    -- WhatsApp number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE auth.users ADD COLUMN whatsapp_number VARCHAR(20);
    END IF;
    
    -- Keywords
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'keywords') THEN
        ALTER TABLE auth.users ADD COLUMN keywords TEXT[];
    END IF;
    
    -- Categories
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'categories') THEN
        ALTER TABLE auth.users ADD COLUMN categories TEXT[];
    END IF;
    
    -- Notification preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notification_preferences') THEN
        ALTER TABLE auth.users ADD COLUMN notification_preferences JSONB DEFAULT '{"whatsapp": true, "email": false, "sms": false}';
    END IF;
    
    -- Preferred language
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferred_language') THEN
        ALTER TABLE auth.users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'fr';
    END IF;
END $$;

-- =============================================
-- FONCTIONS ET TRIGGERS
-- =============================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at (seulement si pas déjà existants)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rss_feeds_updated_at') THEN
        CREATE TRIGGER update_rss_feeds_updated_at BEFORE UPDATE ON rss_feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_articles_updated_at') THEN
        CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at') THEN
        CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_users_updated_at') THEN
        CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =============================================
-- VUES UTILES
-- =============================================

-- Vue pour les statistiques des articles
CREATE OR REPLACE VIEW daily_article_stats AS
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

-- Vue pour les flux RSS actifs
CREATE OR REPLACE VIEW active_feeds_stats AS
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

-- =============================================
-- DONNÉES INITIALES
-- =============================================

-- Insérer un utilisateur admin par défaut (seulement s'il n'existe pas)
INSERT INTO admin_users (email, full_name, role, permissions) 
SELECT 'admin@gabonnews.com', 'Administrateur GabonNews', 'super_admin', ARRAY['all']
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'admin@gabonnews.com');

-- Insérer les flux RSS des médias gabonais (seulement s'ils n'existent pas)
INSERT INTO rss_feeds (name, url, category, description, priority) 
SELECT * FROM (VALUES 
    ('L''Union', 'https://www.lunion.ga/rss', 'Actualités', 'Journal officiel du Gabon', 1),
    ('Gabon Review', 'https://www.gabonreview.com/rss', 'Économie', 'Actualités économiques et politiques du Gabon', 1),
    ('Info241', 'https://www.info241.com/feed', 'Actualités', 'Premier portail d''information du Gabon', 1),
    ('Gabon Eco', 'https://www.gaboneco.com/rss', 'Économie', 'Actualités économiques du Gabon', 2),
    ('Gabon Matin', 'https://www.gabonmatin.com/rss', 'Actualités', 'Quotidien d''information gabonais', 2)
) AS new_feeds(name, url, category, description, priority)
WHERE NOT EXISTS (SELECT 1 FROM rss_feeds WHERE rss_feeds.url = new_feeds.url);

-- Insérer quelques métriques analytiques de base
INSERT INTO analytics (date, metric_type, metric_value) 
SELECT CURRENT_DATE, metric_type, 0
FROM (VALUES 
    ('daily_users'),
    ('articles_published'),
    ('messages_sent'),
    ('subscriptions_created')
) AS metrics(metric_type)
WHERE NOT EXISTS (SELECT 1 FROM analytics WHERE date = CURRENT_DATE AND analytics.metric_type = metrics.metric_type);

-- =============================================
-- POLITIQUES RLS (Row Level Security)
-- =============================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Politiques pour les articles (publics en lecture)
DROP POLICY IF EXISTS "Articles are publicly readable" ON articles;
CREATE POLICY "Articles are publicly readable" ON articles FOR SELECT USING (
    is_published = true AND 
    (is_premium = false OR auth.uid() IS NOT NULL)
);

-- Politiques pour les abonnements (utilisateurs voient leurs propres données)
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Politiques pour les interactions
DROP POLICY IF EXISTS "Users can view own interactions" ON user_interactions;
CREATE POLICY "Users can view own interactions" ON user_interactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own interactions" ON user_interactions;
CREATE POLICY "Users can create own interactions" ON user_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques pour les messages WhatsApp
DROP POLICY IF EXISTS "Users can view own messages" ON whatsapp_messages;
CREATE POLICY "Users can view own messages" ON whatsapp_messages FOR SELECT USING (auth.uid() = user_id);

-- Politiques pour les notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- COMMENTAIRES
-- =============================================

COMMENT ON TABLE rss_feeds IS 'Sources RSS des médias gabonais pour récupération automatique d''articles';
COMMENT ON TABLE articles IS 'Articles récupérés depuis les flux RSS avec enrichissement IA (résumés, sentiment, mots-clés)';
COMMENT ON TABLE whatsapp_messages IS 'Messages WhatsApp envoyés aux utilisateurs via Whapi API';
COMMENT ON TABLE subscriptions IS 'Historique des abonnements et paiements mobile money';
COMMENT ON TABLE user_interactions IS 'Interactions des utilisateurs avec les articles (vues, partages, likes)';
COMMENT ON TABLE admin_users IS 'Utilisateurs administrateurs avec permissions granulaires';
COMMENT ON TABLE system_logs IS 'Logs système pour monitoring et debugging';
COMMENT ON TABLE analytics IS 'Métriques quotidiennes pour analytics et reporting';
COMMENT ON TABLE notifications IS 'Notifications système pour les utilisateurs';

-- =============================================
-- FIN DE LA MIGRATION
-- =============================================

SELECT 'Migration GabonNews terminée avec succès!' as status;
