-- CI fixture for records written by the previous application version.
INSERT INTO users (email, password_hash, display_name) VALUES ('upgrade@example.test', 'not-a-login-hash', 'Upgrade fixture');
SET @fixture_user = LAST_INSERT_ID();
INSERT INTO families (owner_user_id, name) VALUES (@fixture_user, 'Upgrade fixture family');
SET @fixture_family = LAST_INSERT_ID();
INSERT INTO accounts (family_id, name, account_type, institution, description) VALUES (@fixture_family, 'Existing account', 'BANK', 'ICICI', 'Preserve existing account');
SET @fixture_account = LAST_INSERT_ID();
INSERT INTO transactions (family_id, account_id, transaction_type, amount, transaction_date, reference_number, created_by)
VALUES (@fixture_family, @fixture_account, 'EXPENSE', 321.1234, '2024-01-31', 'UPGRADE-FIXTURE', @fixture_user);
INSERT INTO recurring_transactions (family_id, account_id, transaction_type, amount, frequency, next_run_date, description, created_by)
VALUES (@fixture_family, @fixture_account, 'INCOME', 1234.5678, 'MONTHLY', '2024-01-31', 'UPGRADE-FIXTURE', @fixture_user);
