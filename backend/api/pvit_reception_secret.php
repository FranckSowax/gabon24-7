<?php
/**
 * Endpoint de réception des nouvelles clés secrètes PVIT
 * POST /api/pvit_reception_secret.php
 *
 * Appelé par PVIT après une demande de renouvellement de clé
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../lib/supabase-php.php';
require_once __DIR__ . '/../lib/PvitApiClient.php';

try {
    $supabase = new SupabaseClient();
    $pvitClient = new PvitApiClient($supabase);

    // Récupérer les données
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Log pour debug
    error_log('PVIT Reception Secret: ' . $input);

    // Valider les données requises (plusieurs formats possibles)
    if (!isset($data['operation_account_code']) || !isset($data['secret_key'])) {
        $data = [
            'operation_account_code' => $data['operationAccountCode'] ?? $data['operation_account_code'] ?? null,
            'secret_key' => $data['secretKey'] ?? $data['secret_key'] ?? null,
            'expires_in' => $data['expiresIn'] ?? $data['expires_in'] ?? 86400
        ];
    }

    if (!$data['operation_account_code'] || !$data['secret_key']) {
        throw new Exception('Données de clé manquantes');
    }

    // Enregistrer la nouvelle clé
    $result = $pvitClient->receiveSecretKey($data);

    if ($result['success']) {
        echo json_encode([
            'responseCode' => 'SUCCESS',
            'message' => 'Clé enregistrée avec succès',
            'expires_at' => $result['expires_at']
        ]);
    } else {
        throw new Exception($result['error'] ?? 'Erreur inconnue');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'responseCode' => 'ERROR',
        'message' => $e->getMessage()
    ]);
}
