<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/response.php';
require_once dirname(__DIR__) . '/lib/resource.php';
require_once dirname(__DIR__) . '/lib/resource-specs.php';
require_once dirname(__DIR__) . '/lib/finance.php';
require_once dirname(__DIR__) . '/lib/imports.php';

function check(bool $condition, string $name): void {
    if (!$condition) throw new RuntimeException('FAIL: ' . $name);
    echo 'PASS: ' . $name . PHP_EOL;
}
function rejects(callable $fn, string $name): void {
    try { $fn(); } catch (ValidationException $error) { check(true, $name); return; }
    throw new RuntimeException('Expected validation error: ' . $name);
}
check(pf_next_occurrence('2024-01-31', 'MONTHLY', '2024-01-31') === '2024-02-29', 'leap month end');
check(pf_next_occurrence('2024-02-29', 'MONTHLY', '2024-01-31') === '2024-03-31', 'month end returns to original day');
check(pf_next_occurrence('2024-02-29', 'YEARLY', '2024-02-29') === '2025-02-28', 'yearly leap clamp');
check(pf_next_occurrence('2027-02-28', 'YEARLY', '2024-02-29') === '2028-02-29', 'leap anniversary restored');
check(pf_next_occurrence('2025-12-29', 'WEEKLY', '2025-12-29') === '2026-01-05', 'weekly year boundary');
check(pf_next_occurrence('2025-12-31', 'DAILY', '2025-12-31') === '2026-01-01', 'legacy daily schedules');
$spec = pf_resource_specs()['transactions'];
check(pf_validate_field('amount', '123456789012345.1234', $spec) === '123456789012345.1234', 'decimal precision is preserved');
rejects(fn() => pf_validate_field('amount', '1e20', $spec), 'reject exponent overflow');
rejects(fn() => pf_validate_field('amount', '1.12345', $spec), 'reject excess decimal places');
rejects(fn() => pf_validate_field('amount', '-1', $spec), 'reject negative expenses');
rejects(fn() => pf_validate_field('amount', null, $spec), 'reject null amount');
rejects(fn() => pf_validate_field('transaction_date', '2026-02-30', $spec), 'reject invalid dates');
rejects(fn() => pf_validate_field('account_id', 0, $spec), 'reject invalid references');
rejects(fn() => pf_validate_field('entry_type', [], $spec), 'reject structured scalar');
check(pf_validate_field('entry_type', ' salary ', $spec) === 'SALARY', 'normalise enum case');
check(pf_validate_field('description', '', $spec) === null, 'optional empty description');
rejects(fn() => pf_normalize_values(['name' => ' '], pf_resource_specs()['accounts']), 'required fields on create');
$rows = pf_csv_parse("\xEF\xBB\xBFname,description\r\nCash,\"line 1\nline 2, \"\"quoted\"\"\"\r\n");
check($rows[1][1] === "line 1\nline 2, \"quoted\"", 'CSV BOM, CRLF, quotes, embedded newline');
rejects(fn() => pf_csv_parse("a,b\n\"unclosed,b"), 'reject unclosed quotes');
rejects(fn() => pf_csv_parse("a,b\na\"b,c"), 'reject illegal quotes');
rejects(fn() => pf_csv_parse("a\n" . str_repeat("x\n", 201)), 'reject over 200 rows');
rejects(fn() => pf_csv_parse(str_repeat('x', 1000001)), 'reject over 1 MB');
rejects(fn() => pf_import_rows("name,name\nx,y", pf_resource_specs()['accounts']), 'reject duplicate headers');
rejects(fn() => pf_import_rows("name,account_type,family_id\nCash,CASH,1", pf_resource_specs()['accounts']), 'reject family override');
rejects(fn() => pf_import_rows("name,account_type\nCash,CASH,extra", pf_resource_specs()['accounts']), 'reject column mismatch');
foreach (pf_resource_specs() as $key => $resource) {
    $rows = pf_import_rows(pf_csv_template($resource), $resource);
    check(count($rows) === 1, 'sample template headers for ' . $key);
    foreach ($resource['fields'] as $field) check(isset($resource['columns'][$field]), 'column metadata ' . $key . '.' . $field);
}
