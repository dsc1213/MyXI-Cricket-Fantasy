# PRODUCT_NOTES (Archived)

This file is kept for historical product planning context and may be outdated.

Use these as the source of truth for current behavior:
- `docs/ARCHITECTURE.md`
- `docs/FLOWS.md`
- `docs/TESTING.md`
- `docs/MANUAL_E2E_TESTING.md`
- `docs/TODO.md`

---

# MyXI (Fantasy Cricket MVP Plan)

Goal: friends-only fantasy cricket PWA for ICC Men’s T20 World Cup 2026 + IPL 2026, with admin-managed tournaments, match auto-population, live(ish) scores, and a simple leaderboard. Built to allow a future paid data provider with minimal refactor.

## Product Flows
- Role flow diagrams and current route model: `docs/FLOWS.md`
- System architecture and route strategy: `docs/ARCHITECTURE.md`
- Quick UI route index page in app: `/all-pages`

## Core Roles
- Master Admin: approves users, assigns admins, full control.
- Admin: manages tournaments, matches, participants, score overrides.
- Contest Manager: contest-scoped operator with `Score Updates` access only in dashboard left nav.
- User: joins tournaments, views scores, leaderboard.

## Data Sources (3-option strategy)
1) Default: Cricbuzz scraper (best-effort, may break).
2) Manual override: admin uploads JSON after match if needed.
3) Future: paid provider adapter (swap-in later).

## Key Flows

### 1) Registration + Approval
```
User registers -> status: pending
Master Admin approves -> status: active
```

### 2) Tournament auto-population
```
Admin selects Tournament (e.g., T20WC 2026)
-> System imports fixtures (from scraper or admin fixture JSON)
-> Matches created + visible
```

### 3) Live score updates + overrides
```
Scheduler polls scraper every 60s (configurable)
-> Save latest scrape data
-> If admin override exists after match end, use override for scoring
-> Update leaderboard
```

### 4) Leaderboard
- Total points per player, sorted DESC (highest first).
- Future: expandable accordion per player with match-by-match points.

## Score Source Precedence
- During match: scraper data is used.
- After match: admin can upload manual override if needed.
- If no manual override, use latest scraper data.
- If scraper fails, keep last valid score.

Implementation idea:
- `score_source`: "scraper" | "manual" | "paid"
- `source_updated_at`: timestamp for each source
- `effective_source`: manual if override flag is true; else latest source

## Update Cadence
- 60s polling is safe for a friends-only MVP.
- Scores update at the next poll; no “real-time” guarantees.
- Make polling interval configurable via env (e.g., SCORE_POLL_INTERVAL_SECONDS).

## Role Flows (Detailed)

### Master Admin
```
Login -> Review pending users -> Approve/Reject users
Login -> Assign/Remove admin roles
Login -> Manage player manager (master-only edits)
Login -> Override scores (manual JSON) if needed
Login -> Manage master admin settings page
```

### Admin
```
Login -> Pick tournaments (e.g., WC 2026, IPL 2026)
-> System auto-populates matches
Login -> Create tournaments/contests per match
Login -> Admin Manager -> Contests tab to enable/disable contests per tournament
Login -> Add/Remove players from tournaments
Login -> Upload manual JSON overrides
Login -> Manage admin settings page
```

### Contest Manager
```
Login -> Dashboard
-> Left nav shows only "Score Updates" under admin tools
-> Upload/update scores for assigned contest
```

### User
```
Register -> Wait for approval
Login -> Browse matches
Login -> View available tournaments
Login -> Join multiple tournaments
Login -> Pick 11 playing + 5/6 backups (optional)
Login -> Auto-swap backups if selected players are not in Playing XI
Login -> View live score updates
Login -> View leaderboard (total points)
```

## MVP Spec (Draft)

### Scope
- PWA only (web installable).
- No payments in MVP.
- Live scores from scraper, with manual override.

### Features
- Auth: register + master admin approval.
- Roles: master admin, admin, user.
- Tournament selection: admin picks WC 2026 / IPL 2026.
- Auto-populate matches for selected tournaments.
- Tournament participation: users can join multiple tournaments.
- Team selection: 11 playing + 5/6 backups (optional).
- Auto-swap backups if selected players are not in Playing XI after toss.
- Leaderboard: total points, highest first.
- Player list display: show Name + Team + Role to avoid duplicate-name confusion.
- Manual JSON upload for fixtures + match scores.
- Separate admin and master admin settings pages.
- Scoring rules managed via admin UI (stored as JSON internally).

### Out of Scope (for MVP)
- Payments and wallets.
- Anti-fraud systems.
- Real-time push (polling only).
- iOS/Android native apps.



