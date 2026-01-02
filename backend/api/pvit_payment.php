<?php
/**
 * Endpoint d'initiation de paiement PVIT
 * POST /api/pvit_payment.php
 *
 * Utilisé pour: Abonnements, Crédits, Quiz
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../lib/supabase-php.php';
require_once __DIR__ . '/../lib/PvitApiClient.php';

try {
    // Récupérer les données de la requête
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Validation des paramètres requis
    $required = ['amount', 'phone', 'reference', 'type'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            throw new Exception("Champ requis manquant: $field");
        }
    }

    // Validation du type de paiement
    $validTypes = ['credits', 'subscription', 'quiz'];
    if (!in_array($data['type'], $validTypes)) {
        throw new Exception("Type de paiement invalide: " . $data['type']);
    }

    // Validation du montant
    $amount = intval($data['amount']);
    if ($amount < 100) {
        throw new Exception('Montant minimum: 100 XAF');
    }

    // Validation du téléphone (format Gabon: 0X XX XX XX ou +241 XX XX XX XX)
    $phone = preg_replace('/[^0-9]/', '', $data['phone']);
    if (strlen($phone) < 8) {
        throw new Exception('Numéro de téléphone invalide');
    }
    // Ajouter le préfixe 241 si nécessaire
    if (strlen($phone) === 8 || strlen($phone) === 9) {
        $phone = '241' . $phone;
    }

    // Initialiser les clients
    $supabase = new SupabaseClient();
    $pvitClient = new PvitApiClient($supabase);

    // Construire la description selon le type
    $descriptions = [
        'credits' => 'Achat de crédits Gabon24-7',
        'subscription' => 'Abonnement ' . ($data['plan_name'] ?? 'Premium') . ' Gabon24-7',
        'quiz' => 'Inscription Quiz - ' . ($data['quiz_name'] ?? 'Quiz Gabon24-7')
    ];

    // Préparer les paramètres PVIT
    $params = [
        'amount' => $amount,
        'phone' => $phone,
        'reference' => $data['reference'],
        'description' => $descriptions[$data['type']]
    ];

    // Enregistrer le paiement en attente
    $paymentData = [
        'order_id' => $data['order_id'] ?? null,
        'reference' => $data['reference'],
        'amount' => $amount,
        'phone' => $phone,
        'description' => $descriptions[$data['type']],
        'status' => 'pending',
        'user_id' => $data['user_id'] ?? null,
        'payment_type' => $data['type'],
        // Données spécifiques selon le type
        'package_id' => $data['package_id'] ?? null,
        'credits_to_add' => $data['credits'] ?? 0,
        'bonus_credits' => $data['bonus_credits'] ?? 0,
        'plan_slug' => $data['plan_slug'] ?? null,
        'plan_duration' => $data['plan_duration'] ?? 1,
        'quiz_id' => $data['quiz_id'] ?? null,
        'metadata' => json_encode([
            'type' => $data['type'],
            'plan_name' => $data['plan_name'] ?? null,
            'quiz_name' => $data['quiz_name'] ?? null
        ])
    ];

    $insertResult = $supabase->insert('pvit_payments', $paymentData);

    if ($insertResult['status'] !== 201) {
        throw new Exception('Erreur lors de l\'enregistrement du paiement');
    }

    // Initier le paiement PVIT
    $pvitResponse = $pvitClient->initiatePaymentRestLink($params);

    if (!$pvitResponse['success']) {
        // Mettre à jour le statut en échec
        $supabase->update(
            'pvit_payments',
            [
                'status' => 'failed',
                'pvit_response' => json_encode($pvitResponse)
            ],
            ['reference' => 'eq.' . $data['reference']]
        );

        throw new Exception($pvitResponse['error'] ?? 'Erreur PVIT inconnue');
    }

    // Mettre à jour avec la réponse PVIT
    $merchantReferenceId = $pvitResponse['data']['merchantReferenceId'] ?? null;

    $supabase->update(
        'pvit_payments',
        [
            'merchant_reference_id' => $merchantReferenceId,
            'pvit_response' => json_encode($pvitResponse['data'])
        ],
        ['reference' => 'eq.' . $data['reference']]
    );

    // Réponse succès
    echo json_encode([
        'success' => true,
        'data' => [
            'reference' => $data['reference'],
            'merchant_reference_id' => $merchantReferenceId,
            'amount' => $amount,
            'status' => 'pending',
            'type' => $data['type'],
            'message' => 'Paiement initié. Vérifiez votre téléphone pour valider.'
        ],
        'pvit_response' => $pvitResponse['data']
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
