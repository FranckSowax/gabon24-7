-- =====================================================================
-- MIGRATION : Remplacer les URLs rss.app par les flux RSS natifs
--
-- Contexte : le bundle rss.app a expiré (HTTP 402), bloquant toute
-- ingestion d'articles depuis le 2026-05-04. Cette migration bascule
-- les sources qui exposent un flux RSS NATIF (WordPress /feed/) vers
-- leur URL directe — gratuit, sans dépendance tierce.
--
-- IMPORTANT :
--   1. À exécuter sur Supabase SQL Editor
--   2. Faire UN BACKUP avant : CREATE TABLE rss_feeds_backup AS SELECT * FROM rss_feeds;
--   3. Tester chaque URL via l'admin (/admin/rss-monitoring → bouton "Tester")
--      avant de réactiver les flux : certains sites peuvent avoir bloqué l'accès
--      RSS ou changé l'URL
--   4. Pour les pages Facebook (ministères, etc.), le RSS natif n'existe pas :
--      passe en `inactive` et envisage RSSHub (self-host gratuit) plus tard
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SITES WORDPRESS / SITES DE PRESSE — flux RSS natifs disponibles
-- ---------------------------------------------------------------------
-- Pattern courant : <domain>/feed/ ou <domain>/?feed=rss2
-- À adapter si un site refuse l'URL : utiliser le bouton "Tester" dans
-- la console admin pour valider chaque flux.

-- Gabon Actu
UPDATE rss_feeds SET url = 'https://gabonactu.com/feed/', updated_at = NOW()
  WHERE name ILIKE 'gabon actu%' AND url LIKE '%rss.app%';

-- AGP - Agence Gabonaise de Presse
UPDATE rss_feeds SET url = 'https://agpgabon.ga/feed/', updated_at = NOW()
  WHERE name ILIKE '%AGP%' AND url LIKE '%rss.app%';

-- Gabon Review
UPDATE rss_feeds SET url = 'https://www.gabonreview.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabon review%' AND url LIKE '%rss.app%';

-- Direct Infos Gabon
UPDATE rss_feeds SET url = 'https://directinfosgabon.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%direct infos%' AND url LIKE '%rss.app%';

-- Gabon Media Time
UPDATE rss_feeds SET url = 'https://www.gabonmediatime.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabon media time%' AND url LIKE '%rss.app%';

-- Gabon Mail Infos
UPDATE rss_feeds SET url = 'https://gabonmailinfos.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabon mail%' AND url LIKE '%rss.app%';

-- Focus Groupe Media (Gabon News)
UPDATE rss_feeds SET url = 'https://www.focusgroupemedia.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%focus groupe%' AND url LIKE '%rss.app%';

-- Inside News 241
UPDATE rss_feeds SET url = 'https://insidenews241.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%inside news%' AND url LIKE '%rss.app%';

-- Kongossa News
UPDATE rss_feeds SET url = 'https://kongossanews.info/feed/', updated_at = NOW()
  WHERE name ILIKE '%kongossa%' AND url LIKE '%rss.app%';

-- Vox Populi 241
UPDATE rss_feeds SET url = 'https://vxp241.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%vox populi%' OR name ILIKE 'VXP%';

-- L'Union
UPDATE rss_feeds SET url = 'https://lunion.ga/feed/', updated_at = NOW()
  WHERE name ILIKE 'l''union%' AND url LIKE '%rss.app%';

-- Gabon Eco
UPDATE rss_feeds SET url = 'https://gaboneco.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabon eco%' AND url LIKE '%rss.app%';

-- Gabon All Sport
UPDATE rss_feeds SET url = 'https://gabonallsport.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabonallsport%' AND url LIKE '%rss.app%';

-- Sport 241
UPDATE rss_feeds SET url = 'https://sport241.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%sport241%' AND url LIKE '%rss.app%';

-- Gaboma Info
UPDATE rss_feeds SET url = 'https://gaboma.info/feed/', updated_at = NOW()
  WHERE name ILIKE '%gaboma%' AND url LIKE '%rss.app%';

-- Gabon Info
UPDATE rss_feeds SET url = 'https://gabon-info.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabon info%' AND url LIKE '%rss.app%';

-- Gabonclic
UPDATE rss_feeds SET url = 'https://gabonclic.info/feed/', updated_at = NOW()
  WHERE name ILIKE '%gabonclic%' AND url LIKE '%rss.app%';

-- Infos Gabon (fr.infosgabon.com)
UPDATE rss_feeds SET url = 'https://fr.infosgabon.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%infos gabon%' AND url LIKE '%rss.app%';

-- Dépêches 241
UPDATE rss_feeds SET url = 'https://depeches241.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%depeches%' AND url LIKE '%rss.app%';

-- Gabon Newsroom
UPDATE rss_feeds SET url = 'https://gabon-newsroom.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%newsroom%' AND url LIKE '%rss.app%';

-- Journal du Gabon
UPDATE rss_feeds SET url = 'https://journaldugabon.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%journal du gabon%' AND url LIKE '%rss.app%';

