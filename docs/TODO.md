# TODO / Backlog

This file tracks active items only. Completed historical tasks are validated in tests/docs.

## Current Priorities

- [ ] Real API environment validation in DB mode for release-critical flows
  - Tournament JSON import
  - Auction JSON import
  - Playing XI save/read
  - Scorecard JSON save/read
  - Fantasy leaderboard propagation
  - Auction leaderboard propagation
- [ ] CI pipeline enforcement for both suites:
  - `cd api && npm test`
  - `cd web && npm run test:e2e`
- [ ] Security hardening for production cookies/session config (HTTPS, domain, SameSite policy)
- [ ] Add rate limiting and request validation on auth/admin-sensitive endpoints
- [ ] Final DB smoke using the local prod checklist in [LOCAL_PROD_SMOKE_CHECKLIST.md](/Users/sreecharan/Desktop/Projects/MyXI-Cricket-Fantasy/docs/LOCAL_PROD_SMOKE_CHECKLIST.md)

## Next After Go-Live

- [ ] Audit trail hardening
  - Log all admin/master actions consistently in both mock and DB paths
  - Cover:
    - tournament import/update/delete
    - auction import/delete
    - squad edits
    - Playing XI save/update
    - scorecard upload/update
    - master cross-user team edits
    - role/status changes
  - Include useful metadata:
    - actor
    - module
    - action
    - target
    - timestamp
    - before/after or summary payload where appropriate
- [ ] Audit Logs screen polish
  - Better filtering/search
  - Cleaner detail display for operational debugging
  - Confirm DB and mock show the same action categories

## Implemented Recently

- [x] Tournament JSON import in admin UI
- [x] Auction JSON import in admin UI, linked to tournament-scoped fixed-roster contests
- [x] Tournament metadata support in DB (`tournament_type`, `country`, `league`, `selected_teams`, `source`)
- [x] Shared scorecard/stat model:
  - `player_match_scores`
  - `contest_match_players`
  - `contest_scores`
- [x] Captain / Vice Captain scoring support
- [x] Playing XI save/read path in both mock and DB
- [x] Backup replacement in fantasy scoring using announced Playing XI
- [x] Scorecard JSON upload hydrates Manual Entry values
- [x] Contest delete keeps other contest participation intact
- [x] Tournament delete cascades through tournament-owned data
- [x] Auth session restore on reload
- [x] Regression coverage added for the major fixes above

## Product / UX

- [ ] Finalize non-fantasy module UX (`Drafts`, `Pick'em`) and data wiring
- [ ] Complete UI style modularization (split large style files into module styles)
- [ ] Add compact contest card polish pass and responsive refinements
- [ ] Final dark/light theme sweep for dense player tiles, score tables, and preview states
- [ ] Shared reusable numeric input component for seeded-zero number fields
- [ ] Shared reusable player identity usage sweep for any remaining text-only player views

## Quality

- [ ] Add performance/load test pass for multi-user contest scenarios
- [ ] Add visual regression checks for key pages
- [ ] Add a short “smoke only” Playwright suite for fast pre-commit runs
- [ ] Eliminate Playwright local webServer port-collision friction in repeated targeted runs
- [ ] Add a DB-targeted release subset runner using the existing Playwright config toggle

## Documentation

- [ ] Keep docs in sync after each major flow change (architecture/flows/testing/manual)
- [x] Prod readiness matrix added
- [x] Local prod smoke checklist added
