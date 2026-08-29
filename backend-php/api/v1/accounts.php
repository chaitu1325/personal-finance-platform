<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('accounts', [
        'fields' => ['name', 'account_type', 'institution', 'opening_balance', 'currency', 'status'],
        'required' => ['name', 'account_type'],
        'enum' => [
            'account_type' => ['CASH', 'BANK', 'CREDIT_CARD', 'WALLET', 'INVESTMENT', 'OTHER'],
            'status' => ['ACTIVE', 'INACTIVE'],
        ],
        'decimal' => ['opening_balance'],
        'allow_negative' => ['opening_balance'],
        'nullable' => ['institution', 'opening_balance', 'currency'],
        'order_by' => 'name ASC',
    ]);
});
