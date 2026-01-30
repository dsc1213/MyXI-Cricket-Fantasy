# MVP TODOs

## Phase 0 — Setup
- [x] Decide stack (React PWA + Node API)
- [x] Create repo structure (web/, api/)
- [ ] Configure env variables list

## Phase 1 — Core Auth + Roles
- [x] Refactor auth helpers into middleware
- [x] Auth UI: register page
- [x] Auth UI: login page
- [x] Auth UI: pending approval page
- [x] Auth API: register endpoint
- [x] Auth API: login endpoint
- [x] Auth API: approve/reject endpoint (master admin)
- [x] Roles: seed master admin user
- [x] Roles: middleware guards for master/admin/user
- [x] User management: search/list endpoint
- [x] User management: update endpoint (self/admin/master)
- [x] User management: delete endpoint (master only)

## Phase 2 — Tournaments + Matches
- [x] Tournament selection (WC 2026, IPL 2026)
- [x] Auto-populate matches (from fixtures JSON)
- [x] Match status updates (scheduled/live/completed)

## Phase 3 — Teams + Backups
- [x] Team selection UI (11 + backups)
- [x] Auto-swap backups after Playing XI

## Phase 4 — Scoring + Leaderboard
- [ ] Scoring rules UI (admin)
- [ ] Score upload (JSON only)
- [ ] Compute totals + leaderboard (DESC)

## Phase 5 — Admin Panels
- [ ] Admin pages (tournaments, matches, score upload)
- [ ] Master admin pages (approvals, role management)

## Phase 6 — Ops
- [ ] Basic logging
- [ ] Polling interval config (env)
- [ ] Deployment checklist

## Phase 7 — Production Readiness
- [ ] Persist data in DB (users, tournaments, matches, entries, scores)
- [x] Auth tokens (JWT) + secure password policy
- [ ] Input validation + request limits
- [ ] Error handling + structured logs
- [ ] CORS + security headers
- [ ] Backups + data restore plan
- [ ] Monitoring + alerts
- [ ] Rate limiting for auth endpoints
- [ ] Admin audit log (promote/demote/score overrides)
- [ ] Tests (API + basic UI smoke)
- [x] API unit tests (auth/users)
