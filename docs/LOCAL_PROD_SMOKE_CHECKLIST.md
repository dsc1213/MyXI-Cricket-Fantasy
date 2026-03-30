# Local Prod Smoke Checklist

Use this when validating the DB-backed app locally before hosting.

## Setup

1. Set `MOCK_API=false` in the API env.
2. Point `DATABASE_URL` at the target Postgres database.
3. Run migrations:
   ```bash
   cd /Users/sreecharan/Desktop/Projects/MyXI-Cricket-Fantasy/api
   DB_PROVIDER=postgres npm run db:migrate
   ```
4. Start API and web.

## Tournament Seed

1. Open `Home -> Create Tournament`.
2. Use `JSON` and import the real tournament payload.
3. Confirm:
   - success banner appears
   - tournament is visible in `Admin Manager -> Tournaments`
   - tournament is visible in `Fantasy`
   - tournament is visible in `Score Updates`
   - tournament is available as the target tournament in `Create Tournament -> Auction`
   - tournament match list is complete and no started match is silently removed

## Contest Seed

1. Create at least one fantasy contest for the imported tournament.
2. Import at least one auction contest for that same tournament.
3. Confirm:
   - both contests point to the same `tournamentId`
   - fantasy contest appears in `/fantasy`
   - auction contest appears in `/auction`
   - both show the same tournament name
   - both use the same match schedule for that tournament

## Auction Seed

1. In `Create Tournament -> Auction`, import the auction JSON.
2. Confirm:
   - auction success banner appears
   - contest is visible in `/auction`
   - contest tournament name matches the imported tournament
   - player pool matches the tournament squads

## Squad And Lineup

1. Open `Squad Manager`.
2. Edit a squad player for the tournament or league team.
3. Confirm the player appears in `Fantasy -> Add Team`.
4. Open `Score Updates -> Playing XI`.
5. Save Playing XI for both teams.
6. Confirm:
   - future matches start with no preselected XI
   - team-selection tiles show green/red dots correctly
   - `MyXI Picks` and `Backups` also show the dots
   - non-playing selected players are eligible for backup replacement in scoring

## Playing XI Change Impact

1. Save Playing XI for a match.
2. Open `Fantasy -> Add/Edit Team` for that same match.
3. Confirm:
   - green dot = player in Playing XI
   - red dot = player not in Playing XI
   - the same dots appear in squad tiles, `MyXI Picks`, and `Backups`
4. Change the saved Playing XI for the same match.
5. Confirm:
   - the dots update on refresh/reopen
   - future matches remain unaffected
   - another tournament remains unaffected

## Fantasy Flow

1. Create a fantasy contest on the imported tournament.
2. Join the contest as a normal user.
3. Open a match and save a team.
4. Confirm:
   - started contests are still joinable
   - started matches remain visible but read-only
   - `C` and `VC` are required
   - selected player cannot remain in backups
   - backup player promoted into XI is removed from backups
   - the same player cannot be both `C` and `VC`
   - a `C` selection disables that player in the `VC` dropdown and vice versa

## Shared Tournament Model

1. Create/import one tournament.
2. Under that same tournament, create:
   - one fantasy contest
   - one auction contest
3. Confirm:
   - both contests stay linked to the same tournament matches
   - both contests read from the same tournament scorecard updates
   - tournament player stats are common/shared
   - contest leaderboards are separate

## Scorecards

1. Open `Score Updates -> Scorecards -> JSON Upload`.
2. Upload a scorecard JSON for a match.
3. Switch to `Manual Entry`.
4. Confirm:
   - saved batting/bowling/fielding values are hydrated
   - tournament player stats update
   - manual save persists too
   - the exact same scorecard affects both fantasy and auction consumers under that tournament
   - started match remains visible in contest detail after score upload

## Individual Player Update Checks

1. Upload a scorecard where only one or two players have non-zero stats.
2. Confirm:
   - only those players gain tournament stats
   - unrelated players remain unchanged
   - fantasy points are recalculated only where those players are relevant
   - auction points are recalculated only for participants owning those players
3. Update the same match scorecard again with different values.
4. Confirm:
   - latest active score replaces the earlier one
   - player stats reflect the latest upload, not doubled values
   - fantasy leaderboard reflects the latest upload
   - auction leaderboard reflects the latest upload

## Leaderboards

1. After score upload, check tournament player stats first.
2. Then check fantasy contest leaderboard.
3. Check auction contest leaderboard for the same tournament.
3. Confirm:
   - tournament stats update once at the tournament level
   - both update from the same tournament scorecard
   - fantasy and auction totals differ only by roster model
   - `C/VC` affects fantasy participant scores only
   - `C/VC` does not affect tournament player stats
   - if no fantasy participant selected a scoring player, fantasy leaderboard may not move
   - if an auction roster owns that scoring player, auction leaderboard should move

## Read-Only Started Match Behavior

1. Use a started or in-progress match in a contest.
2. Confirm:
   - contest is still joinable
   - match is still visible in the contest schedule
   - add/edit team is read-only for that match
   - preview still works
   - scorecard updates are still allowed from admin

## Delete Safety

1. Delete a contest.
2. Confirm only that contest’s participant data is removed.
3. Delete a tournament.
4. Confirm:
   - related contests are removed
   - match scorecards/player stats for that tournament are removed
   - shared player master records remain

## Final Go/No-Go

Production-safe enough to host only if all of these are true:

- tournament import works in DB mode
- auction import works in DB mode
- fantasy and auction contests can coexist under the same tournament
- Playing XI save works in DB mode
- Playing XI changes are reflected in team selection
- scorecard JSON save works in DB mode
- manual scorecard view hydrates from saved data
- tournament player stats update correctly
- fantasy leaderboard updates
- auction leaderboard updates
- latest score upload replaces the older scorecard cleanly
- delete flows behave safely
- auth/login/reset flows work against the migrated schema
