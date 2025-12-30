-- Insérer une vraie campagne avec les images uploadées existantes

-- D'abord, créer une campagne approuvée et payée
INSERT INTO ad_campaigns (
  id,
  company_name,
  contact_email,
  contact_phone,
  package_id,
  start_date,
  end_date,
  total_amount,
  payment_status,
  is_active,
  admin_approved
) VALUES (
  gen_random_uuid(),
  'TechSolutions Gabon',
  'contact@techsolutions.ga',
  '+241 01 23 45 67',
  (SELECT id FROM ad_packages WHERE name = 'Business' LIMIT 1),
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '15 days',
  50000,
  'paid',
  true,
  true
);

-- Récupérer l'ID de la campagne créée et insérer les slides avec les vraies images
DO $$
DECLARE
    campaign_id_var UUID;
BEGIN
    SELECT id INTO campaign_id_var 
    FROM ad_campaigns 
    WHERE company_name = 'TechSolutions Gabon' 
    ORDER BY created_at DESC
    LIMIT 1;

    -- Supprimer les anciens slides de démonstration avec images Unsplash
    DELETE FROM promotional_slides 
    WHERE image_url LIKE '%unsplash.com%';

    -- Insérer les nouveaux slides avec les vraies images uploadées
    INSERT INTO promotional_slides (
      campaign_id,
      title,
      description,
      image_url,
      link_url,
      cta_text,
      display_order,
      is_active,
      admin_approved
    ) VALUES 
    (
      campaign_id_var,
      'Solutions Digitales Innovantes',
      'Transformez votre entreprise avec nos solutions technologiques sur mesure',
      '/campaign-1756915033515-f12a7a26-3f8a-48b7-b6f6-b24679d45d71.jpg',
      'https://techsolutions.ga',
      'Découvrir nos services',
      1,
      true,
      true
    ),
    (
      campaign_id_var,
      'Formation & Consulting IT',
      'Accompagnement personnalisé pour vos projets de transformation digitale',
      '/campaign-1756914954249-9c338a73-a4d8-4427-81d2-dcf5a60bd536.jpg',
      'https://techsolutions.ga/formation',
      'Nous contacter',
      2,
      true,
      true
    ),
    (
      campaign_id_var,
      'Support Technique 24/7',
      'Une équipe d\'experts à votre service pour tous vos besoins techniques',
      '/campaign-1756914717568-d8b4e252-3891-49bb-8589-08e08efc596d.jpg',
      'https://techsolutions.ga/support',
      'Support immédiat',
      3,
      true,
      true
    );
END $$;
