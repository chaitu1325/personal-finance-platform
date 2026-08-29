<?php
declare(strict_types=1);

function app_config(): array
{
    static $config;
    if ($config !== null) {
        return $config;
    }

    $config = [
        'app_env' => getenv('APP_ENV') ?: 'development',
        'cors_origin' => getenv('CORS_ORIGIN') ?: '*',
        'db' => [
            'host' => getenv('DB_HOST') ?: '127.0.0.1',
            'port' => getenv('DB_PORT') ?: '3306',
            'name' => getenv('DB_NAME') ?: 'personal_finance',
            'user' => getenv('DB_USER') ?: '',
            'password' => getenv('DB_PASSWORD') ?: '',
            'charset' => 'utf8mb4',
        ],
        'jwt_secret' => getenv('JWT_SECRET') ?: '',
        'jwt_ttl_seconds' => (int) (getenv('JWT_TTL_SECONDS') ?: 3600),
    ];

    $file = dirname(__DIR__) . '/config/config.php';
    if (is_file($file)) {
        $fileConfig = require $file;
        if (is_array($fileConfig)) {
            $config = array_replace_recursive($config, $fileConfig);
        }
    }

    return $config;
}

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = app_config()['db'];
    if ($cfg['user'] === '') {
        throw new RuntimeException('Database credentials are not configured');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $cfg['host'],
        $cfg['port'],
        $cfg['name'],
        $cfg['charset']
    );

    $pdo = new PDO($dsn, $cfg['user'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function configure_http(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . app_config()['cors_origin']);
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function require_method(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        http_response_code(405);
        header('Allow: ' . $method);
        require_once __DIR__ . '/response.php';
        respond_error('METHOD_NOT_ALLOWED', 'HTTP method not supported', 405);
    }
}
