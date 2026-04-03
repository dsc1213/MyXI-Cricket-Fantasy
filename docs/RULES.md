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
- Tournament is created hidden by default.
- Tournament becomes publicly visible only after admin/master enables it from `Admin Manager -> Tournaments`.
- Admin/master can delete tournament; delete cascades to linked contests and joins.
- Contest join is allowed even after contest matches have started.
- Match editability is determined by match start:
  - contest can still be joined after start
  - started/in-progress matches stay visible but become read-only for team edits

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
- Started/completed matches remain visible in contest scope.
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
