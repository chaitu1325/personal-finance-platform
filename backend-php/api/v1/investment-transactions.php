<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('investment_transactions', [
        'fields' => [
            'investment_id', 'transaction_type', 'trade_date', 'quantity', 'price', 'fees', 'notes',
        ],
        'required' => ['investment_id', 'transaction_type', 'trade_date', 'quantity', 'price'],
        'integer' => ['investment_id'],
        'decimal' => ['quantity', 'price', 'fees'],
        'enum' => ['transaction_type' => ['BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'OTHER']],
        'nullable' => ['fees', 'notes'],
        'references' => ['investment_id' => 'investments'],
        'auto_created_by' => true,
        'order_by' => 'trade_date DESC, id DESC',
    ]);
});
