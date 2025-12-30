-- ============================================
-- FIX: Ajouter les colonnes manquantes à credit_packages
-- ============================================

-- Vérifier si la table existe déjà
DO $$ 
BEGIN
    -- Ajouter sort_order si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    -- Ajouter max_purchases_per_user si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'max_purchases_per_user'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN max_purchases_per_user INTEGER;
    END IF;

    -- Ajouter description si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN description TEXT;
    END IF;

    -- Ajouter features si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'features'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN features JSONB DEFAULT '[]';
    END IF;

    -- Ajouter metadata si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    -- Ajouter discount_percentage si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'discount_percentage'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN discount_percentage INTEGER DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100);
    END IF;

    -- Ajouter price_usd si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'credit_packages' 
        AND column_name = 'price_usd'
    ) THEN
        ALTER TABLE credit_packages ADD COLUMN price_usd DECIMAL(10,2);
    END IF;

    RAISE NOTICE 'Colonnes manquantes ajoutées avec succès';
END $$;

-- Créer l'index si il n'existe pas
CREATE INDEX IF NOT EXISTS idx_credit_packages_active ON credit_packages(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_credit_packages_slug ON credit_packages(slug);

-- Afficher les colonnes actuelles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'credit_packages'
ORDER BY ordinal_position;
