# Manual End-to-End Testing (From Scratch)

This runbook is for full manual validation before DB switch + deployment.
Follow the sections in order.

## 1. Scope

Covers complete UX by role:
- Full user experience
- Full admin experience
- Full master experience
- Auth/session/logout behavior
- Contest capacity, participants, team submission, leaderboard sync
- Tournament/contest start-time behavior

## 2. Test Environment Setup (Clean Start)

1. Start API:
```bash
cd api
npm install
npm run dev
```

2. Start Web:
```bash
cd web
npm install
npm run dev
```

3. Open app in fresh incognito:
- `http://localhost:5173/login`

4. Confirm mock mode for this run:
- `api/.env` has `MOCK_API=true`

5. Optional clean reset (recommended before full cycle):
- stop API
- delete persisted mock files under `api/mocks/state` (and legacy `api/mock-state.json` if present)
- start API again

## 3. Standard Test Accounts

Use these accounts in this run:
- master: `master / demo123`
- admin (seed): `admin / demo123`
- score manager (seed): `contestmgr / demo123`
- player (seed): `player / demo123`

Create these new users during test:
- `mocke2ebot-abc`
- `mocke2ebot-cde`
- `mocke2ebot-efg`

Default password for new users:
- `demo123`

## 4. Full User Experience (End User)

### 4.1 Register -> pending -> approval

1. Go to `/register`.
2. Create user `mocke2ebot-abc` with unique email, location, password.
3. Click submit.
Expected:
- Redirect to `/pending`.

4. Try login immediately with new user.
Expected:
- Login blocked, still pending.

5. Repeat for `mocke2ebot-cde` and `mocke2ebot-efg`.

### 4.2 User after approval

1. Login as `master`.
2. Go `/home` -> `Pending Approvals`.
3. Approve all 3 users.
Expected:
- Users move out of pending list.

4. Logout and login as `mocke2ebot-abc`.
Expected:
- Directly lands on `/home` in one attempt.

5. Open `/fantasy`.
Expected:
- Available tournaments and contests visible.

6. Join one available contest.
Expected:
- Contest moves to joined section.

7. Open joined contest detail.
Expected:
- Matches list visible.
- For not-submitted match: `My Team = Not added`.

8. On a `notstarted` row, click edit/add icon and submit XI + backups.
Expected:
- Save succeeds.
- Back on contest page row changes to `Added`.

9. Open leaderboard.
Expected:
- Username appears for joined contest.

10. Open participants table for selected match.
Expected:
- User appears only when team exists for selected match.
- No extra/phantom participants.

### 4.3 User profile and session

1. Go `/profile`.
2. Update display name/location.
Expected:
- Save success; reflected in UI.

3. Go `/change-password` and change password.
Expected:
- Old password fails, new password works.

4. Logout.
Expected:
- Redirect to `/login` once; no white flicker.

## 5. Full Admin Experience

Login as `admin`.

### 5.1 Access control

Check left menu.
Expected:
- Can access: `Create Tournament`, `Squad Manager`, `Admin Manager`, `Score Updates`, `Audit Logs`.
- Cannot access master-only actions (pending approvals, master-only role changes).

### 5.2 Squad manager flow

1. Open `Squad Manager`.
2. For league path: choose type -> country -> league -> team.
3. Add/update players in table rows.
4. Save and refresh.
Expected:
- Data persists after refresh.

### 5.3 Tournament manager flow

1. Open `Create Tournament`.
2. Manual tab:
- set type
- set tournament name + season
- select participating teams
- click `Next`
3. Matches tab:
- add rows
- set Team A / Team B / Date / Start time / Timezone / location/venue
- no same team vs same team
4. Save tournament.
Expected:
- Redirect to admin manager/tournaments.
- Tournament appears in tournaments list.

### 5.4 Contest and score flow

