<?php
declare(strict_types=1);

/*
 * Copy this file to config.php on a deployment target.
 * Never commit config.php or real credentials.
 */
return [
    'app_env' => 'development',
    'cors_origin' => 'http://localhost:5173',
    'db' => [
        'host' => '127.0.0.1',
        'port' => '3306',
        'name' => 'personal_finance',
        'user' => 'personal_finance_user',
        'password' => 'change-me',
        'charset' => 'utf8mb4',
    ],
    'jwt_secret' => 'replace-with-a-long-random-secret',
    'jwt_ttl_seconds' => 3600,
];
