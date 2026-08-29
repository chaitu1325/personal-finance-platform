<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    require_method('GET');
    $payload = ['status' => 'ok', 'service' => 'personal-finance-api'];
    try {
        db()->query('SELECT 1');
        $payload['database'] = 'ok';
    } catch (Throwable $exception) {
        $payload['database'] = 'unavailable';
        $payload['status'] = 'degraded';
    }
    respond($payload);
});
