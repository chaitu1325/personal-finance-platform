<?php
declare(strict_types=1);

/*
 * Development router for php -S. Apache uses backend-php/.htaccess instead.
 * Return false for real static files so the built-in server can serve them.
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$documentPath = __DIR__ . $path;
if (is_file($documentPath)) {
    return false;
}

if (preg_match('#^/api/v1/(.+?)/?$#', $path, $matches) === 1) {
    $endpoint = __DIR__ . '/api/v1/' . $matches[1] . '.php';
    if (is_file($endpoint)) {
        require $endpoint;
        return true;
    }
}

return false;
