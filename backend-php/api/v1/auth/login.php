<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_bootstrap.php';

api_run(function (): void {
    require_method('POST');
    $input = request_json();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        respond_error('email and password are required', 422);
    }

    $statement = db()->prepare(
        'SELECT u.id, u.email, u.password_hash, u.display_name, u.role,
                fm.family_id, fm.member_role
         FROM users u
         INNER JOIN family_members fm ON fm.user_id = u.id AND fm.status = \'ACTIVE\'
         WHERE u.email = ? AND u.status = \'ACTIVE\'
         ORDER BY fm.id
         LIMIT 1'
    );
    $statement->execute([$email]);
    $user = $statement->fetch();
    if (!is_array($user) || !password_verify($password, (string) $user['password_hash'])) {
        respond_error('Invalid email or password', 401);
    }

    $publicUser = [
        'id' => (int) $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'role' => $user['role'],
        'family_id' => (int) $user['family_id'],
        'member_role' => $user['member_role'],
    ];
    respond(['user' => $publicUser, 'token' => jwt_for_user($publicUser)]);
});
