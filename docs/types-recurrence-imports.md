# Income, expenses, recurrence and bulk imports

## Delivered behavior

Web and Android/iOS clients use the authenticated `/catalog` metadata and the
same form/selection helpers. Both can create and edit income/expenses, choose
categories, manage recurring schedules, analyse spending, import CSV files and
download or share sample templates. All 18 writable record types have forms
and CSV imports, including accounts, family people, rental records, investments,
assets, liabilities, budgets and goals. Authentication and family membership
administration are not bulk-import resources.

| Field | Values / behavior |
| --- | --- |
| Income type | Salary, rental, dividend, interest, business, bonus, gift, other |
| Expense type | Purchase, bill, rent, EMI, subscription, tax, insurance, other |
| Recurrence | One-time, weekly, monthly, yearly; existing daily schedules remain supported |
| Expense category | Shared suggestions or a category created by the family; editable in Categories |
| Analysis | Recorded expenses grouped by category or expense type, filtered by dates, with currencies kept separate |
| Account bank / description | Optional; existing SBI/ICICI-style bank names continue to work |

An entry type describes a payment, while a category groups its purpose: for
example, a monthly **Bill** can belong to **Utilities**. Custom category names
are unique within a family and direction. Shared suggestions are read-only.
Category choices match the entry direction. Categories remain optional for
backward compatibility; entries without one appear as Uncategorised in reports.

## Normal entry workflow

1. Create an active account in **Accounts**, optionally adding bank and description.
2. In **Categories**, add any additional income or expense categories.
3. Open **Income & expenses → Add record**. Choose the account, direction, type,
   category, amount and date. Optional family person, description and reference
   number can also be supplied.
4. Select the recurrence and optional inclusive end date, then save.
5. Use **Expense analysis** for date/category/type totals. Edit recorded entries
   from their record cards. Edit future amounts, pause or change schedule dates
   in **Recurring schedules**.

Changing a posted transaction does not change its schedule. Changing a schedule
affects future processing, not existing entries. An account must be active for
new entries; if it becomes inactive, its schedules are skipped with a message.

## Recurrence rules and execution

- Saving a recurring income/expense records the entered occurrence immediately
  and creates a linked schedule whose next date follows the entered date.
  To schedule a future first entry without recording it yet, create it directly
  in **Recurring schedules**.
- **Process due entries** posts due dates through the current **UTC** date for
  the signed-in family. It creates accounting records, not bank payments.
- On hosts with PHP CLI/cron, deploy `backend-php/bin` alongside its `lib` and
  private `config` directories outside the web document root, then schedule:

  ```cron
  15 1 * * * /usr/bin/php /srv/personal-finance/backend-php/bin/process-recurring.php >> /srv/personal-finance/recurring.log 2>&1
  ```

  Configure the same database using the private config file or service
  environment, restrict log access, and select an absolute path matching the
  server. This job processes all families; it has no unauthenticated HTTP route.
  Hosting setup is separate from this PR. Without cron or manual processing,
  dates remain pending and no automatic entries are posted.
- Weekly repeats every seven days. Monthly repeats preserve the original day,
  clamping to month end (31 January → 29 February → 31 March in a leap year).
  Yearly 29 February repeats on 28 February in non-leap years and returns to
  29 February in leap years. End dates are inclusive; completed schedules pause.
- Processing locks the family and enforces a unique schedule/date key. Repeating
  the request does not duplicate already posted occurrences. Each invocation
  processes at most 200 occurrences per family. Run again if `pending_schedules`
  is nonzero; fix any reported skipped schedules. Long backlogs may require
  several runs.
- Deleting a schedule through the existing API leaves its posted transactions
  intact. Pausing it from the app is preferable when retaining its settings.

## CSV upload and samples

Open **Bulk upload / sample CSV** in any module. Web downloads a sample; mobile
opens the native share/save sheet. Income/expense modules also offer an expense
sample. Choose a file, validate it, review the first five rows and row errors,
then confirm the import. The server validates again before committing.

- Format: UTF-8 CSV (BOM accepted), comma-separated, with quoted fields for
  commas/newlines. Maximum 1,000,000 bytes and 200 data rows plus a header.
- Use the exact sample headers and enum values. Dates use `YYYY-MM-DD`; decimals
  use a dot with no currency symbol or grouping comma. Most money fields accept
  up to four decimal places; investment quantities support eight.
- Replace reference placeholders such as `ACCOUNT_ID`, `CATEGORY_ID` and
  `PERSON_ID` with IDs shown in the app. IDs are validated against the signed-in
  family (shared categories are also allowed). Optional empty cells use defaults.
- Import parents before their children: accounts/categories/people, then
  properties → units → agreements → rent payments; investments → trades;
  assets → valuations; liabilities → schedules/payments. Each module is a
  separate file. Imports create records, rather than updating existing IDs.
- No CSV content is stored as a public attachment. The API receives JSON with
  CSV text, validates the allowlisted fields and saves all rows in one database
  transaction. If a row fails, none of that batch is saved, including any
  schedules created by earlier rows. Row numbers refer to the header as row 1.
- A content hash per family and resource prevents the same parsed file from
  being imported twice. Changing the file makes a different batch; do not use
  that to retry a successfully imported file, because overlapping rows may be
  added again. This is duplicate-batch protection, not bank transaction matching.
