# Admin How-To Guide

This guide is for admins and master admins who operate MyXI day to day.

Use it for:
- tournament import
- auction import
- squad updates
- Playing XI updates
- scorecard updates
- participant/player replacements
- contest and tournament cleanup

If you are a normal user, many of these actions will not be available.

## 1. Roles And What They Can Do

### Admin
- Create/import tournaments
- Import auction contests
- Manage squads
- Update Playing XI
- Update scorecards
- Delete contests
- Delete tournaments
- Use Admin Manager

### Master Admin
- Everything an admin can do
- Edit another user’s team directly
- Approve pending users
- Use all master-only tools

### Contest Manager
- Only score-related operational tools allowed by current policy

## 2. Before You Start

Make sure:
- you are logged in with `admin` or `master admin`
- the tournament exists before importing auction data
- the correct squads exist before saving Playing XI
- the correct match is selected before uploading a scorecard

Recommended admin order:
1. create/import tournament
2. import/create contests
3. confirm squads
4. save Playing XI after toss
5. upload scorecards

## 3. How To Create Or Import A Tournament

Location:
- `Home -> Create Tournament`

### JSON Import

1. Open `Create Tournament`.
2. Click `JSON`.
3. Paste the tournament JSON.
4. Click `Save tournament`.

Confirm:
- success banner appears
- tournament appears in `Admin Manager -> Tournaments`
- tournament appears in `Fantasy`
- tournament appears in `Score Updates`

### Manual Tournament Creation

1. Open `Create Tournament`.
2. Stay on `Manual`.
3. Choose tournament type.
4. Enter tournament name and season.
5. Select participating teams.
6. Click `Next`.
7. Add matches with:
   - Team A
   - Team B
   - Match start
   - Timezone
   - Location
   - Stadium
8. Click `Save tournament`.

Important:
- Team A and Team B cannot be the same
- Match start time and timezone matter for lock behavior

## 4. How To Import Auction Data

Location:
- `Home -> Create Tournament -> Auction`

Use this only after the tournament exists.

1. Open `Create Tournament`.
2. Click `Auction`.
3. Confirm the `tournamentId` in the JSON matches the target tournament.
4. Paste auction JSON with:
   - `tournamentId`
   - `contestName`
   - `participants`
   - each participant’s `roster`
5. Click `Import auction`.

Confirm:
- success banner appears
- contest appears in `/auction`
- contest tournament name matches the imported tournament

Important model:
- auction contest belongs to a tournament
- it uses the same tournament matches and scorecards
- only the roster model is different from fantasy

## 5. How To Manage Squads

Location:
- `Home -> Squad Manager`

Use Squad Manager for tournament/team roster maintenance.

### League Squad

1. Open `Squad Manager`.
2. Choose:
   - `Type = League`
   - `Country`
   - `League`
   - `Team`
3. Add, edit, or remove players.
4. Save squad.

### Tournament Squad

1. Open `Squad Manager`.
2. Choose:
   - `Type = Tournament`
   - target tournament
   - target team
3. Add, edit, or remove players.
4. Save squad.

Confirm:
- updated players appear later in team selection and score update screens

## 6. How To Save Playing XI

Location:
- `Home -> Score Updates -> Playing XI`

Use this after toss.

### Manual Entry

1. Open `Score Updates`.
2. Select `Playing XI`.
3. Select the tournament.
4. Select the match.
5. Stay on `Manual Entry`.
6. For each team, check players who are in the announced XI.
7. Save Playing XI.

Rules:
- save `11` or `12` active players per side
- `12` is allowed for impact-player style use

### JSON Upload

1. Open `Score Updates -> Playing XI -> JSON Upload`.
2. Select tournament and match.
3. Paste the lineup JSON.
4. Click `Save Playing XI JSON`.

Confirm:
- team selection page shows lineup indicators
  - green dot = in Playing XI
  - red dot = not in Playing XI

Important:
- future matches should remain empty until you explicitly save Playing XI for that match
- changing Playing XI should affect only that match, not all matches

## 7. How To Update Match Scores

Location:
- `Home -> Score Updates -> Scorecards`

### JSON Upload

1. Open `Score Updates`.
2. Select `Scorecards`.
3. Select tournament and match.
4. Click `JSON Upload`.
5. Paste the scorecard JSON.
6. Click `Save`.

Confirm:
- success banner appears
- switching back to `Manual Entry` shows the saved values
- tournament player stats update

