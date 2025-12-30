-- Mise à jour de la table ad_campaigns pour le système de pending et approbation
ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'expired'));

ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS visual_creation_service BOOLEAN DEFAULT false;

ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS visual_service_price INTEGER DEFAULT 0;

ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE ad_campaigns 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Commentaires pour les nouvelles colonnes
COMMENT ON COLUMN ad_campaigns.status IS 'Statut de la campagne: pending, approved, rejected, active, expired';
COMMENT ON COLUMN ad_campaigns.visual_creation_service IS 'Service de création de visuels demandé (50 000 FCFA)';
COMMENT ON COLUMN ad_campaigns.visual_service_price IS 'Prix du service de création de visuels en FCFA';
COMMENT ON COLUMN ad_campaigns.admin_notes IS 'Notes de l''administrateur lors de l''approbation/rejet';
COMMENT ON COLUMN ad_campaigns.submission_date IS 'Date de soumission de la campagne';
COMMENT ON COLUMN ad_campaigns.approval_date IS 'Date d''approbation/rejet par l''admin';
COMMENT ON COLUMN ad_campaigns.approved_by IS 'ID de l''administrateur qui a approuvé/rejeté';

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_submission_date ON ad_campaigns(submission_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_approval_date ON ad_campaigns(approval_date);

-- Mise à jour des campagnes existantes
UPDATE ad_campaigns 
SET status = CASE 
    WHEN admin_approved = true AND is_active = true THEN 'active'
    WHEN admin_approved = true AND is_active = false THEN 'approved'
    WHEN admin_approved = false THEN 'pending'
    ELSE 'pending'
END
WHERE status IS NULL OR status = 'pending';
