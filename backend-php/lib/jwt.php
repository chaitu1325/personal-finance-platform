<?php
declare(strict_types=1);

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64url_decode(string $value): string
{
    return base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4));
}

function jwt_encode(array $claims): string
{
    $secret = (string) app_config()['jwt_secret'];
    if ($secret === '' || strlen($secret) < 32) {
        throw new RuntimeException('JWT_SECRET must be configured with at least 32 characters');
    }

    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
    $payload = base64url_encode(json_encode($claims, JSON_THROW_ON_ERROR));
    $unsigned = $header . '.' . $payload;
    $signature = hash_hmac('sha256', $unsigned, $secret, true);
    return $unsigned . '.' . base64url_encode($signature);
}

function jwt_for_user(array $user): string
{
    $now = time();
    return jwt_encode([
        'iss' => 'personal-finance-platform',
        'sub' => (string) $user['id'],
        'email' => $user['email'],
        'role' => $user['role'],
        'iat' => $now,
        'exp' => $now + (int) app_config()['jwt_ttl_seconds'],
    ]);
}
