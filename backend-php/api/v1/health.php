<?php
declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/lib/bootstrap.php';
require_once dirname(__DIR__, 3) . '/lib/response.php';

configure_http();

try {
    $database = 'unavailable';
    try {
        db()->query('SELECT 1');
        $database = 'up';
    } catch (Throwable) {
        // Health remains useful before database credentials are configured.
    }

    respond([
        'service' => 'personal-finance-api',
        'status' => 'up',
        'environment' => app_config()['app_env'],
        'database' => $database,
        'timestamp' => gmdate('c'),
    ]);
} catch (Throwable $e) {
    handle_api_exception($e);
}
