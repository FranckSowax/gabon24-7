-- ============================================
-- NETTOYAGE ET RECRÉATION DU SYSTÈME DE CRÉDITS
-- ============================================
-- ATTENTION: Ce script supprime toutes les données existantes !
-- À utiliser uniquement en développement ou pour une installation propre
-- ============================================

-- Supprimer les tables dans le bon ordre (à cause des foreign keys)
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS credit_promotions CASCADE;
DROP TABLE IF EXISTS credit_costs CASCADE;
DROP TABLE IF EXISTS user_credits CASCADE;
DROP TABLE IF EXISTS credit_packages CASCADE;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS consume_credits CASCADE;
DROP FUNCTION IF EXISTS add_credits CASCADE;
DROP FUNCTION IF EXISTS refund_credits CASCADE;
DROP FUNCTION IF EXISTS initialize_user_credits CASCADE;
DROP FUNCTION IF EXISTS get_total_credit_balance CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Maintenant, exécuter le script complet create_credit_system_premium.sql
-- (Copier-coller le contenu du fichier create_credit_system_premium.sql après cette ligne)
