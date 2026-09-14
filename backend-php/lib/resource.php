<?php
declare(strict_types=1);

function pf_validate_field(string $field, $value, array $spec)
{
    $rule = $spec['columns'][$field] ?? [];
    if (is_string($value)) $value = trim($value);
    if (($value === '' || $value === null) && !empty($rule['nullable'])) return null;
    if ($value === '' && array_key_exists('default', $rule)) $value = $rule['default'];
    if ($value === null && isset($rule['nullable']) && !$rule['nullable']) {
        throw new ValidationException($field . ' cannot be null');
    }
    if ($value === null) return null;
    if (is_array($value) || is_object($value) || is_bool($value)) {
        throw new ValidationException($field . ' must be a scalar value');
    }
    if (isset($spec['enum'][$field])) {
        $value = strtoupper((string) $value);
        if (!in_array($value, $spec['enum'][$field], true)) {
            throw new ValidationException('Invalid value for ' . $field);
        }
    }
    $type = $rule['type'] ?? 'text';
    if (in_array($field, $spec['integer'] ?? [], true) || $type === 'integer') {
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            throw new ValidationException($field . ' must be an integer');
        }
        $integer = (int) $value;
        if ($integer < ($rule['min'] ?? PHP_INT_MIN) || (str_ends_with($field, '_id') && $integer < 1)
            || ($field === 'is_active' && !in_array($integer, [0, 1], true))) {
            throw new ValidationException('Invalid value for ' . $field);
        }
        return $integer;
    }
    if (in_array($field, $spec['decimal'] ?? [], true) || $type === 'decimal') {
        $number = (string) $value;
        $scale = (int) ($rule['scale'] ?? 4);
        $precision = (int) ($rule['precision'] ?? 19);
        if (!preg_match('/^(-?)([0-9]+)(?:\\.([0-9]+))?$/D', $number, $parts)
            || strlen(ltrim($parts[2], '0')) > $precision - $scale
            || strlen($parts[3] ?? '') > $scale) {
            throw new ValidationException($field . ' must be a decimal with at most ' . $scale . ' decimal places');
        }
        if ($parts[1] === '-' && !in_array($field, $spec['allow_negative'] ?? [], true)) {
            throw new ValidationException($field . ' cannot be negative');
        }
        // Do not round financial values through a floating-point number.
        return $parts[1] . (ltrim($parts[2], '0') ?: '0') . '.' . str_pad($parts[3] ?? '', $scale, '0');
    }
    if ($type === 'date') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new ValidationException($field . ' must be a valid YYYY-MM-DD date');
        }
    }
    if ($field === 'currency') {
        $value = strtoupper((string) $value);
        if (!preg_match('/^[A-Z]{3}$/D', $value)) throw new ValidationException('currency must be a 3-letter code');
    }
    if (isset($rule['maxLength']) && preg_match_all('/./us', (string) $value) > $rule['maxLength']) {
        throw new ValidationException($field . ' is too long (maximum ' . $rule['maxLength'] . ')');
    }
    return $value;
}

function pf_normalize_values(array $input, array $spec, bool $partial = false): array
{
    $values = [];
    foreach ($spec['fields'] as $field) {
        if (array_key_exists($field, $input)) {
            $values[$field] = pf_validate_field($field, $input[$field], $spec);
        } elseif (!$partial && array_key_exists('default', $spec['columns'][$field] ?? [])) {
            $values[$field] = pf_validate_field($field, $spec['columns'][$field]['default'], $spec);
        }
    }
    foreach ($spec['required'] ?? [] as $field) {
        if ((!$partial || array_key_exists($field, $values)) && (!isset($values[$field]) || $values[$field] === '')) {
            throw new ValidationException($field . ' is required');
        }
    }
    return $values;
}

function pf_assert_reference(int $familyId, string $field, $value, $reference): void
{
    if ($value === null || $value === '') {
        return;
    }
    $table = is_array($reference) ? (string) ($reference['table'] ?? '') : (string) $reference;
    $allowGlobal = is_array($reference) && !empty($reference['allow_global']);
    if (!preg_match('/^[a-z_]+$/', $table)) {
        throw new InvalidArgumentException('Invalid reference configuration');
    }
    $sql = 'SELECT id FROM ' . $table . ' WHERE id = ? AND family_id = ? LIMIT 1';
    if ($allowGlobal) {
        $sql = 'SELECT id FROM ' . $table . ' WHERE id = ? AND (family_id = ? OR family_id IS NULL) LIMIT 1';
    }
    $statement = db()->prepare($sql);
    $statement->execute([(int) $value, $familyId]);
    if (!$statement->fetchColumn()) {
        throw new ValidationException('Referenced ' . $field . ' was not found in this family');
    }
}

function pf_request_id(array $input = []): int
{
    $candidate = $_GET['id'] ?? ($input['id'] ?? null);
    if (filter_var($candidate, FILTER_VALIDATE_INT) === false || (int) $candidate < 1) {
        respond_error('A valid id is required', 422);
    }
    return (int) $candidate;
}

