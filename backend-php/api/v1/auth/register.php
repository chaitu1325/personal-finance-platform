<?php
declare(strict_types=1);

require_once dirname(__DIR__, 4) . '/lib/bootstrap.php';
require_once dirname(__DIR__, 4) . '/lib/request.php';
require_once dirname(__DIR__, 4) . '/lib/response.php';
require_once dirname(__DIR__, 4) . '/lib/jwt.php';

configure_http();

try {
    require_method('POST');
    $body = request_json();
    $email = strtolower(required_string($body, 'email', 320));
    $displayName = required_string($body, 'display_name', 120);
    $password = (string) ($body['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond_error('VALIDATION_ERROR', 'email must be valid', 422);
    }
    if (strlen($password) < 8 || strlen($password) > 200) {
        respond_error('VALIDATION_ERROR', 'password must contain 8 to 200 characters', 422);
    }

    $pdo = db();
    $pdo->beginTransaction();

    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        $pdo->rollBack();
        respond_error('EMAIL_EXISTS', 'An account already exists for this email', 409);
    }

    $hash = password_hash($password, PASSWORD_ARGON2ID);
    $userStmt = $pdo->prepare(
        'INSERT INTO users (email, password_hash, display_name, role, status)
         VALUES (?, ?, ?, ?, ?)'
    );
    $userStmt->execute([$email, $hash, $displayName, 'USER', 'ACTIVE']);
    $userId = (int) $pdo->lastInsertId();

    $familyStmt = $pdo->prepare(
        'INSERT INTO families (owner_user_id, name, base_currency) VALUES (?, ?, ?)'
    );
    $familyStmt->execute([$userId, $displayName . "'s Family", 'INR']);
    $familyId = (int) $pdo->lastInsertId();

    $memberStmt = $pdo->prepare(
        'INSERT INTO family_members (family_id, user_id, member_role) VALUES (?, ?, ?)'
    );
    $memberStmt->execute([$familyId, $userId, 'OWNER']);

    $pdo->commit();

    $user = ['id' => $userId, 'email' => $email, 'role' => 'USER'];
    respond([
        'user' => [
            'id' => $userId,
            'email' => $email,
            'display_name' => $displayName,
            'family_id' => $familyId,
        ],
        'token' => jwt_for_user($user),
    ], 201);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    handle_api_exception($e);
}
