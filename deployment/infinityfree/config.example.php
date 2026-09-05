<?php
declare(strict_types=1);

/*
 * On InfinityFree, copy this file to htdocs/config/config.php and replace
 * every placeholder. Never commit or upload real credentials to GitHub.
 */
return [
    'app_env' => 'production',
    'cors_origin' => 'https://YOUR_INFINITYFREE_DOMAIN',
    'db' => [
        'host' => 'sqlXXX.infinityfree.com',
        'port' => '3306',
        'name' => 'if0_XXXXXXXX_personal_finance',
        'user' => 'if0_XXXXXXXX',
        'password' => 'REPLACE_WITH_DATABASE_PASSWORD',
        'charset' => 'utf8mb4',
    ],
    'jwt_secret' => 'REPLACE_WITH_AT_LEAST_64_RANDOM_CHARACTERS',
    'jwt_ttl_seconds' => 3600,
];