function pf_bind_and_execute(PDOStatement $statement, array $params): void
{
    foreach (array_values($params) as $index => $value) {
        $type = $value === null ? PDO::PARAM_NULL : (is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        $statement->bindValue($index + 1, $value, $type);
    }
    $statement->execute();
}

function resource_endpoint(string $table, array $spec): void
{
    if (!preg_match('/^[a-z_]+$/', $table)) {
        throw new InvalidArgumentException('Invalid resource table');
    }
    $user = require_auth();
    $familyId = (int) $user['family_id'];
    $userId = (int) $user['user_id'];
    $fields = array_values($spec['fields'] ?? []);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $pdo = db();

    if ($method === 'GET') {
        $where = [];
        $params = [];
        if (!empty($spec['include_global'])) {
            $where[] = '(family_id = ? OR family_id IS NULL)';
        } else {
            $where[] = 'family_id = ?';
        }
        $params[] = $familyId;
        foreach (($spec['filters'] ?? []) as $queryKey => $column) {
            $value = $_GET[$queryKey] ?? null;
            if ($value !== null && $value !== '') {
                if (!preg_match('/^[a-z_]+$/', (string) $column)) {
                    throw new InvalidArgumentException('Invalid filter configuration');
                }
                $where[] = $column . ' = ?';
                $params[] = pf_validate_field((string) $column, $value, $spec);
            }
        }
        foreach (($spec['ranges'] ?? []) as $queryKey => $range) {
            $value = $_GET[$queryKey] ?? null;
            if ($value !== null && $value !== '') {
                $column = (string) ($range['column'] ?? '');
                $operator = (string) ($range['operator'] ?? '>=');
                if (!preg_match('/^[a-z_]+$/', $column) || !in_array($operator, ['>=', '<=', '>', '<'], true)) {
                    throw new InvalidArgumentException('Invalid range configuration');
                }
                $where[] = $column . ' ' . $operator . ' ?';
                $params[] = pf_validate_field($column, $value, $spec);
            }
        }
        if (!empty($_GET['from']) && !empty($_GET['to']) && $_GET['to'] < $_GET['from']) {
            throw new ValidationException('to must not be before from');
        }
        $id = $_GET['id'] ?? null;
        if ($id !== null && $id !== '') {
            if (filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id < 1) {
                respond_error('A valid id is required', 422);
            }
            $where[] = 'id = ?';
            $params[] = (int) $id;
        }
        $whereSql = implode(' AND ', $where);
        $orderBy = (string) ($spec['order_by'] ?? 'id DESC');
        if (!preg_match('/^[a-z_, ]+( ASC| DESC)?$/i', $orderBy)) {
            $orderBy = 'id DESC';
        }
        if ($id !== null && $id !== '') {
            $statement = $pdo->prepare('SELECT * FROM ' . $table . ' WHERE ' . $whereSql . ' LIMIT 1');
            pf_bind_and_execute($statement, $params);
            $row = $statement->fetch();
            if (!is_array($row)) {
                respond_error('Resource not found', 404);
            }
            respond($row);
        }
        $limit = min(max((int) ($_GET['limit'] ?? 50), 1), 100);
        $offset = max((int) ($_GET['offset'] ?? 0), 0);
        $countStatement = $pdo->prepare('SELECT COUNT(*) FROM ' . $table . ' WHERE ' . $whereSql);
        pf_bind_and_execute($countStatement, $params);
        $total = (int) $countStatement->fetchColumn();
        $sql = 'SELECT * FROM ' . $table . ' WHERE ' . $whereSql . ' ORDER BY ' . $orderBy
            . ' LIMIT ' . $limit . ' OFFSET ' . $offset;
        $statement = $pdo->prepare($sql);
        pf_bind_and_execute($statement, $params);
        respond([
            'items' => $statement->fetchAll(),
            'meta' => ['limit' => $limit, 'offset' => $offset, 'total' => $total],
        ]);
    }

    if ($method === 'POST') {
        $created = pf_atomic(function () use ($spec, $user) {
            return pf_create_record($spec, request_json(), $user);
        });
        respond($created, 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        $input = request_json();
        $id = pf_request_id($input);
        $row = pf_atomic(function () use ($spec, $table, $input, $id, $familyId, $user) {
            $fetch = db()->prepare('SELECT * FROM ' . $table . ' WHERE id = ? AND family_id = ? FOR UPDATE');
            $fetch->execute([$id, $familyId]);
            $existing = $fetch->fetch();
            if (!$existing) throw new ValidationException('Resource not found in this family');
            $values = pf_normalize_values($input, $spec, true);
            if (!$values) throw new ValidationException('At least one field is required');
            if ($table === 'transactions') {
                if (isset($values['frequency']) && $values['frequency'] !== $existing['frequency']) {
                    throw new ValidationException('Change future recurrence in Recurring schedules, not a posted transaction');
                }
                unset($values['end_date']);
            }
            if (!$values) throw new ValidationException('At least one editable field is required');
            $effective = array_replace($existing, $values);
            pf_validate_record($spec, $effective, $user, $id);
            if ($table === 'recurring_transactions' && ($effective['next_run_date'] !== $existing['next_run_date'] || $effective['frequency'] !== $existing['frequency'])) {
                $values['start_date'] = $effective['next_run_date'];
            }
            $assignments = array_map(static fn($field) => $field . ' = ?', array_keys($values));
            $update = db()->prepare('UPDATE ' . $table . ' SET ' . implode(', ', $assignments) . ' WHERE id = ? AND family_id = ?');
            pf_bind_and_execute($update, array_merge(array_values($values), [$id, $familyId]));
            $fetch->execute([$id, $familyId]);
            return $fetch->fetch();
        });
        respond($row);
    }

    if ($method === 'DELETE') {
        $input = request_json();
        $id = pf_request_id($input);
        $statement = $pdo->prepare('DELETE FROM ' . $table . ' WHERE id = ? AND family_id = ?');
        $statement->execute([$id, $familyId]);
        if ($statement->rowCount() < 1) {
            respond_error('Resource not found', 404);
        }
        respond(['id' => $id, 'deleted' => true]);
    }

    respond_error('Method not allowed', 405);
}
