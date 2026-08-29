<?php
declare(strict_types=1);

function jwt_base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function jwt_base64url_decode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding > 0) {
        $value .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    if ($decoded === false) {
        throw new RuntimeException('Invalid token encoding');
    }
    return $decoded;
}

function jwt_encode(array $payload, string $secret): string
{
    if ($secret === '') {
        throw new RuntimeException('JWT_SECRET is not configured');
    }
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];
    $encodedHeader = jwt_base64url_encode((string) json_encode($header));
    $encodedPayload = jwt_base64url_encode((string) json_encode($payload));
    $signingInput = $encodedHeader . '.' . $encodedPayload;
    $signature = hash_hmac('sha256', $signingInput, $secret, true);
    return $signingInput . '.' . jwt_base64url_encode($signature);
}

function jwt_decode(string $token, string $secret): array
{
    if ($secret === '') {
        throw new RuntimeException('JWT_SECRET is not configured');
    }
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Invalid token');
    }
    [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
    $header = json_decode(jwt_base64url_decode($encodedHeader), true);
    $payload = json_decode(jwt_base64url_decode($encodedPayload), true);
    if (!is_array($header) || !is_array($payload) || ($header['alg'] ?? null) !== 'HS256') {
        throw new RuntimeException('Invalid token');
    }
    $expectedSignature = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true);
    $actualSignature = jwt_base64url_decode($encodedSignature);
    if (!hash_equals($expectedSignature, $actualSignature)) {
        throw new RuntimeException('Invalid token signature');
    }
    if (isset($payload['exp']) && (int) $payload['exp'] < time()) {
        throw new RuntimeException('Token expired');
    }
    return $payload;
}

function jwt_for_user(array $user): string
{
    $config = app_config();
    $now = time();
    return jwt_encode([
        'iss' => 'personal-finance-platform',
        'sub' => (string) $user['id'],
        'email' => (string) ($user['email'] ?? ''),
        'iat' => $now,
        'exp' => $now + (int) ($config['jwt_ttl_seconds'] ?? 3600),
    ], (string) ($config['jwt_secret'] ?? ''));
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
    }
    if (preg_match('/^Bearer\s+(.+)$/i', trim($header), $matches) !== 1) {
        return null;
    }
    return trim($matches[1]);
}
