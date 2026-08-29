<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

api_run(function (): void {
    resource_endpoint('asset_valuations', [
        'fields' => ['asset_id', 'valuation_date', 'value', 'notes'],
        'required' => ['asset_id', 'valuation_date', 'value'],
        'integer' => ['asset_id'],
        'decimal' => ['value'],
        'nullable' => ['notes'],
        'references' => ['asset_id' => 'assets'],
        'auto_created_by' => true,
        'order_by' => 'valuation_date DESC, id DESC',
    ]);
});
