# TODO / Backlog

This file tracks active items only. Completed historical tasks are validated in tests/docs.

## Current Priorities

- [ ] Real DB integration (replace mock JSON state with persistent database tables)
- [ ] Real API environment validation (same flows as mock E2E)
- [ ] CI pipeline enforcement for both suites:
  - `cd api && npm test`
  - `cd web && npm run test:e2e`
- [ ] Security hardening for production cookies/session config (HTTPS, domain, SameSite policy)
- [ ] Add rate limiting and request validation on auth/admin-sensitive endpoints

## Product / UX

- [ ] Finalize non-fantasy module UX (`Drafts`, `Pick'em`) and data wiring
- [ ] Complete UI style modularization (split large style files into module styles)
- [ ] Add compact contest card polish pass and responsive refinements

## Quality

- [ ] Add performance/load test pass for multi-user contest scenarios
- [ ] Add visual regression checks for key pages
- [ ] Add a short “smoke only” Playwright suite for fast pre-commit runs

## Documentation

- [ ] Keep docs in sync after each major flow change (architecture/flows/testing/manual)
