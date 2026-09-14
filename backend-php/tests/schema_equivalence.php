<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/bootstrap.php';

$config = app_config()['db'];
$upgraded = db();
$fresh = new PDO('mysql:host=' . $config['host'] . ';port=' . $config['port'] . ';dbname=personal_finance_fresh;charset=utf8mb4', $config['user'], $config['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$tables = $upgraded->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
$freshTables = $fresh->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
if ($tables !== $freshTables) throw new RuntimeException('Fresh and upgraded table lists differ');
// Index creation order and auto-increment counters are not schema differences.
$checks = [
    'columns' => 'SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, CHARACTER_SET_NAME, COLLATION_NAME, GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION',
    'indexes' => 'SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, COLLATION, SUB_PART, INDEX_TYPE, NULLABLE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX',
    'constraints' => 'SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, CONSTRAINT_NAME',
    'keys' => 'SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, ORDINAL_POSITION, POSITION_IN_UNIQUE_CONSTRAINT, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION',
    'references' => 'SELECT TABLE_NAME, CONSTRAINT_NAME, UNIQUE_CONSTRAINT_NAME, MATCH_OPTION, UPDATE_RULE, DELETE_RULE, REFERENCED_TABLE_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? ORDER BY TABLE_NAME, CONSTRAINT_NAME',
    'table options' => 'SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
];
foreach ($checks as $name => $sql) {
    $a = $upgraded->prepare($sql); $a->execute([$config['name']]);
    $b = $fresh->prepare($sql); $b->execute(['personal_finance_fresh']);
    $upgradedRows = $a->fetchAll(PDO::FETCH_ASSOC); $freshRows = $b->fetchAll(PDO::FETCH_ASSOC);
    if ($upgradedRows !== $freshRows) throw new RuntimeException('Schema mismatch: ' . $name . "\n" . json_encode(['upgraded' => $upgradedRows, 'fresh' => $freshRows], JSON_PRETTY_PRINT));
}
$query = 'SELECT name, category_type FROM categories WHERE family_id IS NULL ORDER BY category_type, name';
if ($upgraded->query($query)->fetchAll(PDO::FETCH_NUM) !== $fresh->query($query)->fetchAll(PDO::FETCH_NUM)) throw new RuntimeException('Category seeds differ');
$transaction = $upgraded->query("SELECT amount, entry_type, frequency, recurring_id FROM transactions WHERE reference_number = 'UPGRADE-FIXTURE'")->fetch(PDO::FETCH_ASSOC);
if ($transaction !== ['amount' => '321.1234', 'entry_type' => 'OTHER', 'frequency' => 'ONETIME', 'recurring_id' => null]) throw new RuntimeException('Existing transaction was not preserved');
$schedule = $upgraded->query("SELECT amount, entry_type, frequency, next_run_date, start_date FROM recurring_transactions WHERE description = 'UPGRADE-FIXTURE'")->fetch(PDO::FETCH_ASSOC);
if ($schedule !== ['amount' => '1234.5678', 'entry_type' => 'OTHER', 'frequency' => 'MONTHLY', 'next_run_date' => '2024-01-31', 'start_date' => '2024-01-31']) throw new RuntimeException('Existing recurrence was not backfilled correctly');
echo 'PASS: fresh and upgraded schemas match (columns, indexes, defaults, constraints, seed data)' . PHP_EOL;
echo 'PASS: existing finance records survive the upgrade and recurrence anchors are backfilled' . PHP_EOL;
