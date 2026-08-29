<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    $user = require_auth();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $familyId = (int) $user['family_id'];
    $userId = (int) $user['user_id'];
    $pdo = db();

    if ($method === 'GET') {
        $statement = $pdo->prepare(
            'SELECT id, notification_type, title, message, read_at, created_at
             FROM notifications WHERE family_id = ? AND user_id = ?
             ORDER BY created_at DESC LIMIT 100'
        );
        $statement->execute([$familyId, $userId]);
        respond(['items' => $statement->fetchAll()]);
    }

    if ($method === 'PATCH' || $method === 'PUT') {
        $input = request_json();
        $id = pf_request_id($input);
        $readAt = array_key_exists('read', $input) && !$input['read'] ? null : date('Y-m-d H:i:s');
        $statement = $pdo->prepare(
            'UPDATE notifications SET read_at = ? WHERE id = ? AND family_id = ? AND user_id = ?'
        );
        $statement->execute([$readAt, $id, $familyId, $userId]);
        if ($statement->rowCount() < 1) {
            respond_error('Notification not found', 404);
        }
        respond(['id' => $id, 'read_at' => $readAt]);
    }

    respond_error('Method not allowed', 405);
});
