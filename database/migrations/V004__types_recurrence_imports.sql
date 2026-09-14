-- V004: classifications, executable recurrence and duplicate-safe CSV imports.
-- Select the target database first. Additive and safe to rerun; do not wrap MySQL DDL in a transaction.

SET @pf_ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'entry_type') = 0, 'ALTER TABLE transactions ADD COLUMN entry_type VARCHAR(40) NOT NULL DEFAULT ''OTHER''', 'SELECT 1');
PREPARE pf_stmt FROM @pf_ddl;
EXECUTE pf_stmt;
DEALLOCATE PREPARE pf_stmt;

SET @pf_ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'frequency') = 0, 'ALTER TABLE transactions ADD COLUMN frequency VARCHAR(20) NOT NULL DEFAULT ''ONETIME''', 'SELECT 1');
PREPARE pf_stmt FROM @pf_ddl;
EXECUTE pf_stmt;
DEALLOCATE PREPARE pf_stmt;

SET @pf_ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'recurring_id') = 0, 'ALTER TABLE transactions ADD COLUMN recurring_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE pf_stmt FROM @pf_ddl;
EXECUTE pf_stmt;
DEALLOCATE PREPARE pf_stmt;

SET @pf_ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recurring_transactions' AND COLUMN_NAME = 'entry_type') = 0, 'ALTER TABLE recurring_transactions ADD COLUMN entry_type VARCHAR(40) NOT NULL DEFAULT ''OTHER''', 'SELECT 1');
PREPARE pf_stmt FROM @pf_ddl;
EXECUTE pf_stmt;
DEALLOCATE PREPARE pf_stmt;

SET @pf_ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recurring_transactions' AND COLUMN_NAME = 'start_date') = 0, 'ALTER TABLE recurring_transactions ADD COLUMN start_date DATE NULL', 'SELECT 1');
PREPARE pf_stmt FROM @pf_ddl;
EXECUTE pf_stmt;
DEALLOCATE PREPARE pf_stmt;

SET @pf_ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND INDEX_NAME = 'uk_recurring_occurrence') = 0, 'ALTER TABLE transactions ADD UNIQUE KEY uk_recurring_occurrence (recurring_id, transaction_date)', 'SELECT 1');
PREPARE pf_stmt FROM @pf_ddl;
EXECUTE pf_stmt;
DEALLOCATE PREPARE pf_stmt;

UPDATE recurring_transactions SET start_date = next_run_date WHERE start_date IS NULL;

CREATE TABLE IF NOT EXISTS import_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    family_id BIGINT UNSIGNED NOT NULL,
    resource VARCHAR(60) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    row_count INT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_import_batch (family_id, resource, content_hash),
    CONSTRAINT fk_import_batch_family FOREIGN KEY (family_id) REFERENCES families (id) ON DELETE CASCADE,
    CONSTRAINT fk_import_batch_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared suggestions are read-only; family categories are added through the API.
INSERT INTO categories (family_id, name, category_type)
SELECT NULL, seeds.name, seeds.category_type FROM (
    SELECT 'Groceries' AS name, 'EXPENSE' AS category_type
    UNION ALL SELECT 'Housing', 'EXPENSE'
    UNION ALL SELECT 'Utilities', 'EXPENSE'
    UNION ALL SELECT 'Transport', 'EXPENSE'
    UNION ALL SELECT 'Health', 'EXPENSE'
    UNION ALL SELECT 'Education', 'EXPENSE'
    UNION ALL SELECT 'Entertainment', 'EXPENSE'
    UNION ALL SELECT 'Uncategorised', 'EXPENSE'
    UNION ALL SELECT 'Salary', 'INCOME'
    UNION ALL SELECT 'Rental', 'INCOME'
    UNION ALL SELECT 'Dividend', 'INCOME'
    UNION ALL SELECT 'Interest', 'INCOME'
    UNION ALL SELECT 'Other income', 'INCOME'
) seeds
WHERE NOT EXISTS (
    SELECT 1 FROM categories existing
    WHERE existing.family_id IS NULL AND existing.name = seeds.name
      AND existing.category_type = seeds.category_type
);
