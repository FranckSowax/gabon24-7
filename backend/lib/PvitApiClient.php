<?php
/**
 * Client API PVIT - Gestion des paiements Mobile Money
 * Documentation: https://api.mypvit.pro
 */
class PvitApiClient {
    private $baseUrl = 'https://api.mypvit.pro';
    private $supabase;
    private $operationAccountCode;
    private $callbackUrlCode;
    private $receptionUrlCode;
    private $successRedirectionCode;
    private $failedRedirectionCode;
    private $renewPassword;

    public function __construct(SupabaseClient $supabase) {
        $this->supabase = $supabase;
        $this->operationAccountCode = getenv('PVIT_OPERATION_ACCOUNT_CODE') ?: $_ENV['PVIT_OPERATION_ACCOUNT_CODE'] ?? '';
        $this->callbackUrlCode = getenv('PVIT_CALLBACK_URL_CODE') ?: $_ENV['PVIT_CALLBACK_URL_CODE'] ?? '';
        $this->receptionUrlCode = getenv('PVIT_RECEPTION_URL_CODE') ?: $_ENV['PVIT_RECEPTION_URL_CODE'] ?? '';
        $this->successRedirectionCode = getenv('PVIT_SUCCESS_REDIRECTION_CODE') ?: $_ENV['PVIT_SUCCESS_REDIRECTION_CODE'] ?? '';
        $this->failedRedirectionCode = getenv('PVIT_FAILED_REDIRECTION_CODE') ?: $_ENV['PVIT_FAILED_REDIRECTION_CODE'] ?? '';
        $this->renewPassword = getenv('PVIT_RENEW_PASSWORD') ?: $_ENV['PVIT_RENEW_PASSWORD'] ?? '';
    }

    /**
     * Récupère la clé secrète PVIT valide depuis la base de données
     */
    public function getPvitSecretKey($operationAccountCode = null) {
        $accountCode = $operationAccountCode ?: $this->operationAccountCode;

        $result = $this->supabase->select(
            'pvit_current_key',
            '*',
            [
                'operation_account_code' => 'eq.' . $accountCode,
                'is_valid' => 'eq.true',
                'expires_at' => 'gt.' . date('c')
            ]
        );

        if ($result['status'] === 200 && !empty($result['data'])) {
            return $result['data'][0];
        }

        return null;
    }

    /**
     * Régénère la clé secrète PVIT
     */
    public function regeneratePvitKey($operationAccountCode = null) {
        $accountCode = $operationAccountCode ?: $this->operationAccountCode;

        $payload = [
            'operationAccountCode' => $accountCode,
            'receptionUrlCode' => $this->receptionUrlCode,
            'password' => $this->renewPassword
        ];

        $response = $this->makeRequest(
            '/BYQ5LLFX2X0BA0HB/renew-secret',
            $payload,
            false
        );

        return $response;
    }

    /**
     * Vérifie et gère automatiquement la clé PVIT
     */
    public function verifyAndManagePvitKey($operationAccountCode = null) {
        $accountCode = $operationAccountCode ?: $this->operationAccountCode;

        // Vérifier si une clé valide existe
        $currentKey = $this->getPvitSecretKey($accountCode);

        if (!$currentKey) {
            // Tentative de régénération avec retry
            for ($attempt = 1; $attempt <= 3; $attempt++) {
                if ($attempt > 1) {
                    sleep(3);
                }

                $regenerationResult = $this->regeneratePvitKey($accountCode);

                if ($regenerationResult && isset($regenerationResult['success']) && $regenerationResult['success']) {
                    sleep(3);
                    $newKey = $this->getPvitSecretKey($accountCode);

                    if ($newKey) {
                        return [
                            'success' => true,
                            'key_data' => $newKey,
                            'regenerated' => true,
                            'attempts' => $attempt
                        ];
                    }
                }
            }

            return [
                'success' => false,
                'error' => 'Impossible de régénérer la clé PVIT après 3 tentatives',
                'retry_after' => 10
            ];
        }

        return [
            'success' => true,
            'key_data' => $currentKey,
            'regenerated' => false
        ];
    }

    /**
     * Initie un paiement via PVIT RESTLINK
     */
    public function initiatePaymentRestLink($params) {
        // Vérifier/régénérer la clé
        $keyResult = $this->verifyAndManagePvitKey();

        if (!$keyResult['success']) {
            return [
                'success' => false,
                'error' => $keyResult['error'],
                'retry_after' => $keyResult['retry_after'] ?? 10
            ];
        }

        $secretKey = $keyResult['key_data']['secret_key'];

        $payload = [
            'amount' => $params['amount'],
            'currency' => 'XAF',
            'merchantReference' => $params['reference'],
            'customerMsisdn' => $params['phone'],
            'description' => $params['description'] ?? 'Achat Gabon24-7',
            'operationAccountCode' => $this->operationAccountCode,
            'callbackUrlCode' => $this->callbackUrlCode,
            'successRedirectionCode' => $this->successRedirectionCode,
            'failedRedirectionCode' => $this->failedRedirectionCode
        ];

        $response = $this->makeRequest('/YH6BCNXXAAQVNXYT/link', $payload, true, $secretKey);

        return $response;
    }

    /**
     * Vérifie le statut d'une transaction
     */
    public function checkTransactionStatus($merchantReferenceId) {
        $keyResult = $this->verifyAndManagePvitKey();

        if (!$keyResult['success']) {
            return ['success' => false, 'error' => $keyResult['error']];
        }

        $secretKey = $keyResult['key_data']['secret_key'];

        $payload = [
            'merchantReferenceId' => $merchantReferenceId,
            'operationAccountCode' => $this->operationAccountCode
        ];

        return $this->makeRequest('/9CYO5IQF289XH253/status', $payload, true, $secretKey);
    }

    /**
     * Effectue une requête HTTP vers l'API PVIT
     */
    private function makeRequest($endpoint, $payload, $useAuth = true, $secretKey = null) {
        $url = $this->baseUrl . $endpoint;

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];

        if ($useAuth && $secretKey) {
            $headers[] = 'Authorization: Bearer ' . $secretKey;
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => "Erreur cURL: $error",
                'http_code' => 0
            ];
        }

        $data = json_decode($response, true);

        return [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'http_code' => $httpCode,
            'data' => $data,
            'raw_response' => $response
        ];
    }

    /**
     * Reçoit et enregistre une nouvelle clé secrète
     */
    public function receiveSecretKey($data) {
        if (!isset($data['operation_account_code'], $data['secret_key'])) {
            return [
                'success' => false,
                'error' => 'Données manquantes'
            ];
        }

        $expiresIn = $data['expires_in'] ?? 86400;
        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn);

        // Désactiver les anciennes clés
        $this->supabase->update(
            'pvit_current_key',
            ['is_valid' => false],
            ['operation_account_code' => 'eq.' . $data['operation_account_code']]
        );

        // Insérer la nouvelle clé
        $result = $this->supabase->insert('pvit_current_key', [
            'operation_account_code' => $data['operation_account_code'],
            'secret_key' => $data['secret_key'],
            'expires_at' => $expiresAt,
            'key_source' => 'pvit_api',
            'is_valid' => true
        ]);

        return [
            'success' => $result['status'] === 201,
            'expires_at' => $expiresAt
        ];
    }
}
