# MyXI Fantasy Cricket

Fantasy cricket app with role-based admin controls, contest management, team selection, scoring, and leaderboard.

## Run Locally

### 1) API

```bash
cd api
cp .env.example .env
npm install
npm run dev
```

### 2) Web

```bash
cd web
npm install
npm run dev
```

API runs on `http://localhost:4000` and web on Vite default port (usually `http://localhost:5173`).

## Required Environment

Create `api/.env`:

```env
PORT=4000
JWT_SECRET=<generate-a-random-secret>
JWT_EXPIRES_IN=7d
MOCK_API=true
```

Generate `JWT_SECRET` (example):

```bash
openssl rand -hex 32
```

Optional seed user (only if you want to bootstrap a fixed master account via env):

```env
MASTER_ADMIN_NAME=<your-master-name>
MASTER_ADMIN_EMAIL=<your-master-email>
MASTER_ADMIN_PASSWORD=<your-master-password>
```

Frontend does not decide mock/real mode; backend controls it via `MOCK_API`.

## Additional Docs

All detailed docs were moved to `docs/`:

- architecture: `docs/ARCHITECTURE.md`
- flows: `docs/FLOWS.md`
- testing: `docs/TESTING.md`
- manual e2e runbook: `docs/MANUAL_E2E_TESTING.md`
- product rules: `docs/RULES.md`
- backlog/todo: `docs/TODO.md`
- ui expectations: `docs/UI_EXPECTATIONS.md`
- archived long product notes/out-of-scope details:
  `docs/PRODUCT_NOTES.md`