## Score Upload Policy (Admin Ownership + History)
- Only the tournament creator (owner) or master admin can upload scores.
- Every upload is stored as a new version.
- The latest upload becomes active; older uploads remain in history.
- Master admin (or owner) can rollback to a previous upload.
- Leaderboard uses the active upload for completed matches.


## Toss & Playing XI Flow
- T–N days: users can pick XI + backups from the 15‑man squads.
- Toss time: Playing XI is marked (green = playing, red = not playing).
- Users can swap red players until cutoff (toss + 5–15 minutes).
- After cutoff: auto‑replace red players using backups from the same team.
- If no backup exists for a slot, that slot scores 0.

Backups rule:
- 3 backups per team (Team A: 3, Team B: 3).

## Scoring Rules (How it Works)
- Admin sets one global default ruleset via the scoring rules page or API.
- Rules are stored in DB as a global default row and loaded on page load into client state.
- Tournament-specific rule rows are optional overrides only.
- When a match score JSON is uploaded, points are calculated for each selected player using the tournament override if present, otherwise the global default rules.
- Leaderboard sums all match points for each user and sorts highest first.

Default example:
- run: 1
- wicket: 20
- catch: 10
- four: 1
- six: 2

## Data Model (Draft)

### users
- id
- name
- email
- password_hash
- status: pending | active | rejected
- role: master_admin | admin | user
- created_at

### tournaments
- id
- name
- season
- source_key (e.g., "t20wc2026", "ipl2026")
- status: draft | active | completed
- created_by
- created_at

### matches
- id
- tournament_id
- name
- team_a
- team_b
- start_time
- status: scheduled | live | completed
- data_source: scraper | manual | paid
- last_scrape_at
- manual_override_at

### tournament_entries
- id
- tournament_id
- user_id
- joined_at

### match_scores
- id
- match_id
- source: scraper | manual | paid
- payload_json
- source_updated_at

### scoring_rules (simple default)
- id
- name
- rules_json

### player_points
- id
- user_id
- tournament_id
- match_id
- points
- updated_at

## API Endpoints (Draft)

### Auth
- POST /auth/register
- POST /auth/login
- POST /auth/approve-user (master only)

### Admin
- GET /admin/tournaments
- POST /admin/tournaments/select
- POST /admin/tournaments/create
- POST /admin/matches/import-fixtures
- POST /admin/matches/score-upload
- POST /admin/tournaments/remove-player

### User
- GET /tournaments
- GET /tournaments/:id/matches
- POST /tournaments/:id/join
- GET /tournaments/:id/leaderboard

## System Diagram (MVP)
```
Users (PWA) -----> Node API -----> Database
    ^                |                |
    |                |                |
    |                v                |
    |          Scheduler/Worker <-----+
    |                |
    |                v
    |        Cricbuzz Scraper
    |
Admins (PWA) --(manual JSON upload)--> Node API -> Database
```

## Hosting & Costs (Typical)
- PWA hosting: static hosting (free tiers available).
- API server: small Node server (free tier or low-cost VPS).
- Database: free tier Postgres/Firestore/Supabase.
- Domain: optional but recommended.

Costs can be $0 on free tiers but may be unreliable. A small VPS usually runs in the low monthly range if you need stability.

## MVP Scope (Recommended)
- Auth + approval flow (master admin gates users).
- Tournament selection + match auto-population.
- Manual score upload + scraper polling.
- Tournament leaderboard (total points).

## Future Upgrade Path
- Swap in paid data provider adapter.
- Add payments.
- Add detailed per-match breakdowns per user.

## TODOs (MVP)

### Product decisions
- Confirm tournaments list (T20WC 2026, IPL 2026).
- Confirm score rules (runs/wickets/catches/etc.) and defaults.
- Confirm polling interval env default (e.g., 60s).

### Backend
- Set up Node API project structure.
- Auth: register/login + master admin approval.
- Roles + permissions middleware.
- Tournament selection + match auto-population endpoints.
- Manual score upload endpoint (JSON only for MVP).
- Scraper polling job + persistence.
- Leaderboard calculation (total points, DESC).
- Backup auto-swap logic after playing XI is known.

### Frontend (PWA)
- Auth screens (register, login, pending approval).
- Master admin pages (user approvals, admin role assignment, settings).
- Admin pages (tournaments, matches, score upload, settings).
- User flow (browse, join tournaments, pick team + backups).
- Leaderboard UI (total points).

### Ops
- Pick hosting for API + DB + PWA.
- Add env management for polling interval.
- Basic monitoring/logging.
