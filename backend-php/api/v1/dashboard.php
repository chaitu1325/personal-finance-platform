<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

function pf_dashboard_date(string $value, string $fallback): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : $fallback;
}

api_run(function (): void {
    $user = require_auth();
    require_method('GET');
    $familyId = (int) $user['family_id'];
    $from = pf_dashboard_date((string) ($_GET['from'] ?? ''), date('Y-m-01'));
    $to = pf_dashboard_date((string) ($_GET['to'] ?? ''), date('Y-m-d'));
    $pdo = db();

    $summaryStatement = $pdo->prepare(
        'SELECT
            COALESCE(SUM(CASE WHEN transaction_type = \'INCOME\' THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN transaction_type = \'EXPENSE\' THEN amount ELSE 0 END), 0) AS expenses,
            COUNT(*) AS transaction_count
         FROM transactions
         WHERE family_id = ? AND transaction_date BETWEEN ? AND ?'
    );
    $summaryStatement->execute([$familyId, $from, $to]);
    $summary = $summaryStatement->fetch() ?: ['income' => '0.0000', 'expenses' => '0.0000', 'transaction_count' => 0];

    $accountStatement = $pdo->prepare(
        'SELECT a.id, a.name, a.account_type, a.currency,
                CAST(a.opening_balance + COALESCE(SUM(
                    CASE
                        WHEN t.transaction_type = \'INCOME\' THEN t.amount
                        WHEN t.transaction_type = \'EXPENSE\' THEN -t.amount
                        ELSE 0
                    END
                ), 0) AS DECIMAL(19,4)) AS balance
         FROM accounts a
         LEFT JOIN transactions t ON t.account_id = a.id AND t.family_id = a.family_id
         WHERE a.family_id = ? AND a.status = \'ACTIVE\'
         GROUP BY a.id, a.name, a.account_type, a.currency, a.opening_balance
         ORDER BY a.name'
    );
    $accountStatement->execute([$familyId]);

    $assetStatement = $pdo->prepare(
        'SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE family_id = ? AND status <> \'DISPOSED\''
    );
    $assetStatement->execute([$familyId]);
    $assets = (string) $assetStatement->fetchColumn();

    $propertyStatement = $pdo->prepare(
        'SELECT COALESCE(SUM(current_value), 0) FROM properties WHERE family_id = ? AND status <> \'SOLD\''
    );
    $propertyStatement->execute([$familyId]);
    $properties = (string) $propertyStatement->fetchColumn();

    $investmentStatement = $pdo->prepare(
        'SELECT COALESCE(SUM(quantity * current_price), 0) FROM investments
         WHERE family_id = ? AND status = \'ACTIVE\''
    );
    $investmentStatement->execute([$familyId]);
    $investments = (string) $investmentStatement->fetchColumn();

    $liabilityStatement = $pdo->prepare(
        'SELECT COALESCE(SUM(outstanding_amount), 0) FROM liabilities
         WHERE family_id = ? AND status NOT IN (\'PAID_OFF\', \'INACTIVE\')'
    );
    $liabilityStatement->execute([$familyId]);
    $liabilities = (string) $liabilityStatement->fetchColumn();

    $income = (float) $summary['income'];
    $expenses = (float) $summary['expenses'];
    $netWorth = (float) $assets + (float) $properties + (float) $investments - (float) $liabilities;
    respond([
        'period' => ['from' => $from, 'to' => $to],
        'summary' => [
            'income' => number_format($income, 4, '.', ''),
            'expenses' => number_format($expenses, 4, '.', ''),
            'net_cash_flow' => number_format($income - $expenses, 4, '.', ''),
            'transaction_count' => (int) $summary['transaction_count'],
        ],
        'net_worth' => [
            'assets' => number_format((float) $assets, 4, '.', ''),
            'properties' => number_format((float) $properties, 4, '.', ''),
            'investments' => number_format((float) $investments, 4, '.', ''),
            'liabilities' => number_format((float) $liabilities, 4, '.', ''),
            'total' => number_format($netWorth, 4, '.', ''),
        ],
        'accounts' => $accountStatement->fetchAll(),
    ]);
});
