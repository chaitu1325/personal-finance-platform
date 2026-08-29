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
    $password = (string) ($body['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        respond_error('INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
    }

    $stmt = db()->prepare(
        'SELECT id, email, password_hash, display_name, role, status
         FROM users WHERE email = ? LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || $user['status'] !== 'ACTIVE' || !password_verify($password, $user['password_hash'])) {
        respond_error('INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
    }

    $familyStmt = db()->prepare(
        'SELECT family_id FROM family_members WHERE user_id = ? ORDER BY id LIMIT 1'
    );
    $familyStmt->execute([(int) $user['id']]);
    $familyId = $familyStmt->fetchColumn();

    respond([
        'user' => [
            'id' => (int) $user['id'],
            'email' => $user['email'],
            'display_name' => $user['display_name'],
            'role' => $user['role'],
            'family_id' => $familyId ? (int) $familyId : null,
        ],
        'token' => jwt_for_user($user),
    ]);
} catch (Throwable $e) {
    handle_api_exception($e);
}
