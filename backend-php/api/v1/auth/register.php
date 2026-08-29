<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_bootstrap.php';

api_run(function (): void {
    require_method('POST');
    $input = request_json();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $displayName = trim((string) ($input['display_name'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    $currency = strtoupper(trim((string) ($input['default_currency'] ?? 'INR')));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond_error('A valid email is required', 422);
    }
    if (strlen($displayName) < 2 || strlen($displayName) > 120) {
        respond_error('display_name must be between 2 and 120 characters', 422);
    }
    if (strlen($password) < 8 || strlen($password) > 200) {
        respond_error('password must be between 8 and 200 characters', 422);
    }
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        respond_error('default_currency must be a 3-letter currency code', 422);
    }

    $pdo = db();
    try {
        $pdo->beginTransaction();
        $hashAlgorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
        $userStatement = $pdo->prepare(
            'INSERT INTO users (email, password_hash, display_name, default_currency)
             VALUES (?, ?, ?, ?)'
        );
        $userStatement->execute([
            $email,
            password_hash($password, $hashAlgorithm),
            $displayName,
            $currency,
        ]);
        $userId = (int) $pdo->lastInsertId();

        $familyStatement = $pdo->prepare(
            'INSERT INTO families (owner_user_id, name, base_currency) VALUES (?, ?, ?)'
        );
        $familyStatement->execute([$userId, $displayName . "'s Family", $currency]);
        $familyId = (int) $pdo->lastInsertId();

        $memberStatement = $pdo->prepare(
            'INSERT INTO family_members (family_id, user_id, member_role) VALUES (?, ?, ?)'
        );
        $memberStatement->execute([$familyId, $userId, 'OWNER']);
        $pdo->commit();
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ((string) $exception->getCode() === '23000') {
            respond_error('An account with this email already exists', 409);
        }
        throw $exception;
    }

    $user = [
        'id' => $userId,
        'email' => $email,
        'display_name' => $displayName,
        'role' => 'USER',
        'family_id' => $familyId,
        'member_role' => 'OWNER',
    ];
    respond(['user' => $user, 'token' => jwt_for_user($user)], 201);
});
