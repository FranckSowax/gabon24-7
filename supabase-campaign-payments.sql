-- =====================================================
-- Table des paiements de campagnes publicitaires
-- =====================================================

-- Créer la table campaign_payments
CREATE TABLE IF NOT EXISTS campaign_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255) NOT NULL,
  user_phone VARCHAR(50),
  user_full_name VARCHAR(255) NOT NULL,
  
  -- Méthode et statut de paiement
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('mobile_money', 'card', 'cash')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'pending_cash', 'cancelled')),
  
  -- Montant
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'FCFA',
  
  -- Campagnes associées
  campaign_ids UUID[] NOT NULL,
  
  -- Détails Mobile Money
  mobile_operator VARCHAR(50),
  mobile_number VARCHAR(50),
  mobile_transaction_id VARCHAR(255),
  
  -- Détails Carte
  card_last_four VARCHAR(4),
  card_brand VARCHAR(50),
  card_transaction_id VARCHAR(255),
  
  -- Détails Cash
  pickup_location VARCHAR(255),
  pickup_notes TEXT,
  cash_received_at TIMESTAMP WITH TIME ZONE,
  cash_received_by VARCHAR(255),
  
  -- Métadonnées
  payment_provider VARCHAR(100),
  payment_provider_response JSONB,
  
  -- Dates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_campaign_payments_user ON campaign_payments(user_id);
CREATE INDEX idx_campaign_payments_email ON campaign_payments(user_email);
CREATE INDEX idx_campaign_payments_status ON campaign_payments(status);
CREATE INDEX idx_campaign_payments_method ON campaign_payments(payment_method);
CREATE INDEX idx_campaign_payments_created ON campaign_payments(created_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_campaign_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_update_campaign_payments_updated_at ON campaign_payments;
CREATE TRIGGER trigger_update_campaign_payments_updated_at
  BEFORE UPDATE ON campaign_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_payments_updated_at();

-- =====================================================
-- Modification de la table campaigns pour ajouter payment_status
-- =====================================================

-- Ajouter colonne payment_status si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE campaigns 
    ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending' 
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));
  END IF;
END $$;

-- Ajouter colonne payment_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE campaigns 
    ADD COLUMN payment_id UUID REFERENCES campaign_payments(id);
  END IF;
END $$;

-- =====================================================
-- Fonction pour mettre à jour le statut des campagnes après paiement
-- =====================================================

CREATE OR REPLACE FUNCTION update_campaigns_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand le paiement est complété
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Mettre à jour toutes les campagnes associées
    UPDATE campaigns
    SET 
      status = 'pending',  -- Campagne en attente de validation admin
      payment_status = 'completed',
      payment_id = NEW.id,
      updated_at = NOW()
    WHERE id = ANY(NEW.campaign_ids);
    
    -- Mettre à jour completed_at
    NEW.completed_at = NOW();
  END IF;
  
  -- Quand le paiement échoue
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    UPDATE campaigns
    SET 
      payment_status = 'failed',
      payment_id = NEW.id,
      updated_at = NOW()
    WHERE id = ANY(NEW.campaign_ids);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour les campagnes automatiquement
DROP TRIGGER IF EXISTS trigger_update_campaigns_after_payment ON campaign_payments;
CREATE TRIGGER trigger_update_campaigns_after_payment
  AFTER UPDATE ON campaign_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_after_payment();

-- =====================================================
-- Politiques RLS (Row Level Security)
-- =====================================================

-- Activer RLS
ALTER TABLE campaign_payments ENABLE ROW LEVEL SECURITY;

-- Politique SELECT: Les utilisateurs peuvent voir leurs propres paiements
CREATE POLICY "Users can view their own payments"
  ON campaign_payments
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR user_email = auth.email()
  );

-- Politique INSERT: Les utilisateurs authentifiés peuvent créer des paiements
CREATE POLICY "Authenticated users can create payments"
  ON campaign_payments
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    OR auth.role() = 'anon'
  );

-- Politique UPDATE: Seuls les admins peuvent mettre à jour
CREATE POLICY "Only admins can update payments"
  ON campaign_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Vue pour les statistiques de paiements
-- =====================================================

CREATE OR REPLACE VIEW campaign_payments_stats AS
SELECT
  payment_method,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  DATE_TRUNC('day', created_at) as date
FROM campaign_payments
GROUP BY payment_method, status, DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- =====================================================
-- Commentaires pour documentation
-- =====================================================

COMMENT ON TABLE campaign_payments IS 'Table des paiements pour les campagnes publicitaires';
COMMENT ON COLUMN campaign_payments.payment_method IS 'Méthode de paiement: mobile_money, card, ou cash';
COMMENT ON COLUMN campaign_payments.status IS 'Statut: pending, processing, completed, failed, pending_cash, cancelled';
COMMENT ON COLUMN campaign_payments.campaign_ids IS 'Array des IDs de campagnes associées au paiement';
COMMENT ON COLUMN campaign_payments.pickup_location IS 'Lieu de récupération pour paiement cash';

-- =====================================================
-- Données de test (optionnel)
-- =====================================================

-- Exemple de paiement test (décommenter si besoin)
-- INSERT INTO campaign_payments (
--   user_email,
--   user_full_name,
--   user_phone,
--   payment_method,
--   status,
--   amount,
--   campaign_ids
-- ) VALUES (
--   'test@example.com',
--   'Test User',
--   '+241 XX XX XX XX',
--   'mobile_money',
--   'pending',
--   450000,
--   ARRAY[]::UUID[]
-- );
