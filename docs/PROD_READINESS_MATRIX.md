# Prod Readiness Matrix

This is the stabilization checklist for MyXI. It is intentionally short and operational.

## Current Reality

- Playwright currently proves the canonical UI/API flows well in `mock` mode.
- DB mode is **not** at parity yet, even where endpoint names match.
- Do not treat a passing `web/tests/e2e` run as proof of prod readiness unless it was run with `PW_API_MODE=db`.

## Coverage Source Of Truth

- Mock/default E2E: `cd web && npm run test:e2e`
- DB-backed E2E: `cd web && npm run test:e2e:db`
- API/unit/integration: `cd api && npm test`

## Flow Matrix

| Flow | Mock | DB | Notes |
| --- | --- | --- | --- |
| Auth login/reload/session restore | Covered | Partially covered | UI/session behavior exists, but DB-mode smoke coverage is still light. |
| Tournament create/import via UI | Covered | Missing parity | DB router does not implement `POST /admin/tournaments` import/create like mock does. |
| Tournament delete cascade | Covered | Partially covered | Delete route exists in both; DB needs full smoke pass with related contests/stats. |
| Tournament enable/disable | Covered | Partial | DB service has handlers, but no dedicated DB-mode E2E coverage. |
| Contest create/join/leave | Covered | Partial | DB create/join exists, but same-depth E2E parity is not proven. |
| Contest delete without cross-contest data loss | Covered | Partial | Service logic exists; DB-mode E2E parity still missing. |
| Squad manager league scope | Covered | Partial | DB reads/writes exist, but tournament-specific UX and DB smoke pass need verification. |
| Squad manager tournament scope | Covered | Partial | Depends on tournament metadata quality in DB import path. |
| Team pool for team selection | Covered | Implemented | DB endpoint exists now, but needs dedicated DB-mode E2E pass. |
| Team selection save/edit | Covered | Implemented | DB save route exists; contest isolation now modeled by `contest_id`. |
| Match lock/status from start time + timezone | Covered | Missing parity | Mock derives status/lock from `startAt`; DB still mostly trusts stored status. |
| Captain / Vice Captain validation | Covered | Implemented | Backend validation exists in DB and mock; DB-mode smoke still required. |
| Captain / Vice Captain scoring multipliers | Covered | Implemented | Applied in DB contest score rebuild; still needs DB-mode leaderboard proof. |
| Tournament player stats | Covered | Implemented | DB `/player-stats` now reads from `player_match_scores`. |
| Score upload -> tournament stats | Covered | Implemented | DB writes `player_match_scores`; needs DB E2E proof. |
| Score upload -> fantasy leaderboard | Covered | Partial | DB rebuild logic exists, but not fully proven in E2E with real DB mode. |
| Score upload -> auction leaderboard | Covered | Partial | DB fixed-roster path exists in scoring rebuild, but not fully proven in E2E. |
| Auction discovery/navigation | Covered | Missing parity | Mock flow exists; DB content import and surfacing still incomplete. |

## Highest-Risk DB Gaps

1. `POST /admin/tournaments` import/create parity
   - Mock has full JSON/manual import behavior.
   - DB mode still lacks the equivalent route behavior.

2. Match status / lock derivation
   - Mock derives `notstarted` / `inprogress` / `completed` and lock state from `startAt + timezone`.
   - DB mode does not yet apply the same derivation consistently.

3. DB-backed E2E parity
   - The same Playwright specs have not been run cleanly enough under `PW_API_MODE=db`.

4. Tournament maintenance editing
   - Enable/disable/delete exists.
   - True edit/import-maintenance flow is still thin in DB mode.

## Non-Negotiable Release Gates

- `api` tests green.
- Release-targeted Playwright specs green in `mock` mode.
- The same release-targeted Playwright specs green in `db` mode.
- Manual smoke in DB mode for:
  - login/reload
  - tournament import
  - contest create/join
  - team selection save
  - score upload
  - tournament stats update
  - fantasy leaderboard update
  - auction leaderboard update

## Immediate Next Steps

1. Implement DB `POST /admin/tournaments` import/create parity using shared normalization.
2. Centralize match status/lock derivation so mock and DB use the same logic.
3. Run a DB-backed subset:
   - `app-flow.spec.js`
   - `bot-11-tournament-create-delete-and-score-meta.spec.js`
   - `bot-12-manager-flows.spec.js`
   - `bot-15-json-uploads.spec.js`
   - `bot-19-fixed-roster-auction.spec.js`
4. Fix only parity failures from that run before adding anything else.