- Receipts, PDFs, OCR and bank-specific statement formats are outside this CSV
  data-import feature.

Income example (replace placeholders with real IDs):

```csv
account_id,transaction_type,entry_type,category_id,amount,transaction_date,frequency,end_date,description
ACCOUNT_ID,INCOME,SALARY,CATEGORY_ID,50000.00,2026-09-30,MONTHLY,2027-08-31,Monthly salary
ACCOUNT_ID,INCOME,DIVIDEND,CATEGORY_ID,1500.00,2026-09-12,ONETIME,,Dividend receipt
```

Expense example:

```csv
account_id,transaction_type,entry_type,category_id,amount,transaction_date,frequency,end_date,description
ACCOUNT_ID,EXPENSE,BILL,CATEGORY_ID,2500.00,2026-09-15,MONTHLY,,Electricity
ACCOUNT_ID,EXPENSE,PURCHASE,CATEGORY_ID,800.50,2026-09-12,ONETIME,,Groceries
```

Custom categories example:

```csv
name,category_type
School fees,EXPENSE
House repairs,EXPENSE
Freelance income,INCOME
```

## API contract and architecture

All routes below require the normal bearer token. Family and creator identifiers
come from authenticated membership, never from CSV columns. Existing resource
URLs and `data` response envelopes stay compatible.

| Route | Contract |
| --- | --- |
| `GET /api/v1/catalog` | Module fields, defaults, choices, reference resources and required/nullable rules for both clients |
| `POST /api/v1/transactions` | Existing fields plus `entry_type`, `frequency` and optional schedule `end_date` |
| `PATCH /api/v1/recurring-transactions?id=…` | Change schedule details, or `is_active: 0` to pause / `1` to resume |
| `POST /api/v1/recurring-run` | Empty JSON body; returns `created`, `pending_schedules`, `skipped`, `through` |
| `GET /api/v1/imports?resource=transactions&direction=EXPENSE` | `{filename, csv, max_bytes, max_rows}` |
| `POST /api/v1/imports` | `{resource, csv, action: "preview"}` returns validation, row count, first five rows and errors |
| `POST /api/v1/imports` | `{resource, csv, action: "commit"}` returns imported count and duplicate-batch status |
| `GET /api/v1/reports?type=spending&group=category&from=2026-09-01&to=2026-09-30` | Category/currency totals and entry counts; `group=entry_type` groups payment types |

`lib/resource-specs.php` centralizes the existing resource allowlists.
`resource-schema.json` describes SQL column types/defaults for shared validation
and the client catalog. `finance.php` holds cross-record and recurrence rules;
`imports.php` holds CSV parsing and preview logic. Money is validated as decimal
strings and stored in MySQL DECIMAL. These contracts can be implemented by a
future Java backend without changing the client interaction model. Keep the
column metadata in sync whenever adding schema fields.

## Database and deployment

| Installation | Database action before deploying code |
| --- | --- |
| New, empty database | Import only `database/freshinstall.sql` |
| Existing V003 installation | Back up, then apply `database/migrations/V004__types_recurrence_imports.sql` |
| Earlier installation | Apply the missing migrations in version order through V004 |

V004 adds transaction types/frequency/schedule links, recurrence anchors, an
occurrence uniqueness index, shared categories and import batch history.
Existing transactions default to `OTHER` and `ONETIME`; existing schedules keep
their frequency and use their next due date as the initial anchor. No historical
transaction is guessed to belong to a schedule. MySQL DDL is not transactional;
the guarded migration is safe to rerun after an interrupted upgrade.

Deploy the PHP API and libraries together, then the web build. Keep the existing
private database/JWT configuration. No new upload folder or secrets are needed.
Allow JSON request bodies up to 2.2 MB to accommodate escaped CSV; the API still
enforces the 1 MB raw CSV limit. Reverse proxies may need their body limit raised
to at least 3 MB. JSON uploads do not depend on `upload_max_filesize`.

Rebuild and distribute Android/iOS clients with the new native picker/sharing
dependencies and the correct `EXPO_PUBLIC_API_BASE_URL`. A successful Expo export
checks both JS bundles; it is not a signed APK/IPA or a physical-device test.
InfinityFree's current test deployment has separate native-client and cron
constraints documented in [its deployment guide](../deployment/infinityfree/README.md).
Use manual processing there and an API host that permits native clients for
mobile integration testing.

## Validation and acceptance

`Validate monorepo` retains the existing checks and adds finance/CSV unit tests,
shared web/mobile behavior tests, both mobile platform exports, disposable MySQL
API integration tests, V004 rerun checks and schema equivalence. Fresh and upgraded
schemas are compared by columns/order/types/defaults, indexes, constraints,
foreign-key rules, table options and shared seed data.

Local client checks:

```sh
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix apps/mobile test
npm --prefix apps/mobile run build
php backend-php/tests/finance_unit.php
```

The API test suite starts its own PHP server and writes test families; run it
only against the disposable local database with the environment from the CI
workflow. Do not point it at a deployed database. PHP syntax lint is configured;
there is no separate JavaScript lint configuration.

Before release, verify on web and each native platform: create an account and
custom category; record one-time and monthly entries; process/retry due entries;
filter/group expenses; download/share a template; pick a valid CSV; preview and
confirm it; repeat the import; and try a malformed CSV. Confirm that input,
keyboard, scrolling and the native file/share picker remain usable on the device.
