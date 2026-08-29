<?php
declare(strict_types=1);

function request_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }

    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        require_once __DIR__ . '/response.php';
        respond_error('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    if (!is_array($data)) {
        require_once __DIR__ . '/response.php';
        respond_error('INVALID_BODY', 'Request body must be a JSON object', 400);
    }

    return $data;
}

function required_string(array $data, string $key, int $maxLength = 255): string
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '' || strlen($value) > $maxLength) {
        require_once __DIR__ . '/response.php';
        respond_error('VALIDATION_ERROR', $key . ' is required and must be within the allowed length', 422);
    }
    return $value;
}
