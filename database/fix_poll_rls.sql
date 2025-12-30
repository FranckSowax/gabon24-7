-- Correction des politiques RLS pour les sondages
-- Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Allow insert poll responses" ON poll_responses;
DROP POLICY IF EXISTS "Allow read poll stats" ON poll_stats;
DROP POLICY IF EXISTS "Allow read active polls" ON polls;

-- Nouvelles politiques plus permissives pour les utilisateurs anonymes
-- Permettre la lecture de tous les sondages actifs
CREATE POLICY "Enable read for active polls" ON polls
  FOR SELECT USING (is_active = true AND expires_at > NOW());

-- Permettre l'insertion de réponses pour tous les utilisateurs (anonymes)
CREATE POLICY "Enable insert for poll responses" ON poll_responses
  FOR INSERT WITH CHECK (true);

-- Permettre la lecture des réponses pour calculer les stats
CREATE POLICY "Enable read for poll responses" ON poll_responses
  FOR SELECT USING (true);

-- Permettre la lecture des statistiques pour tous
CREATE POLICY "Enable read for poll stats" ON poll_stats
  FOR SELECT USING (true);

-- Permettre l'insertion/mise à jour des stats (pour les triggers)
CREATE POLICY "Enable insert for poll stats" ON poll_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for poll stats" ON poll_stats
  FOR UPDATE USING (true);

-- Permettre la mise à jour du compteur total_votes dans polls
CREATE POLICY "Enable update for polls total_votes" ON polls
  FOR UPDATE USING (true);
