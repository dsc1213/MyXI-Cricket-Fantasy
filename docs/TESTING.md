# Testing Guide

## 1. Automated Tests

## API

```bash
cd api
npm install
npm test
```

Covers:
- auth/register/login/refresh/change-password/reset-password
- approval + role-policy behavior
- mock admin and score update rules
- squad manager create/update/delete lifecycle
- WCT20 participants/leaderboard/team consistency
- tournament create/delete + contest cascade checks

## Web E2E (Playwright)

```bash
cd web
npm install
npm run test:e2e
```

Notes:
- Uses mock API mode.
- Playwright config starts API + web servers automatically.
- API test startup resets mock persisted files (`mocks/state` and legacy `mock-state.json`).
- Recommended API run order (avoids env overlap between files):
  - `npm --prefix api test -- auth.test.js`
  - `npm --prefix api test -- mock-admin-flow.test.js`

## 2. Manual E2E

Use the detailed runbook:
- `docs/MANUAL_E2E_TESTING.md`
- `docs/FLOWS.md` (full flow coverage matrix, including minor checks)

This includes:
- registration and pending approval
- role assignment and role-gated UI
- contest join + participants + leaderboard checks
- score manager score scope checks
- tournament create/delete checks
- profile/password and logout guards
- cleanup steps

## 3. Quick Manual Smoke

1. Start API and web apps.
2. Login as `master / demo123` -> verify `/home`.
3. Register one test user -> verify `/pending`.
4. Activate that user in `Admin Manager > Users`.
5. Login as user -> verify `/home`.
6. Join a contest in `/fantasy`.
7. Open contest participants + leaderboard pages and verify user visibility.

## 4. Troubleshooting

- If admin/master logins fail in E2E after previous runs:
  - ensure API mock state is reset (`api/mocks/state/` cleared).
- If Playwright reports Node runtime issues:
  - use Node >= 18.19 (project currently uses newer Node in local setup).
- If UI cannot reach API:
  - verify API running on `http://localhost:4000`.
