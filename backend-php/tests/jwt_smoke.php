<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/jwt.php';

$secret = 'local-test-secret';
$token = jwt_encode(['sub' => '42', 'exp' => time() + 60], $secret);
$payload = jwt_decode($token, $secret);
if (($payload['sub'] ?? null) !== '42') {
    fwrite(STDERR, "JWT round-trip failed\n");
    exit(1);
}
try {
    jwt_decode($token, 'wrong-secret');
    fwrite(STDERR, "JWT signature validation failed\n");
    exit(1);
} catch (Throwable $exception) {
    echo "JWT smoke test passed\n";
}
