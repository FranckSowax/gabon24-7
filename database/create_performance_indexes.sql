-- =====================================================
-- 🚀 INDEX DE PERFORMANCE POUR SYSTÈME VEILLE & ALERTES
-- Date: 2025-12-11
-- Objectif: Améliorer les performances de matching des alertes
-- =====================================================

-- Index pour améliorer performances matching articles
-- Filtre par catégorie IA et date de création
CREATE INDEX IF NOT EXISTS idx_articles_category_created 
ON articles(ai_category, created_at DESC) 
WHERE is_published = true;

-- Index pour articles breaking news
CREATE INDEX IF NOT EXISTS idx_articles_breaking 
ON articles(ai_is_breaking) 
WHERE ai_is_breaking = true AND is_published = true;

-- Index pour articles par importance IA
CREATE INDEX IF NOT EXISTS idx_articles_importance 
ON articles(ai_importance DESC) 
WHERE is_published = true AND ai_importance IS NOT NULL;

-- Index pour matches d'alertes par utilisateur et date
CREATE INDEX IF NOT EXISTS idx_alert_matches_user_created 
ON alert_matches(user_id, created_at DESC);

-- Index pour matches par alerte
CREATE INDEX IF NOT EXISTS idx_alert_matches_alert_id 
ON alert_matches(alert_id, created_at DESC);

-- Index pour alertes actives par utilisateur
CREATE INDEX IF NOT EXISTS idx_user_alerts_active 
ON user_alerts(user_id, is_active) 
WHERE is_active = true;

-- Index full-text search pour titre + résumé (français)
-- Permet des recherches textuelles rapides
CREATE INDEX IF NOT EXISTS idx_articles_text_search 
ON articles USING gin(to_tsvector('french', COALESCE(title, '') || ' ' || COALESCE(summary, '')));

-- Index pour recherche par source
CREATE INDEX IF NOT EXISTS idx_articles_source 
ON articles(source) 
WHERE is_published = true;

-- Index pour articles récents (dernières 24h)
CREATE INDEX IF NOT EXISTS idx_articles_recent 
ON articles(created_at DESC) 
WHERE is_published = true;

-- Index composite pour homepage (catégorie + date + publié)
CREATE INDEX IF NOT EXISTS idx_articles_homepage 
ON articles(ai_category, published_at DESC, is_published) 
WHERE is_published = true;

-- Index pour notifications WhatsApp
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_user 
ON whatsapp_notifications(user_id, created_at DESC);

-- =====================================================
-- ANALYSE DES TABLES APRÈS CRÉATION DES INDEX
-- =====================================================
ANALYZE articles;
ANALYZE alert_matches;
ANALYZE user_alerts;
