<?php
/**
 * Client Supabase simplifié pour PHP
 * Utilisé par les endpoints PVIT
 */
class SupabaseClient {
    private $url;
    private $serviceRoleKey;

    public function __construct() {
        $this->url = getenv('SUPABASE_URL') ?: $_ENV['SUPABASE_URL'] ?? '';
        $this->serviceRoleKey = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: $_ENV['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

        if (!$this->serviceRoleKey) {
            throw new Exception('SUPABASE_SERVICE_ROLE_KEY non définie');
        }
    }

    /**
     * Effectue une requête HTTP vers Supabase
     */
    private function request($method, $endpoint, $data = null, $params = []) {
        $url = $this->url . '/rest/v1/' . $endpoint;

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $this->serviceRoleKey,
            'Authorization: Bearer ' . $this->serviceRoleKey,
            'Prefer: return=representation'
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("Erreur cURL: $error");
        }

        return [
            'data' => json_decode($response, true),
            'status' => $httpCode
        ];
    }

    /**
     * SELECT - Récupérer des données
     */
    public function select($table, $columns = '*', $filters = []) {
        $params = ['select' => $columns];
        foreach ($filters as $key => $value) {
            $params[$key] = $value;
        }
        return $this->request('GET', $table, null, $params);
    }

    /**
     * INSERT - Insérer des données
     */
    public function insert($table, $data) {
        return $this->request('POST', $table, $data);
    }

    /**
     * UPDATE - Mettre à jour des données
     */
    public function update($table, $data, $filters = []) {
        $params = [];
        foreach ($filters as $key => $value) {
            $params[$key] = $value;
        }
        return $this->request('PATCH', $table, $data, $params);
    }

    /**
     * RPC - Appeler une fonction PostgreSQL
     */
    public function rpc($functionName, $params = []) {
        $url = $this->url . '/rest/v1/rpc/' . $functionName;

        $headers = [
            'Content-Type: application/json',
            'apikey: ' . $this->serviceRoleKey,
            'Authorization: Bearer ' . $this->serviceRoleKey
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [
            'data' => json_decode($response, true),
            'status' => $httpCode
        ];
    }
}
