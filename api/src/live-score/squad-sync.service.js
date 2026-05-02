import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { recordLiveScoreDbWrite, recordLiveScoreLog } from './logger.js'
import {
  canonicalizeLineupNamesWithSquad,
  normalizePlayerNameKey,
  playerDisplayName,
} from './player-name-match.js'

const factory = createRepositoryFactory()

const splitName = (name = '') => {
  const parts = name.toString().trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] || name, lastName: '' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1).join(' '),
  }
}

const ensureScraperLineupPlayersInSquad = async ({
  tournamentId,
  match,
  lineups = {},
  context = {},
}) => {
  const repo = await factory.getPlayerRepository()
  const additions = []

  for (const [teamCode, lineup] of Object.entries(lineups)) {
    const currentPlayers = await repo.findByTeam(teamCode, tournamentId)
    const currentNames = new Set(
      (currentPlayers || [])
        .map((player) => normalizePlayerNameKey(playerDisplayName(player)))
        .filter(Boolean),
    )
    canonicalizeLineupNamesWithSquad(lineup, currentPlayers || [])
    const providerPlayers = Array.isArray(lineup.providerPlayers)
      ? lineup.providerPlayers
      : []

    for (const player of providerPlayers) {
      const name = (player.name || '').toString().trim()
      const nameKey = normalizePlayerNameKey(name)
      if (!nameKey || currentNames.has(nameKey)) continue

      const { firstName, lastName } = splitName(name)
      const canonical =
        typeof repo.upsertCanonical === 'function'
          ? await repo.upsertCanonical({
              firstName,
              lastName,
              displayName: name,
              role: player.role || 'PLAYER',
              teamKey: teamCode,
              teamName: teamCode,
              playerId: player.playerId || '',
              country: '',
              sourceKey: player.playerId || '',
              active: true,
            })
          : await repo.create({
              firstName,
              lastName,
              displayName: name,
              role: player.role || 'PLAYER',
              teamKey: teamCode,
              teamName: teamCode,
              playerId: player.playerId || '',
              country: '',
              sourceKey: player.playerId || '',
              active: true,
            })

      await dbQuery(
        `INSERT INTO tournament_players (
           tournament_id, player_id, team_code, role, active, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, true, now(), now())
         ON CONFLICT (tournament_id, player_id) DO UPDATE
         SET team_code = excluded.team_code,
             role = COALESCE(NULLIF(excluded.role, ''), tournament_players.role),
             active = true,
             updated_at = now()`,
        [tournamentId, canonical.id, teamCode, player.role || canonical.role || 'PLAYER'],
      )

      currentNames.add(nameKey)
      additions.push({
        teamCode,
        name,
        playerId: player.playerId || '',
        role: player.role || canonical.role || 'PLAYER',
      })
    }
  }

  if (additions.length) {
    const playerSummary = additions
      .map((player) => `${player.name} (${player.teamCode})`)
      .join(', ')
    await recordLiveScoreDbWrite(context, {
      table: 'players,tournament_players',
      action: 'upsert',
      rows: additions.length,
      fields: ['players.display_name', 'players.source_key', 'tournament_players.team_code'],
      matchId: match?.id,
      tournamentId,
      matchLabel: match?.name,
      message: `DB wrote missing scraper squad players: ${playerSummary}`,
      details: {
        fn: 'ensureScraperLineupPlayersInSquad',
        players: additions,
      },
    })
    await recordLiveScoreLog(context, {
      step: 'squad-sync',
      status: 'synced',
      matchId: match?.id,
      tournamentId,
      matchLabel: match?.name,
      message: `Auto-added ${additions.length} missing scraper player(s) to squad: ${playerSummary}`,
      details: {
        fn: 'ensureScraperLineupPlayersInSquad',
        players: additions,
      },
    })
  }

  return additions
}

export { ensureScraperLineupPlayersInSquad }
