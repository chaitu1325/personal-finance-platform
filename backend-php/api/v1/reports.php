<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';

function pf_report_date(string $value, string $fallback): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1 ? $value : $fallback;
}

api_run(function (): void {
    $user = require_auth();
    require_method('GET');
    $familyId = (int) $user['family_id'];
    $from = pf_report_date((string) ($_GET['from'] ?? ''), date('Y-01-01'));
    $to = pf_report_date((string) ($_GET['to'] ?? ''), date('Y-m-d'));
    $type = strtolower((string) ($_GET['type'] ?? 'cashflow'));
    $pdo = db();

    if ($type === 'cashflow') {
        $statement = $pdo->prepare(
            'SELECT DATE_FORMAT(transaction_date, \'%Y-%m\') AS period,
                    COALESCE(SUM(CASE WHEN transaction_type = \'INCOME\' THEN amount ELSE 0 END), 0) AS income,
                    COALESCE(SUM(CASE WHEN transaction_type = \'EXPENSE\' THEN amount ELSE 0 END), 0) AS expenses
             FROM transactions
             WHERE family_id = ? AND transaction_date BETWEEN ? AND ?
             GROUP BY DATE_FORMAT(transaction_date, \'%Y-%m\')
             ORDER BY period'
        );
        $statement->execute([$familyId, $from, $to]);
        respond(['type' => $type, 'period' => ['from' => $from, 'to' => $to], 'items' => $statement->fetchAll()]);
    }

    if ($type === 'spending') {
        $statement = $pdo->prepare(
            'SELECT COALESCE(c.name, \'Uncategorised\') AS category,
                    COALESCE(SUM(t.amount), 0) AS amount, COUNT(*) AS transaction_count
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.family_id = ? AND t.transaction_type = \'EXPENSE\'
                   AND t.transaction_date BETWEEN ? AND ?
             GROUP BY c.name ORDER BY amount DESC'
        );
        $statement->execute([$familyId, $from, $to]);
        respond(['type' => $type, 'period' => ['from' => $from, 'to' => $to], 'items' => $statement->fetchAll()]);
    }

    if ($type === 'net-worth') {
        $asset = $pdo->prepare('SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE family_id = ? AND status <> \'DISPOSED\'');
        $asset->execute([$familyId]);
        $assets = (float) $asset->fetchColumn();
        $property = $pdo->prepare('SELECT COALESCE(SUM(current_value), 0) FROM properties WHERE family_id = ? AND status <> \'SOLD\'');
        $property->execute([$familyId]);
        $properties = (float) $property->fetchColumn();
        $investment = $pdo->prepare('SELECT COALESCE(SUM(quantity * current_price), 0) FROM investments WHERE family_id = ? AND status = \'ACTIVE\'');
        $investment->execute([$familyId]);
        $investments = (float) $investment->fetchColumn();
        $liability = $pdo->prepare('SELECT COALESCE(SUM(outstanding_amount), 0) FROM liabilities WHERE family_id = ? AND status NOT IN (\'PAID_OFF\', \'INACTIVE\')');
        $liability->execute([$familyId]);
        $liabilities = (float) $liability->fetchColumn();
        respond([
            'type' => $type,
            'as_of' => $to,
            'assets' => number_format($assets, 4, '.', ''),
            'properties' => number_format($properties, 4, '.', ''),
            'investments' => number_format($investments, 4, '.', ''),
            'liabilities' => number_format($liabilities, 4, '.', ''),
            'total' => number_format($assets + $properties + $investments - $liabilities, 4, '.', ''),
        ]);
    }

    respond_error('type must be cashflow, spending, or net-worth', 422);
});
