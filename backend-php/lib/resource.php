<?php
declare(strict_types=1);

function pf_validate_field(string $field, $value, array $spec)
{
    if ($value === '' && in_array($field, $spec['nullable'] ?? [], true)) {
        return null;
    }
    if ($value === null) {
        return null;
    }
    if (isset($spec['enum'][$field])
        && !in_array(strtoupper((string) $value), $spec['enum'][$field], true)) {
        respond_error('Invalid value for ' . $field, 422);
    }
    if (in_array($field, $spec['integer'] ?? [], true)) {
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            respond_error($field . ' must be an integer', 422);
        }
        return (int) $value;
    }
    if (in_array($field, $spec['decimal'] ?? [], true)) {
        if (!is_numeric($value)) {
            respond_error($field . ' must be numeric', 422);
        }
        if ((float) $value < 0 && !in_array($field, $spec['allow_negative'] ?? [], true)) {
            respond_error($field . ' cannot be negative', 422);
        }
        return number_format((float) $value, 4, '.', '');
    }
    if (in_array($field, $spec['json'] ?? [], true)) {
        if (is_string($value)) {
            json_decode($value, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                respond_error($field . ' must contain valid JSON', 422);
            }
            return $value;
        }
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            respond_error('Invalid JSON for ' . $field, 422);
        }
        return $encoded;
    }
    return is_string($value) ? trim($value) : $value;
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
        respond_error('Referenced ' . $field . ' was not found in this family', 422);
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
        $type = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
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
                $params[] = (string) $value;
            }
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
        $input = request_json();
        $values = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $input)) {
                $values[$field] = pf_validate_field($field, $input[$field], $spec);
            }
        }
        foreach (($spec['required'] ?? []) as $field) {
            if (!array_key_exists($field, $values) || $values[$field] === null || $values[$field] === '') {
                respond_error($field . ' is required', 422);
            }
        }
        foreach (($spec['references'] ?? []) as $field => $reference) {
            if (array_key_exists($field, $values)) {
                pf_assert_reference($familyId, (string) $field, $values[$field], $reference);
            }
        }
        $columns = ['family_id'];
        $params = [$familyId];
        foreach ($values as $field => $value) {
            $columns[] = $field;
            $params[] = $value;
        }
        if (!empty($spec['auto_created_by'])) {
            $columns[] = 'created_by';
            $params[] = $userId;
        }
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $statement = $pdo->prepare(
            'INSERT INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES (' . $placeholders . ')'
        );
        pf_bind_and_execute($statement, $params);
        $newId = (int) $pdo->lastInsertId();
        $fetch = $pdo->prepare('SELECT * FROM ' . $table . ' WHERE id = ? AND family_id = ? LIMIT 1');
        $fetch->execute([$newId, $familyId]);
        respond($fetch->fetch(), 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        $input = request_json();
        $id = pf_request_id($input);
        $values = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $input)) {
                $values[$field] = pf_validate_field($field, $input[$field], $spec);
            }
        }
        if ($values === []) {
            respond_error('At least one field is required', 422);
        }
        foreach (($spec['references'] ?? []) as $field => $reference) {
            if (array_key_exists($field, $values)) {
                pf_assert_reference($familyId, (string) $field, $values[$field], $reference);
            }
        }
        $assignments = [];
        $params = [];
        foreach ($values as $field => $value) {
            $assignments[] = $field . ' = ?';
            $params[] = $value;
        }
        $params[] = $id;
        $params[] = $familyId;
        $statement = $pdo->prepare(
            'UPDATE ' . $table . ' SET ' . implode(', ', $assignments)
            . ' WHERE id = ? AND family_id = ?'
        );
        pf_bind_and_execute($statement, $params);
        if ($statement->rowCount() < 1) {
            $check = $pdo->prepare('SELECT id FROM ' . $table . ' WHERE id = ? AND family_id = ?');
            $check->execute([$id, $familyId]);
            if (!$check->fetchColumn()) {
                respond_error('Resource not found', 404);
            }
        }
        $fetch = $pdo->prepare('SELECT * FROM ' . $table . ' WHERE id = ? AND family_id = ? LIMIT 1');
        $fetch->execute([$id, $familyId]);
        respond($fetch->fetch());
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