-- Médiapôste Gabon
UPDATE rss_feeds SET url = 'https://mediapostegabon.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%mediaposte%' AND url LIKE '%rss.app%';

-- Les Échos de l'Éco
UPDATE rss_feeds SET url = 'https://echosdeleco.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%echos de%' AND url LIKE '%rss.app%';

-- Le Nouveau Gabon
UPDATE rss_feeds SET url = 'https://www.lenouveaugabon.com/fr/feed/atom/', updated_at = NOW()
  WHERE name ILIKE '%nouveau gabon%' AND url LIKE '%rss.app%';

-- 7 Jours Info
UPDATE rss_feeds SET url = 'https://7joursinfo.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%7 jours%' AND url LIKE '%rss.app%';

-- G9 Infos
UPDATE rss_feeds SET url = 'https://g9infos.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%g9infos%' AND url LIKE '%rss.app%';

-- Le Confidentiel
UPDATE rss_feeds SET url = 'https://leconfidentiel.net/feed/', updated_at = NOW()
  WHERE name ILIKE '%confidentiel%' AND url LIKE '%rss.app%';

-- Agence Equateur
UPDATE rss_feeds SET url = 'https://agenceequateur.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%agence equateur%' AND url LIKE '%rss.app%';

-- Courrier des Journalistes
UPDATE rss_feeds SET url = 'https://courrierdesjournalistes.net/feed/', updated_at = NOW()
  WHERE name ILIKE '%courrier des journalistes%' AND url LIKE '%rss.app%';

-- Le Touraco Vert
UPDATE rss_feeds SET url = 'https://letouracovert.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%touraco%' AND url LIKE '%rss.app%';

-- Peuple Infos
UPDATE rss_feeds SET url = 'https://peupleinfos.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%peuple infos%' AND url LIKE '%rss.app%';

-- Relais Infos Gabon
UPDATE rss_feeds SET url = 'https://relaisinfosgabon.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%relais infos%' AND url LIKE '%rss.app%';

-- Biba 241
UPDATE rss_feeds SET url = 'https://biba241.com/feed/', updated_at = NOW()
  WHERE name ILIKE '%biba%' AND url LIKE '%rss.app%';

-- RFI Gabon (flux thématique RFI)
UPDATE rss_feeds SET url = 'https://www.rfi.fr/fr/tag/gabon/rss', updated_at = NOW()
  WHERE name ILIKE '%RFI%' AND url LIKE '%rss.app%';

-- ---------------------------------------------------------------------
-- YOUTUBE — URL native disponible via channel_id
-- ---------------------------------------------------------------------
-- Format : https://www.youtube.com/feeds/videos.xml?channel_id=UCxxx
-- ATTENTION : il te faudra ouvrir chaque chaîne YouTube et récupérer le
-- channel_id (visible dans les paramètres avancés ou via youtube-id.com).
-- Exemple commenté ci-dessous pour Gabon Télévision :
--
-- UPDATE rss_feeds SET url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxx', updated_at = NOW()
--   WHERE name ILIKE '%Gabon Télévision%' AND url LIKE '%rss.app%';

-- ---------------------------------------------------------------------
-- PAGES FACEBOOK — pas de flux RSS natif
-- ---------------------------------------------------------------------
-- Facebook ne fournit pas de RSS. 3 options :
--   1. Garder rss.app (renouveler l'abonnement)
--   2. Self-host RSSHub (https://docs.rsshub.app) → gratuit, container Docker
--   3. Désactiver ces flux temporairement (cette migration met `inactive`)
--
-- On désactive toutes les pages Facebook qui pointent encore vers rss.app
-- pour éviter qu'elles spam les logs avec des 402. Tu pourras les
-- réactiver depuis l'admin une fois rss.app renouvelé ou RSSHub installé.

UPDATE rss_feeds
SET status = 'inactive',
    last_error = 'Désactivé automatiquement : RSS Facebook indisponible. Renouveler rss.app ou installer RSSHub.',
    updated_at = NOW()
WHERE url LIKE '%rss.app%'
  AND (name ILIKE '%facebook%' OR name ILIKE '%minist%');

-- ---------------------------------------------------------------------
-- DIAGNOSTIC : voir ce qui reste sur rss.app après migration
-- ---------------------------------------------------------------------
-- Décommenter pour inspecter :
-- SELECT name, url, status, last_error
-- FROM rss_feeds
-- WHERE url LIKE '%rss.app%'
-- ORDER BY status, name;

COMMIT;

-- =====================================================================
-- POST-MIGRATION : étapes manuelles
-- =====================================================================
-- 1. Aller sur /admin/rss-monitoring
-- 2. Filtrer par "Actifs"
-- 3. Pour chaque flux passé en URL native : cliquer "Tester" pour valider
-- 4. Si un test échoue, soit :
--    - Modifier l'URL via l'admin
--    - Désactiver le flux temporairement
-- 5. Cliquer "Synchroniser tout" pour lancer la première sync globale
-- 6. Attendre 1-2 min puis recharger : les articles devraient arriver
-- 7. Vérifier la chaîne WhatsApp dans les 15 minutes suivantes
