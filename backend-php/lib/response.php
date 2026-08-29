<?php
declare(strict_types=1);

function respond($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respond_error(string $codeOrMessage, $statusOrMessage = 400, $detailsOrStatus = []): void
{
    if (is_string($statusOrMessage)) {
        $code = strtoupper(str_replace(' ', '_', $codeOrMessage));
        $message = $statusOrMessage;
        $status = is_int($detailsOrStatus) ? $detailsOrStatus : 400;
        $details = is_array($detailsOrStatus) ? $detailsOrStatus : [];
    } else {
        $message = $codeOrMessage;
        $status = is_int($statusOrMessage) ? $statusOrMessage : 400;
        $code = strtoupper(str_replace(' ', '_', $message));
        $details = is_array($detailsOrStatus) ? $detailsOrStatus : [];
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $error = ['code' => $code, 'message' => $message];
    if ($details !== []) {
        $error['details'] = $details;
    }
    echo json_encode(['error' => $error], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function handle_api_exception(Throwable $exception): void
{
    error_log((string) $exception);
    $environment = app_config()['app_env'] ?? 'development';
    $message = $environment === 'production' ? 'Internal server error' : $exception->getMessage();
    respond_error($message !== '' ? $message : 'Internal server error', 500);
}