### Manual Entry

1. Open `Score Updates -> Scorecards -> Manual Entry`.
2. Select tournament and match.
3. Use:
   - `Bat`
   - `Bowl`
   - `Field`
4. Enter raw score values.
5. Click `Save`.

Important:
- enter raw cricket stats, not fantasy points
- milestones and derived values are calculated from these

Examples:
- Batting:
  - runs
  - balls faced
  - fours
  - sixes
  - out
- Bowling:
  - overs
  - maidens
  - runs conceded
  - wickets
  - no balls
  - wides
- Fielding:
  - catches
  - stumpings
  - runout direct
  - runout assist

## 8. What Happens After Score Upload

Tournament scorecards are shared.

That means one score update should affect:
- tournament player stats
- fantasy contest leaderboard
- auction contest leaderboard

But the leaderboard totals can differ because:
- fantasy uses per-match selected XI
- auction uses fixed tournament roster ownership

Expected shared model:
- stats are common at tournament level
- leaderboard is different at contest level

## 9. How To Replace A Player For A User

This is a master-admin action when editing another user’s team.

Location:
- contest participants table

Steps:
1. Open the contest.
2. Open the participants section for the match.
3. Click the edit action for the target participant.
4. Modify that participant’s `MyXI`, backups, captain, or vice-captain.
5. Save.

Important:
- admins should not use URL hacking for cross-user edits
- master admin is the intended operator for this flow

## 10. How Backup Logic Works

Backups are only for fantasy match teams.

Rules:
- a selected player cannot also remain a backup
- if a backup is promoted into `MyXI`, it is removed from backups
- if a selected player is not in Playing XI, the system tries to replace that player using backups in order
- captain/vice-captain bonus does not transfer to the replacement automatically

## 11. How To Delete A Contest

Location:
- `Admin Manager -> Contests`
  or contest-level admin controls if exposed there

Steps:
1. Find the contest.
2. Delete the contest.
3. Confirm deletion.

Expected result:
- only that contest is removed
- participant data for that contest is removed
- the same user’s teams in other contests remain untouched

Use carefully:
- this is a contest-scoped cleanup, not tournament cleanup

## 12. How To Delete A Tournament

Location:
- `Admin Manager -> Tournaments`

Steps:
1. Find the tournament.
2. Delete the tournament.
3. Confirm deletion.

Expected result:
- tournament is removed
- contests under that tournament are removed
- match scorecards and tournament player stats under that tournament are removed
- shared player master rows remain reusable

Use carefully:
- this is a cascade delete

## 13. How To Delete A Player

There are two meanings here.

### Remove player from a squad

Location:
- `Squad Manager`

1. Select the team scope.
2. Find the player row.
3. Delete the row.
4. Save squad.

This removes the player from that squad source.

### Remove a player from a user’s saved team

Location:
- user team editor / participant edit flow

1. Open the saved team.
2. Remove the player from `MyXI` or backups.
3. Save.

## 14. How To Verify Things Worked

After any important admin action, verify in the next consumer screen.

### After tournament import
- check `Fantasy`
- check `Admin Manager -> Tournaments`

### After auction import
- check `/auction`
- check that tournament name matches

### After squad update
- check `Fantasy -> Add Team`

### After Playing XI save
- check lineup dots in team selection

### After score upload
- check:
  - tournament player stats
  - fantasy leaderboard
  - auction leaderboard

## 15. Common Mistakes To Avoid

- Importing auction data before the tournament exists
- Using the wrong `tournamentId` in auction JSON
- Updating the wrong match in `Score Updates`
- Forgetting to save Playing XI after toss
- Assuming contest leaderboard and tournament stats are the same thing
- Deleting a tournament when only a contest needed removal

## 16. Quick Admin Checklist

For each match day:

1. Confirm tournament exists.
2. Confirm contests exist.
3. Confirm squads are correct.
4. Save Playing XI after toss.
5. Upload scorecard.
6. Verify:
   - tournament stats updated
   - fantasy leaderboard updated
   - auction leaderboard updated

## 17. Escalation Notes

If something looks wrong, check in this order:

1. Was the correct tournament selected?
2. Was the correct match selected?
3. Was Playing XI saved for that exact match?
4. Did the scorecard save successfully?
5. Did the player exist in the correct squad/tournament pool?
6. Is the issue in tournament stats, fantasy leaderboard, auction leaderboard, or user team selection?

