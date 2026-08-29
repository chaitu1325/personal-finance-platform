# Personal Finance Platform

A modular personal-finance platform for web and mobile.

## Approved Phase 1 architecture

- Web: React + Vite
- Mobile: React Native + Expo
- Backend: PHP 8.3 REST API
- Database: MySQL
- Authentication: JWT Bearer tokens
- API contract: versioned JSON REST under \`/api/v1\`
- Future backend: Java Spring Boot behind the same contracts

## Planned business modules

- Authentication and users
- Family and persons
- Accounts and categories
- Income, expenses, transfers, and recurring transactions
- Rental management
- Investments
- Assets
- Liabilities and loans
- Dashboard, reports, notifications, and audit

## Phase 1 foundation in this branch

- PHP API bootstrap with PDO, JSON responses, request parsing, and JWT helpers
- Health endpoint
- Registration and login endpoints
- MySQL foundation migration
- React web shell
- React Native/Expo mobile shell
- Shared API client package
- CI validation for PHP syntax and web build

## Local setup

### PHP API

1. Copy \`backend-php/config/config.example.php\` to \`backend-php/config/config.php\`.
2. Set MySQL credentials and a long random JWT secret.
3. Apply \`database/migrations/V001__foundation.sql\`.
4. Serve \`backend-php\` from PHP 8.3. For local testing:

\`\`\`bash
php -S localhost:8080 -t backend-php
\`\`\`

The health endpoint is \`GET /api/v1/health.php\`. With Apache rewrite rules enabled, \`/api/v1/health\` is also supported.

### Web

\`\`\`bash
cd apps/web
npm install
npm run dev
\`\`\`

Set \`VITE_API_BASE_URL\` in \`.env.local\` when the API is not at the default URL.

### Mobile

\`\`\`bash
cd apps/mobile
npm install
npx expo start
\`\`\`

Set \`EXPO_PUBLIC_API_BASE_URL\` for the API URL.

## API conventions

- Success responses: \`{ "success": true, "data": ... }\`
- Error responses: \`{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }\`
- Protected calls use \`Authorization: Bearer <token>\`.
- Clients must not depend on PHP filenames or database table names.

## Branch and deployment policy

All work is delivered through feature branches and pull requests. CI performs validation only. Production deployment, database migration, and external-service changes require explicit approval.
