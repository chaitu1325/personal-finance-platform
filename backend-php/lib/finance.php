<?php
declare(strict_types=1);

function pf_atomic(callable $operation)
{
    $pdo = db();
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) $pdo->beginTransaction();
    try {
        $result = $operation();
        if ($ownsTransaction) $pdo->commit();
        return $result;
    } catch (Throwable $error) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function pf_validate_record(array $spec, array $values, array $user, ?int $id = null): void
{
    $familyId = (int) $user['family_id'];
    foreach ($spec['references'] ?? [] as $field => $reference) {
        pf_assert_reference($familyId, $field, $values[$field] ?? null, $reference);
    }
    foreach ([['period_start', 'period_end'], ['start_date', 'end_date'], ['next_run_date', 'end_date'], ['transaction_date', 'end_date']] as [$start, $end]) {
        if ($start === 'next_run_date' && isset($values['is_active']) && (int) $values['is_active'] === 0) continue;
        if (!empty($values[$start]) && !empty($values[$end]) && $values[$end] < $values[$start]) {
            throw new ValidationException($end . ' cannot be before ' . $start);
        }
    }
    if ($spec['table'] === 'categories') {
        $duplicate = db()->prepare('SELECT id FROM categories WHERE family_id = ? AND name = ? AND category_type = ? AND id <> ?');
        $duplicate->execute([$familyId, $values['name'], $values['category_type'], $id ?? 0]);
        if ($duplicate->fetchColumn()) throw new ValidationException('A category with this name and type already exists');
        if ($id !== null) {
            foreach (['transactions', 'recurring_transactions'] as $table) {
                $used = db()->prepare('SELECT id FROM ' . $table . ' WHERE family_id = ? AND category_id = ? AND transaction_type <> ? LIMIT 1');
                $used->execute([$familyId, $id, $values['category_type']]);
                if ($used->fetchColumn()) throw new ValidationException('Cannot change the type of a category used by transactions or schedules');
            }
        }
    }
    if (!in_array($spec['table'], ['transactions', 'recurring_transactions'], true)) return;
    $kind = $values['transaction_type'];
    if (!in_array($values['entry_type'] ?? 'OTHER', pf_entry_types()[$kind] ?? [], true)) {
        throw new ValidationException('entry_type does not match the income/expense direction');
    }
    if (!empty($values['category_id'])) {
        $category = db()->prepare('SELECT category_type FROM categories WHERE id = ? AND (family_id = ? OR family_id IS NULL)');
        $category->execute([$values['category_id'], $familyId]);
        if ($category->fetchColumn() !== $kind) throw new ValidationException('Category must match the income/expense direction');
    }
    if ($id === null || $spec['table'] === 'recurring_transactions') {
        $account = db()->prepare('SELECT status FROM accounts WHERE id = ? AND family_id = ?');
        $account->execute([$values['account_id'], $familyId]);
        if ($account->fetchColumn() !== 'ACTIVE' && ($values['is_active'] ?? 1)) {
            throw new ValidationException('Select an active account');
        }
    }
    if ($spec['table'] === 'transactions' && ($values['frequency'] ?? 'ONETIME') !== 'ONETIME'
        && !in_array($kind, ['INCOME', 'EXPENSE'], true)) {
        throw new ValidationException('Recurrence is supported for income and expense entries');
    }
}

function pf_insert_values(string $table, array $values, array $user, bool $createdBy): array
{
    $values['family_id'] = (int) $user['family_id'];
    if ($createdBy) $values['created_by'] = (int) $user['user_id'];
    $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', array_keys($values)) . ') VALUES ('
        . implode(', ', array_fill(0, count($values), '?')) . ')';
    pf_bind_and_execute(db()->prepare($sql), array_values($values));
    $fetch = db()->prepare('SELECT * FROM ' . $table . ' WHERE id = ? AND family_id = ?');
    $fetch->execute([(int) db()->lastInsertId(), $user['family_id']]);
    return $fetch->fetch();
}

