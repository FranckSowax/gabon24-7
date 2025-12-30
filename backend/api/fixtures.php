<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Gérer les requêtes OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Récupérer la date depuis les paramètres GET
$date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

// Valider le format de la date
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    echo json_encode(['error' => 'Format de date invalide. Utilisez YYYY-MM-DD']);
    exit();
}

// Configuration de l'API RapidAPI
$apiKey = getenv('RAPIDAPI_FOOTBALL_KEY') ?: 'c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7';
$apiHost = 'api-football-v1.p.rapidapi.com';
$apiUrl = "https://{$apiHost}/v3/fixtures?date={$date}";

// Initialiser cURL
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => $apiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => '',
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => 'GET',
    CURLOPT_HTTPHEADER => [
        "x-rapidapi-host: {$apiHost}",
        "x-rapidapi-key: {$apiKey}"
    ],
]);

$response = curl_exec($curl);
$err = curl_error($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);

curl_close($curl);

// Gestion des erreurs
if ($err) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur cURL',
        'message' => $err
    ]);
    exit();
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode([
        'error' => 'Erreur API',
        'httpCode' => $httpCode,
        'response' => json_decode($response)
    ]);
    exit();
}

// Retourner la réponse
echo $response;
?>
