<?php
declare(strict_types=1);

function auth_user(): array
{
    static $context = null;
    if (is_array($context)) {
        return $context;
    }
    $token = bearer_token();
    if ($token === null) {
        respond_error('Authentication required', 401);
    }
    try {
        $payload = jwt_decode($token, (string) (app_config()['jwt_secret'] ?? ''));
    } catch (Throwable $exception) {
        respond_error('Invalid or expired token', 401);
    }
    $userId = (int) ($payload['sub'] ?? 0);
    if ($userId < 1) {
        respond_error('Invalid token subject', 401);
    }
    $statement = db()->prepare(
        'SELECT u.id, u.email, u.display_name, u.role, u.status,
                fm.family_id, fm.member_role
         FROM users u
         INNER JOIN family_members fm ON fm.user_id = u.id AND fm.status = \'ACTIVE\'
         WHERE u.id = ? AND u.status = \'ACTIVE\'
         ORDER BY fm.id
         LIMIT 1'
    );
    $statement->execute([$userId]);
    $row = $statement->fetch();
    if (!is_array($row)) {
        respond_error('User is not a member of an active family', 403);
    }
    $context = [
        'user_id' => (int) $row['id'],
        'email' => $row['email'],
        'display_name' => $row['display_name'],
        'role' => $row['role'],
        'family_id' => (int) $row['family_id'],
        'member_role' => $row['member_role'],
    ];
    return $context;
}

function require_auth(): array
{
    return auth_user();
}

function require_role(array $roles): array
{
    $user = auth_user();
    $allowed = array_map('strtoupper', $roles);
    if (!in_array(strtoupper((string) $user['member_role']), $allowed, true)
        && !in_array(strtoupper((string) $user['role']), $allowed, true)) {
        respond_error('Insufficient permissions', 403);
    }
    return $user;
}
