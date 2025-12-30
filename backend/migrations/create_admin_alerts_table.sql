-- Migration: Créer la table admin_alerts pour surveiller les quotas API
-- Date: 2025-10-04
-- Description: Système d'alerte pour prévenir l'admin des problèmes de quota

CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Type d'alerte
  service TEXT NOT NULL, -- 'openai', 'replicate', 'deepseek', etc.
  alert_type TEXT NOT NULL, -- 'quota_warning', 'quota_exceeded', 'error', etc.
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Contenu
  message TEXT NOT NULL,
  details JSONB, -- Détails additionnels (erreur, contexte, etc.)
  
  -- Statut
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved', 'ignored')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Metadata
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status ON admin_alerts(status);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_service ON admin_alerts(service);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON admin_alerts(alert_type);

-- RLS policies (seulement pour les admins)
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

-- Politique: Seuls les admins peuvent voir les alertes
-- Note: Vous devrez créer une table 'admin_users' ou utiliser un champ 'is_admin' dans auth.users
CREATE POLICY "Admins can view all alerts"
  ON admin_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE '%@admin.gabon247.com' -- Adapter selon votre logique admin
    )
  );

-- Politique: Le système peut insérer des alertes (via service role)
CREATE POLICY "System can insert alerts"
  ON admin_alerts FOR INSERT
  WITH CHECK (true); -- Le backend utilise service_role_key

-- Politique: Les admins peuvent mettre à jour les alertes
CREATE POLICY "Admins can update alerts"
  ON admin_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE '%@admin.gabon247.com'
    )
  );

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_admin_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'acknowledged' AND OLD.status = 'new' THEN
    NEW.acknowledged_at = NOW();
  END IF;
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_alerts_status_trigger
  BEFORE UPDATE ON admin_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_alerts_updated_at();

-- Vue pour les alertes actives
CREATE OR REPLACE VIEW active_admin_alerts AS
SELECT 
  id,
  service,
  alert_type,
  severity,
  message,
  details,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS hours_since_created
FROM admin_alerts
WHERE status IN ('new', 'acknowledged')
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  created_at DESC;

-- Commentaires
COMMENT ON TABLE admin_alerts IS 'Alertes système pour surveillance des quotas API et erreurs critiques';
COMMENT ON COLUMN admin_alerts.severity IS 'Niveau de gravité: low (info), medium (warning), high (urgent), critical (immédiat)';
COMMENT ON COLUMN admin_alerts.details IS 'Détails JSON: error, context, action_required, impact, etc.';
COMMENT ON VIEW active_admin_alerts IS 'Vue des alertes non résolues triées par gravité';
