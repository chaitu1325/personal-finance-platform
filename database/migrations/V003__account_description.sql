-- Personal Finance Platform - optional account description
-- Safe for existing databases and fresh installations whose V001 already includes the column.

SET @account_description_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'accounts'
      AND COLUMN_NAME = 'description'
);

SET @account_description_migration = IF(
    @account_description_exists = 0,
    'ALTER TABLE accounts ADD COLUMN description VARCHAR(500) NULL AFTER institution',
    'SELECT 1'
);

PREPARE account_description_statement FROM @account_description_migration;
EXECUTE account_description_statement;
DEALLOCATE PREPARE account_description_statement;
