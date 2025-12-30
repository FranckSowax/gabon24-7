-- Script pour insérer des données de démonstration pour les slides publicitaires

-- D'abord, insérer une campagne de test
INSERT INTO ad_campaigns (
  id,
  user_id,
  package_id,
  company_name,
  contact_email,
  contact_phone,
  start_date,
  end_date,
  payment_status,
  is_approved,
  is_active
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(),
  (SELECT id FROM ad_packages WHERE name = 'Business' LIMIT 1),
  'TechGabon SARL',
  'contact@techgabon.com',
  '+241 01 23 45 67',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '15 days',
  'paid',
  true,
  true
);

-- Récupérer l'ID de la campagne créée
DO $$
DECLARE
    campaign_id_var UUID;
BEGIN
    SELECT id INTO campaign_id_var 
    FROM ad_campaigns 
    WHERE company_name = 'TechGabon SARL' 
    LIMIT 1;

    -- Insérer des slides de démonstration
    INSERT INTO promotional_slides (
      campaign_id,
      title,
      description,
      image_url,
      link_url,
      cta_text,
      display_order,
      is_active
    ) VALUES 
    (
      campaign_id_var,
      'Solutions IT Innovantes au Gabon',
      'Découvrez nos services informatiques de pointe pour votre entreprise',
      'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=400&fit=crop',
      'https://techgabon.com',
      'Découvrir nos services',
      1,
      true
    ),
    (
      campaign_id_var,
      'Formation Professionnelle IT',
      'Formez vos équipes aux dernières technologies',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=400&fit=crop',
      'https://techgabon.com/formation',
      'Voir les formations',
      2,
      true
    );
END $$;

-- Insérer une deuxième campagne
INSERT INTO ad_campaigns (
  id,
  user_id,
  package_id,
  company_name,
  contact_email,
  contact_phone,
  start_date,
  end_date,
  payment_status,
  is_approved,
  is_active
) VALUES (
  gen_random_uuid(),
  gen_random_uuid(),
  (SELECT id FROM ad_packages WHERE name = 'Starter' LIMIT 1),
  'Restaurant Le Palmier',
  'info@lepalmier.ga',
  '+241 07 89 12 34',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  'paid',
  true,
  true
);

-- Ajouter un slide pour le restaurant
DO $$
DECLARE
    restaurant_campaign_id UUID;
BEGIN
    SELECT id INTO restaurant_campaign_id 
    FROM ad_campaigns 
    WHERE company_name = 'Restaurant Le Palmier' 
    LIMIT 1;

    INSERT INTO promotional_slides (
      campaign_id,
      title,
      description,
      image_url,
      link_url,
      cta_text,
      display_order,
      is_active
    ) VALUES (
      restaurant_campaign_id,
      'Cuisine Gabonaise Authentique',
      'Savourez nos plats traditionnels dans un cadre exceptionnel',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=400&fit=crop',
      'https://lepalmier.ga',
      'Réserver une table',
      1,
      true
    );
END $$;
