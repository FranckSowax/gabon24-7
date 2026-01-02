<?php
/**
 * Endpoint de callback PVIT
 * POST /api/pvit_callback.php
 *
 * Appelé automatiquement par PVIT après chaque transaction
 * Gère: Crédits, Abonnements, Quiz
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../lib/supabase-php.php';

// Toujours répondre 200 OK à PVIT rapidement
function respondToPvit($success = true, $message = 'OK') {
    echo json_encode([
        'responseCode' => $success ? 'SUCCESS' : 'ERROR',
        'message' => $message,
        'timestamp' => date('c')
    ]);
}

try {
    $supabase = new SupabaseClient();

    // Récupérer les données du callback
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // Log du callback (pour audit)
    $logData = [
        'reference' => $data['merchantReference'] ?? null,
        'merchant_reference_id' => $data['merchantReferenceId'] ?? null,
        'status' => $data['operationStatus'] ?? 'UNKNOWN',
        'amount' => $data['amount'] ?? 0,
        'raw_data' => json_encode($data),
        'processed' => false
    ];

    $supabase->insert('pvit_callback_logs', $logData);

    // Extraire les informations clés
    $reference = $data['merchantReference'] ?? null;
    $merchantReferenceId = $data['merchantReferenceId'] ?? null;
    $operationStatus = strtoupper($data['operationStatus'] ?? '');
    $amount = $data['amount'] ?? 0;

    if (!$reference) {
        respondToPvit(true, 'Reference manquante mais callback enregistré');
        exit;
    }

    // Mapper le statut PVIT vers notre statut interne
    $statusMap = [
        'SUCCESS' => 'completed',
        'SUCCESSFUL' => 'completed',
        'COMPLETED' => 'completed',
        'FAILED' => 'failed',
        'FAILURE' => 'failed',
        'CANCELLED' => 'cancelled',
        'PENDING' => 'pending'
    ];

    $internalStatus = $statusMap[$operationStatus] ?? 'pending';

    // Récupérer le paiement existant
    $paymentResult = $supabase->select(
        'pvit_payments',
        '*',
        ['reference' => 'eq.' . $reference]
    );

    if (empty($paymentResult['data'])) {
        respondToPvit(true, 'Paiement non trouvé mais callback enregistré');
        exit;
    }

    $payment = $paymentResult['data'][0];

    // Ne pas retraiter un paiement déjà complété
    if ($payment['status'] === 'completed') {
        respondToPvit(true, 'Paiement déjà traité');
        exit;
    }

    // Mettre à jour le paiement
    $updateData = [
        'status' => $internalStatus,
        'callback_data' => json_encode($data),
        'updated_at' => date('c')
    ];

    if ($internalStatus === 'completed') {
        $updateData['completed_at'] = date('c');
    }

    $supabase->update(
        'pvit_payments',
        $updateData,
        ['reference' => 'eq.' . $reference]
    );

    // Si paiement réussi, traiter selon le type
    if ($internalStatus === 'completed' && $payment['user_id']) {
        $paymentType = $payment['payment_type'] ?? 'credits';

        switch ($paymentType) {
            case 'credits':
                // Ajouter les crédits
                $creditsToAdd = intval($payment['credits_to_add'] ?? 0);
                $bonusCredits = intval($payment['bonus_credits'] ?? 0);

                if ($creditsToAdd > 0) {
                    $supabase->rpc('add_credits', [
                        'p_user_id' => $payment['user_id'],
                        'p_credits' => $creditsToAdd,
                        'p_bonus_credits' => $bonusCredits,
                        'p_package_id' => $payment['package_id'],
                        'p_price_paid_xaf' => intval($amount),
                        'p_payment_method' => 'pvit',
                        'p_payment_reference' => $merchantReferenceId,
                        'p_description' => 'Achat via Mobile Money - ' . $reference
                    ]);
                }
                break;

            case 'subscription':
                // Activer l'abonnement
                $planSlug = $payment['plan_slug'] ?? 'premium';
                $planDuration = intval($payment['plan_duration'] ?? 1);

                // Récupérer le plan
                $planResult = $supabase->select(
                    'subscription_plans',
                    '*',
                    ['slug' => 'eq.' . $planSlug]
                );

                if (!empty($planResult['data'])) {
                    $plan = $planResult['data'][0];

                    // Désactiver les anciens abonnements
                    $supabase->update(
                        'subscriptions',
                        ['status' => 'expired', 'updated_at' => date('c')],
                        ['user_id' => 'eq.' . $payment['user_id'], 'status' => 'eq.active']
                    );

                    // Calculer les dates
                    $now = new DateTime();
                    $endDate = clone $now;
                    $endDate->modify("+{$planDuration} months");

                    // Créer le nouvel abonnement
                    $supabase->insert('subscriptions', [
                        'user_id' => $payment['user_id'],
                        'plan_id' => $plan['id'],
                        'status' => 'active',
                        'payment_method' => 'mobile_money',
                        'current_period_start' => $now->format('c'),
                        'current_period_end' => $endDate->format('c'),
                        'metadata' => json_encode([
                            'pvit_reference' => $merchantReferenceId,
                            'payment_amount' => $amount,
                            'duration_months' => $planDuration
                        ])
                    ]);

                    // Attribuer les crédits mensuels
                    $monthlyCredits = intval($plan['monthly_credits'] ?? 0);
                    if ($monthlyCredits > 0) {
                        $supabase->rpc('add_user_credits', [
                            'p_user_id' => $payment['user_id'],
                            'p_amount' => $monthlyCredits,
                            'p_reason' => 'subscription_activation',
                            'p_description' => 'Crédits mensuels - Abonnement ' . $plan['name']
                        ]);
                    }
                }
                break;

            case 'quiz':
                // Inscrire au quiz
                $quizId = $payment['quiz_id'] ?? null;

                if ($quizId) {
                    // Créer l'inscription au quiz
                    $supabase->insert('quiz_participants', [
                        'quiz_id' => $quizId,
                        'user_id' => $payment['user_id'],
                        'payment_reference' => $merchantReferenceId,
                        'payment_amount' => $amount,
                        'status' => 'registered',
                        'registered_at' => date('c')
                    ]);

                    // Incrémenter le compteur de participants
                    // Note: Ceci devrait idéalement être une fonction RPC
                }
                break;
        }

        // Marquer le callback comme traité
        $supabase->update(
            'pvit_callback_logs',
            ['processed' => true],
            ['reference' => 'eq.' . $reference]
        );
    }

    respondToPvit(true, 'Callback traité avec succès');

} catch (Exception $e) {
    // Toujours répondre 200 à PVIT même en cas d'erreur
    error_log('PVIT Callback Error: ' . $e->getMessage());
    respondToPvit(true, 'Erreur interne mais callback reçu');
}
