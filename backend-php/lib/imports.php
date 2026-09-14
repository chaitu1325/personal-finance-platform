<?php
declare(strict_types=1);

const PF_IMPORT_MAX_BYTES = 1000000;
const PF_IMPORT_MAX_ROWS = 200;

function pf_csv_parse(string $csv): array
{
    if (strlen($csv) > PF_IMPORT_MAX_BYTES) throw new ValidationException('CSV exceeds the 1 MB limit');
    if (!preg_match('//u', $csv) || str_contains($csv, "\0")) throw new ValidationException('CSV must be UTF-8 text');
    $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
    $rows = [];
    $row = [];
    $field = '';
    $quoted = false;
    $closed = false;
    $length = strlen($csv);
    for ($i = 0; $i < $length; $i++) {
        $char = $csv[$i];
        if ($quoted) {
            if ($char === '"') {
                if ($i + 1 < $length && $csv[$i + 1] === '"') { $field .= '"'; $i++; }
                else { $quoted = false; $closed = true; }
            } else $field .= $char;
            continue;
        }
        if ($char === ',' || $char === "\r" || $char === "\n") {
            $row[] = $field;
            $field = '';
            $closed = false;
            if ($char !== ',') {
                if ($char === "\r" && $i + 1 < $length && $csv[$i + 1] === "\n") $i++;
                $rows[] = $row;
                $row = [];
                if (count($rows) > PF_IMPORT_MAX_ROWS + 1) throw new ValidationException('CSV exceeds the 200-row limit');
            }
        } elseif ($char === '"' && $field === '' && !$closed) {
            $quoted = true;
        } else {
            if ($closed || $char === '"') throw new ValidationException('Malformed CSV quoting');
            $field .= $char;
        }
    }
    if ($quoted) throw new ValidationException('Unclosed quoted CSV field');
    if ($field !== '' || $row !== [] || $closed) { $row[] = $field; $rows[] = $row; }
    if (count($rows) < 2 || count($rows) > PF_IMPORT_MAX_ROWS + 1) throw new ValidationException('CSV must contain a header and 1–200 data rows');
    return $rows;
}

function pf_import_rows(string $csv, array $spec): array
{
    $rows = pf_csv_parse($csv);
    $headers = array_map('trim', array_shift($rows));
    if (count($headers) !== count(array_unique($headers))) throw new ValidationException('Duplicate CSV headers');
    $unknown = array_diff($headers, $spec['fields']);
    if ($unknown) throw new ValidationException('Unknown CSV columns: ' . implode(', ', $unknown));
    $missing = array_diff($spec['required'], $headers);
    if ($missing) throw new ValidationException('Missing required CSV columns: ' . implode(', ', $missing));
    $mapped = [];
    foreach ($rows as $index => $row) {
        if (count($row) !== count($headers)) throw new ValidationException('Row ' . ($index + 2) . ' has a different column count');
        $values = array_combine($headers, $row);
        // Empty optional cells mean omitted/default. Required cells still go through validation.
        foreach ($values as $key => $value) {
            if (trim($value) === '' && !in_array($key, $spec['required'], true)) unset($values[$key]);
        }
        $mapped[] = $values;
    }
    return $mapped;
}

function pf_import_validate(array $rows, array $spec, array $user): array
{
    $valid = [];
    $errors = [];
    foreach ($rows as $index => $row) {
        try {
            $values = pf_normalize_values($row, $spec);
            pf_validate_record($spec, $values, $user);
            $valid[] = $values;
        } catch (ValidationException $error) {
            $errors[] = ['row' => $index + 2, 'message' => $error->getMessage()];
        }
    }
    return ['valid' => !$errors, 'row_count' => count($rows), 'preview' => array_slice($valid, 0, 5), 'errors' => $errors];
}

function pf_csv_template(array $spec, string $direction = 'INCOME'): string
{
    $values = [];
    foreach ($spec['fields'] as $field) {
        $rule = $spec['columns'][$field] ?? [];
        $required = in_array($field, $spec['required'], true);
        $value = $rule['default'] ?? '';
        if ($required) {
            if (isset($spec['references'][$field])) $value = strtoupper($field);
            elseif (isset($spec['enum'][$field])) $value = $spec['enum'][$field][0];
            elseif (($rule['type'] ?? '') === 'date') $value = '2026-09-01';
            elseif (($rule['type'] ?? '') === 'decimal') $value = '100.00';
            else $value = 'Sample ' . str_replace('_', ' ', $field);
        }
        if (in_array($spec['table'], ['transactions', 'recurring_transactions'], true)) {
            if ($field === 'transaction_type') $value = $direction;
            if ($field === 'entry_type') $value = $direction === 'EXPENSE' ? 'BILL' : 'SALARY';
            if ($field === 'frequency') $value = $spec['table'] === 'transactions' ? 'ONETIME' : 'MONTHLY';
            if ($field === 'category_id') $value = 'CATEGORY_ID';
        }
        if ($spec['table'] === 'categories' && $field === 'category_type') $value = 'EXPENSE';
        if ($spec['table'] === 'accounts' && $field === 'institution') $value = 'SBI';
        $values[] = $value;
    }
    $stream = fopen('php://temp', 'w+');
    fputcsv($stream, $spec['fields'], ',', '"', '');
    fputcsv($stream, $values, ',', '"', '');
    rewind($stream);
    $csv = stream_get_contents($stream);
    fclose($stream);
    return $csv;
}
