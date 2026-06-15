-- ============================================================
-- 20260603_m1_security_rls_hardening.sql
-- Jalon 1 — Durcissement sécurité Supabase (M1-1bis + M1-1ter)
-- Appliqué via MCP le 2026-06-03. Ce fichier est la trace versionnée.
-- ============================================================
-- Contexte : l'advisor Supabase remontait 53 tables public sans RLS,
-- une vue exposant auth.users (student_dashboard), 4 vues SECURITY DEFINER,
-- et des RPC financiers exécutables par anon/authenticated.
--
-- Garantie : le backend utilise la clé service_role qui BYPASS la RLS.
-- Seuls les accès directs via anon key sont impactés (aucun pour ces tables,
-- audité par grep le 2026-06-03).
-- ============================================================

-- ---------- M1-1bis-A : RLS sur 4 tables qui avaient déjà des policies ----------
ALTER TABLE public.audio_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_usage_stats    ENABLE ROW LEVEL SECURITY;

-- ---------- M1-1bis-B : vue student_dashboard (fuite auth.users.email) ----------
-- REVOKE plutôt que DROP (réversible). DROP définitif prévu au Jalon 3.
REVOKE ALL ON public.student_dashboard FROM anon, authenticated;

-- ---------- M1-1bis-C : vues SECURITY INVOKER (au lieu de DEFINER) ----------
ALTER VIEW public.subscription_revenue   SET (security_invoker = true);
ALTER VIEW public.user_stats             SET (security_invoker = true);
ALTER VIEW public.active_feeds_stats     SET (security_invoker = true);
ALTER VIEW public.project_full_timeline  SET (security_invoker = true);

-- ---------- M1-1bis-D : REVOKE EXECUTE sur RPC financiers/PII ----------
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, integer, uuid, integer, text, text, text)   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_user_credits(uuid, integer, text, text)                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, text, text, jsonb)                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, text)                             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_user_credits(uuid, integer, text, text)                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid, integer, text, text)                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_user_credits(uuid, integer)                                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_subscription_credits(uuid, text)                                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_pvit_callback(text, text, text, jsonb)                         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_payments(uuid, integer, integer)                              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text)                                                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_credit_balance(uuid)                                          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_total_credit_balance(uuid)                                         FROM anon, authenticated;

-- ---------- M1-1ter-A : RLS (sans policy) sur 46 tables backend-only ----------
ALTER TABLE public.actu_plus_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_processing_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles_backup            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bceg_sponsorship_grants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bceg_sponsorships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_broadcasts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_articles_gbi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editorials                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_cache           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factual_data_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscriptions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclasses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_usage_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_ai_summaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_info_cache      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_article_views          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_feed_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_feeds_backup_20260512  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_consumption        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_bookings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_auth_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_answers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticker_config              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_article_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_filters               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sector_matches_sent   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_channels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notifications     ENABLE ROW LEVEL SECURITY;

-- ---------- M1-1ter-B : RLS + policies pour les 4 tables frontend-facing ----------
ALTER TABLE public.ticker_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticker_messages_public_read ON public.ticker_messages
  FOR SELECT TO anon, authenticated USING (true);
-- NB : l'increment client de click_count n'a pas de policy (dégrade en silence).
--      À migrer vers un RPC increment_ticker_click SECURITY DEFINER (backlog).

ALTER TABLE public.ticker_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ticker_logs_public_insert ON public.ticker_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE public.feed_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY feed_banners_public_read ON public.feed_banners
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY feed_banners_admin_write ON public.feed_banners
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true));

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notifications_admin_all ON public.admin_notifications
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true));
