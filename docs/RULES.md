# Contest Rules (Source of Truth)

These are enforceable product rules for contests and participation.

## 1) Account and Approval

- User can register.
- New user status is `pending`.
- Pending user login must route to `/pending`.
- Only `master_admin` can approve user to `active`.
- Only `active` users can use full fantasy flows.

## 2) Tournament and Contest Lifecycle

- Admin/master can create tournaments (manual grid or JSON).
- Tournament join/visibility goes live immediately after create (enabled by default).
- Admin/master can delete tournament; delete cascades to linked contests and joins.
- Contest join is allowed only when contest is join-open.
- Join-open is determined by the first configured match `startAt` timestamp for that contest:
  - if `now < firstMatch.startAt`: join is open
  - if `now >= firstMatch.startAt`: join is closed

## 3) Contest Match Scope

- Contest can include:
  - all tournament matches, or
  - a selected subset/range (example: match 10 to 20 only).
- Users in a contest must only see contest-configured matches.
- Users must never see other tournament matches outside contest scope.

## 4) Visibility and Teams

- For a newly joined user, before saving XI:
  - all visible contest matches must show `My Team = Not added`
  - no auto preselected team should appear.
- Participant points must not appear as positive by default before relevant scoring/team data exists.

## 5) Roles and Permissions

- `master_admin`:
  - approves users
  - can assign all roles
  - full admin access
- `admin`:
  - manages tournaments/contests/users within policy
  - can delete only contests created by themselves
  - can assign `contest_manager` and `user`
  - cannot assign `admin` or `master_admin`
- `contest_manager` (UI label: Score manager):
  - score updates (tournament match feed) with assignment policy checks
  - cannot manage users/roles/tournaments

Delete rule:
- Contest deletion is allowed for:
  - contest owner admin (`createdBy` matches actor), or
  - `master_admin`.
- One admin must not delete another admin's contest.

## 6) Admin Contest Creation Requirements

- Admin should be able to choose contest match scope during creation (match grid with date/status).
- Started/completed matches should be non-selectable for new join windows.
- If contest is created mid-tournament with scoped future matches, user should only see those scoped matches after join.

## 7) Identity and Entry Constraints

- Required unique fields on registration:
  - `userId`
  - `email`
- `name` and `password` are required.
- `gameName` is optional:
  - if omitted, system falls back to `name`.
- Single-entry policy:
  - one user can join a given contest only once.

## 8) Match Table / Participants UX Rules

- Match action eye badge count must represent:
  - submitted teams count for that match (not joined count).
- Participants panel must show:
  - submitted participants count, and
  - joined participants count context.
