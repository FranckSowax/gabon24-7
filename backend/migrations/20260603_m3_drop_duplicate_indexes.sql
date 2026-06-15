-- ============================================================
-- 20260603_m3_drop_duplicate_indexes.sql
-- Jalon 3 perf — suppression des index dupliqués (advisor duplicate_index)
-- Appliqué via MCP le 2026-06-03. Trace versionnée.
-- ============================================================
-- Règle : pour chaque paire d'index identiques, on garde celui adossé à une
-- contrainte (*_key / *_pkey) ou un index canonique, et on supprime le doublon.
-- Aucune contrainte touchée. Réversible (index recréables).
-- ============================================================

DROP INDEX IF EXISTS public.idx_admin_users_email;
DROP INDEX IF EXISTS public.article_views_article_id_idx;
DROP INDEX IF EXISTS public.idx_articles_ai_breaking;
DROP INDEX IF EXISTS public.idx_audio_settings_user_id;
DROP INDEX IF EXISTS public.idx_business_banners_feature;
DROP INDEX IF EXISTS public.idx_campaigns_user;
DROP INDEX IF EXISTS public.idx_credit_costs_service;
DROP INDEX IF EXISTS public.idx_credit_packages_slug;
DROP INDEX IF EXISTS public.idx_credit_promotions_code;
DROP INDEX IF EXISTS public.idx_credit_transactions_created;
DROP INDEX IF EXISTS public.idx_ebilling_payments_reference;
DROP INDEX IF EXISTS public.idx_enrichment_cache_hash;
DROP INDEX IF EXISTS public.idx_notifications_unread;
DROP INDEX IF EXISTS public.idx_poll_votes_poll_user;
DROP INDEX IF EXISTS public.idx_pricing_config_feature_key;
DROP INDEX IF EXISTS public.idx_products_name;
DROP INDEX IF EXISTS public.idx_psl_token;
DROP INDEX IF EXISTS public.idx_rss_article_views_article_id;
DROP INDEX IF EXISTS public.idx_rss_article_views_last_viewed;
DROP INDEX IF EXISTS public.rss_article_views_last_viewed_at_idx;
DROP INDEX IF EXISTS public.idx_session_bookings_inscription;
DROP INDEX IF EXISTS public.idx_slide_analytics_date;
DROP INDEX IF EXISTS public.idx_slide_analytics_slide;
DROP INDEX IF EXISTS public.idx_student_auth_tokens_token;
DROP INDEX IF EXISTS public.idx_training_progress_training;
DROP INDEX IF EXISTS public.idx_training_progress_user;
DROP INDEX IF EXISTS public.idx_user_article_reads_user_article;
DROP INDEX IF EXISTS public.idx_user_credits_user_id;
DROP INDEX IF EXISTS public.idx_user_favorites_user_article;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_users_phone;
DROP INDEX IF EXISTS public.idx_youtube_cache_video_id;

-- Follow-up rss_article_views : 2e index unique autonome redondant
-- (la contrainte rss_article_views_article_id_key est conservée).
DROP INDEX IF EXISTS public.rss_article_views_article_id_uniq;
