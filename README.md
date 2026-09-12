# Personal Finance Platform

A family-focused personal finance workspace for web and mobile. It combines income and expense tracking with family people, rental management, investments, assets, liabilities, budgets and goals.

## Current delivery

The full domain implementation is delivered in one reviewable branch/PR after the Phase 1 foundation was merged into main.

- PHP 8.3 REST API with a stable /api/v1 contract
- React + Vite web and React Native + Expo mobile clients with create/edit forms for all 18 record types
- Income and expense types, one-time/weekly/monthly/yearly recurrence, custom categories and expense analysis
- CSV preview, atomic bulk imports and downloadable/shareable sample templates across web and mobile
- MySQL migrations through V004 and a consolidated `database/freshinstall.sql`
- JWT authentication, Argon2id password hashing, family-scoped authorization, input allowlists and parameterized SQL
- `Validate monorepo` checks client tests/builds, PHP syntax/unit tests, API integration, migrations and fresh/upgrade schema equivalence

This is an application-ready development increment. Production hosting, secrets, payment/bank integrations, store submissions and destructive migrations still require an explicit release decision.

## Repository layout

- backend-php: API endpoints, shared PHP libraries and the local development router
- database/migrations: ordered MySQL migration scripts
- apps/web: React web client
- apps/mobile: Expo mobile client
- packages/api-client: small shared fetch client
- packages/api-types: shared module and enum metadata
- packages/finance-core: web/mobile form behavior, reference selection, validation and API client
- docs: implementation and release notes

## Local setup

1. Create an empty MySQL database and import **only** `database/freshinstall.sql`. Existing installations apply only their pending migrations in version order (latest: V004); do not use the fresh-install file to upgrade.
2. Copy backend-php/config/config.example.php to backend-php/config/config.php, or set environment variables.
3. Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD and a long random JWT_SECRET.
4. Start the API from the repository root. The router makes clean /api/v1 URLs work with PHP's development server:

~~~text
php -S 0.0.0.0:8080 -t backend-php backend-php/router.php
~~~

5. Start the web app:

~~~text
cd apps/web
npm install
npm run dev
~~~

Set VITE_API_BASE_URL when the API is not at http://localhost:8080/api/v1. For Expo, set EXPO_PUBLIC_API_BASE_URL.

Start mobile with `cd apps/mobile`, `npm install`, then `npm start`. A physical
device needs the development computer's reachable LAN address or an HTTPS API,
not the device's own `localhost`. Rebuild native apps after installing the new
document picker, file system and sharing dependencies.

Native APK/AAB and iOS Simulator builds are available through **Actions → Build
mobile (native tools)** and in PR validation. They run Gradle/Xcode directly,
without EAS or another hosted mobile build service. See
[native build setup and downloads](docs/mobile-native-builds.md).

See [types, recurrence, CSV templates and deployment](docs/types-recurrence-imports.md)
for usage, examples, API details and acceptance checks.

## API conventions

- JSON request and response bodies
- Success responses are wrapped in data; collection endpoints return data.items and data.meta
- Errors are returned as error.code and error.message
- Use Authorization: Bearer <JWT> for all endpoints except health, register and login
- All records are scoped to the authenticated user's active family
- Collection CRUD uses GET, POST, PUT/PATCH and DELETE /api/v1/<resource>?id=<id>
- List supports limit, offset and the filters documented in the endpoint source

## Main endpoints

- /health, /auth/register, /auth/login
- /family, /members, /persons, /accounts, /categories
- /transactions, /recurring-transactions, /budgets, /goals
- /properties, /rental-units, /rental-agreements, /rent-payments
- /investments, /investment-transactions
- /assets, /asset-valuations
- /liabilities, /loan-schedules, /loan-payments
- /dashboard, /reports?type=cashflow|spending|net-worth, /notifications
- /catalog, /imports, /recurring-run

## Delivery and branch policy

Work is developed from main on a feature branch and submitted as a pull request. Do not commit directly to main. Review the pull request and CI result before merging. Apply database migrations in a controlled environment before any production release.

## Follow-up hardening

- Add refresh-token rotation, rate limiting, email verification and account recovery
- Add rent reminders and loan schedule jobs (recurring entry processing is available now)
- Add audit event writes, object storage for documents and observability
- Introduce the Java Spring Boot adapter behind the same API contract when the PHP implementation is ready to be replaced