function pf_create_record(array $spec, array $input, array $user): array
{
    $values = pf_normalize_values($input, $spec);
    pf_validate_record($spec, $values, $user);
    if ($spec['table'] === 'transactions') {
        $endDate = $values['end_date'] ?? null;
        unset($values['end_date']);
        $frequency = $values['frequency'] ?? 'ONETIME';
        if ($frequency !== 'ONETIME') {
            $next = pf_next_occurrence($values['transaction_date'], $frequency, $values['transaction_date']);
            $schedule = array_intersect_key($values, array_flip(['account_id', 'person_id', 'category_id', 'transaction_type', 'entry_type', 'amount', 'description']));
            $schedule += ['frequency' => $frequency, 'start_date' => $values['transaction_date'],
                'next_run_date' => $next, 'end_date' => $endDate, 'is_active' => $endDate !== null && $next > $endDate ? 0 : 1];
            $created = pf_insert_values('recurring_transactions', $schedule, $user, true);
            $values['recurring_id'] = $created['id'];
        }
    }
    if ($spec['table'] === 'recurring_transactions') $values['start_date'] = $values['next_run_date'];
    return pf_insert_values($spec['table'], $values, $user, !empty($spec['auto_created_by']));
}

function pf_next_occurrence(string $current, string $frequency, string $anchor): string
{
    $date = new DateTimeImmutable($current);
    $start = new DateTimeImmutable($anchor);
    if ($frequency === 'DAILY') return $date->modify('+1 day')->format('Y-m-d');
    if ($frequency === 'WEEKLY') return $date->modify('+7 days')->format('Y-m-d');
    if ($frequency === 'MONTHLY') {
        $month = $date->modify('first day of next month');
    } elseif ($frequency === 'YEARLY') {
        $month = $date->setDate((int) $date->format('Y') + 1, (int) $start->format('m'), 1);
    } else {
        throw new ValidationException('Unsupported recurring frequency');
    }
    return $month->setDate((int) $month->format('Y'), (int) $month->format('m'), min((int) $start->format('d'), (int) $month->format('t')))->format('Y-m-d');
}

function pf_process_recurring(array $user, string $today, int $limit = 200): array
{
    return pf_atomic(function () use ($user, $today, $limit) {
        // Serialise processing and imports for one family; other families remain independent.
        $lock = db()->prepare('SELECT id FROM families WHERE id = ? FOR UPDATE');
        $lock->execute([$user['family_id']]);
        $select = db()->prepare('SELECT * FROM recurring_transactions WHERE family_id = ? AND is_active = 1 AND next_run_date <= ? ORDER BY next_run_date, id LIMIT 200 FOR UPDATE');
        $select->execute([$user['family_id'], $today]);
        $created = 0;
        $attempts = 0;
        $skipped = [];
        foreach ($select->fetchAll() as $schedule) {
            if ($attempts >= $limit) break;
            if (!empty($schedule['end_date']) && $schedule['next_run_date'] > $schedule['end_date']) {
                db()->prepare('UPDATE recurring_transactions SET is_active = 0 WHERE id = ? AND family_id = ?')->execute([$schedule['id'], $user['family_id']]);
                continue;
            }
            try {
                pf_validate_record(pf_resource_specs()['recurring-transactions'], $schedule, $user, (int) $schedule['id']);
            } catch (ValidationException $error) {
                $skipped[] = ['id' => $schedule['id'], 'message' => $error->getMessage()];
                continue;
            }
            $due = $schedule['next_run_date'];
            $active = 1;
            while ($due <= $today && $attempts < $limit && (empty($schedule['end_date']) || $due <= $schedule['end_date'])) {
                $attempts++;
                $exists = db()->prepare('SELECT id FROM transactions WHERE recurring_id = ? AND transaction_date = ? AND family_id = ?');
                $exists->execute([$schedule['id'], $due, $user['family_id']]);
                if (!$exists->fetchColumn()) {
                    $values = array_intersect_key($schedule, array_flip(['account_id', 'person_id', 'category_id', 'transaction_type', 'entry_type', 'amount', 'description', 'frequency']));
                    $values += ['recurring_id' => $schedule['id'], 'transaction_date' => $due];
                    pf_insert_values('transactions', $values, $user, true);
                    $created++;
                }
                if ($schedule['frequency'] === 'ONETIME') { $active = 0; break; }
                $due = pf_next_occurrence($due, $schedule['frequency'], $schedule['start_date'] ?: $schedule['next_run_date']);
            }
            if (!empty($schedule['end_date']) && $due > $schedule['end_date']) $active = 0;
            db()->prepare('UPDATE recurring_transactions SET next_run_date = ?, is_active = ? WHERE id = ? AND family_id = ?')->execute([$due, $active, $schedule['id'], $user['family_id']]);
        }
        $pending = db()->prepare('SELECT COUNT(*) FROM recurring_transactions WHERE family_id = ? AND is_active = 1 AND next_run_date <= ?');
        $pending->execute([$user['family_id'], $today]);
        return ['created' => $created, 'pending_schedules' => (int) $pending->fetchColumn(), 'skipped' => $skipped, 'through' => $today];
    });
}