1. In fantasy, create contest in enabled tournament.
2. Select scoped matches.
3. Save.
Expected:
- Contest visible in tournament contest list.

4. Open `Score Updates`.
Expected:
- Updates are by tournament/match (no contest dropdown dependency).

5. Save score updates for one inprogress/completed match.
Expected:
- Contest pages show updated `last score update`.
- Leaderboard and participant points refresh consistently.

### 5.5 Admin restrictions

1. Try assigning `admin` role to another user (if policy blocks).
2. Try cross-user full team edit using direct team-selection URL.
Expected:
- Blocked (only master allowed full cross-user edit).

## 6. Full Master Experience

Login as `master`.

### 6.1 Master-only controls

1. Open `/home`.
Expected:
- Master links visible (including pending approvals).

2. Open `Admin Manager > Users`.
3. Assign roles:
- `mocke2ebot-abc` -> `admin`
- `mocke2ebot-cde` -> `contest_manager` (score manager)
- `mocke2ebot-efg` -> `user`
4. Save.
Expected:
- Role updates succeed.

### 6.2 Contest participant management

1. Open one contest detail.
2. Select a match.
3. In participants table:
- eye icon available for viewing
- edit icon available for master
4. Click edit icon for a participant.
Expected:
- Opens team selection with that participant context.
- Master can save updated XI.

5. Verify match row behavior for non-participants.
Expected:
- No edit icon in matches table for users who have not joined contest.

### 6.3 Capacity and sync checks

1. Create a low-capacity contest (example max 2).
2. Have two users join.
Expected:
- Card shows `Participants 2/2` and `Contest full`.

3. Open contest detail.
Expected:
- Participants panel count matches card count.
- No mismatch between card and participants table.

### 6.4 Delete and audit

1. Delete one contest from contest detail page.
Expected:
- Only selected contest deleted.
- Other contests remain.

2. Open `Audit Logs`.
Expected:
- Entries for create/update/delete and score changes present.

## 7. Critical Sync Matrix (Must Pass)

For one tournament, one contest, one match:
- Submitted teams count in match row eye badge
- Participants table count for selected match
- Leaderboard user rows and totals
- Player stats totals after score update

Expected:
- All four reflect same underlying data changes.

## 8. Tournament/Contest Started Logic (Important)

Yes, updating match date/start time automatically affects join/start behavior.

Current rule in app logic:
- Contest join-open is computed from the **first scoped match `startAt`**.
- If `now < firstMatch.startAt` -> join open.
- If `now >= firstMatch.startAt` -> join closed.

How to validate quickly:
1. Create contest with first scoped match `startAt` in future.
Expected: join button enabled.

2. Edit/create contest with first scoped match `startAt` in past.
Expected: join blocked / contest already started.

Notes:
- This is timestamp-driven, not manual status toggle.
- Ensure timezone is correct when entering start time.

## 9. Auth/Navigation Regression Checks

1. Login from `/login`.
Expected:
- Redirect to `/home` once (no second login needed).

2. Logout from user menu.
Expected:
- Clean redirect to `/login` with no extra white-page bounce.

3. Open protected routes while logged out (`/home`, `/fantasy`, `/profile`).
Expected:
- Redirect to `/login`.

## 10. Cleanup (Mandatory)

1. Login as master.
2. Delete created test users:
- `mocke2ebot-abc`
- `mocke2ebot-cde`
- `mocke2ebot-efg`
3. Delete temporary contests/tournaments made for testing.

## 11. Test Result Template

- Date:
- Tester:
- Env:
- API mode (`MOCK_API`):
- Commit/Build:

Checklist:
- [ ] Full User Experience
- [ ] Full Admin Experience
- [ ] Full Master Experience
- [ ] Started Logic Validation
- [ ] Auth/Navigation Regression
- [ ] Data Sync Matrix
- [ ] Cleanup

Defects:
1.
2.
3.

Overall:
- [ ] PASS
- [ ] FAIL
