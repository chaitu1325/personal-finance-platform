<?php
declare(strict_types=1);

function respond(array $data = [], int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_SLASHES);
    exit;
}

function respond_error(
    string $code,
    string $message,
    int $status = 400,
    array $details = []
): never {
    http_response_code($status);
    echo json_encode([
        'success' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
            'details' => $details,
        ],
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

function handle_api_exception(Throwable $e): never
{
    error_log((string) $e);
    $message = app_config()['app_env'] === 'production'
        ? 'An internal error occurred'
        : $e->getMessage();
    respond_error('INTERNAL_ERROR', $message, 500);
}
