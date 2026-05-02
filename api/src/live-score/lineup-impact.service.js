import { dbQuery } from '../db.js'
import { AUTO_SYNC_ACTOR_LABEL } from './settings.js'
import { recordLiveScoreDbWrite } from './logger.js'

const normalizeName = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const playerDisplayName = (player = {}) =>
  (
    player.displayName ||
    player.name ||
    [player.firstName, player.lastName].filter(Boolean).join(' ')
  )
    .toString()
    .trim()

const appendScoredPlayersToLineups = async ({
  match,
  lineupContext,
  playerStats = [],
  tournamentContext = {},
  context = {},
}) => {
  const teamKeys = new Set(
    [match.teamAKey || match.teamA, match.teamBKey || match.teamB]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )
  const teamByPlayerName = new Map()
  for (const player of tournamentContext.tournamentPlayerRows || []) {
    const name = normalizeName(playerDisplayName(player))
    const teamKey = String(player.teamKey || player.team || '').trim()
    if (!name || !teamKeys.has(teamKey)) continue
    if (!teamByPlayerName.has(name)) teamByPlayerName.set(name, teamKey)
  }

  const lineupRows = lineupContext.lineupRows || []
  const lineupNames = new Set(
    lineupRows.flatMap((row) => parseJsonArray(row.playingXI).map(normalizeName)),
  )
  const additionsByTeam = new Map()

  for (const row of playerStats) {
    const playerName = (row?.playerName || row?.name || '').toString().trim()
    const playerKey = normalizeName(playerName)
    if (!playerKey || lineupNames.has(playerKey)) continue
    const teamKey = teamByPlayerName.get(playerKey)
    if (!teamKey) continue
    if (!additionsByTeam.has(teamKey)) additionsByTeam.set(teamKey, [])
    additionsByTeam.get(teamKey).push(playerName)
    lineupNames.add(playerKey)
  }

  if (!additionsByTeam.size) return { added: 0, players: [] }

  const addedPlayers = []
  for (const row of lineupRows) {
    const teamCode = String(row.teamCode || '').trim()
    const additions = additionsByTeam.get(teamCode) || []
    if (!additions.length) continue
    const playingXI = parseJsonArray(row.playingXI)
    const nextPlayingXI = [...playingXI, ...additions]
    await dbQuery(
      `UPDATE match_lineups
       SET playing_xi = $1::jsonb,
           updated_by = $2,
           updated_at = now()
       WHERE tournament_id = $3
         AND match_id = $4
         AND team_code = $5`,
      [
        JSON.stringify(nextPlayingXI),
        AUTO_SYNC_ACTOR_LABEL,
        match.tournamentId,
        match.id,
        teamCode,
      ],
    )
    await recordLiveScoreDbWrite(context, {
      table: 'match_lineups',
      action: 'update',
      rows: 1,
      fields: ['playing_xi', 'updated_by', 'updated_at'],
      matchId: match.id,
      tournamentId: match.tournamentId,
      matchLabel: match.name,
      message: `DB appended scored player(s) to Playing XI for ${teamCode}: ${additions.join(', ')}`,
      details: {
        fn: 'appendScoredPlayersToLineups',
        teamCode,
        addedPlayers: additions,
        updatedBy: AUTO_SYNC_ACTOR_LABEL,
      },
    })
    row.playingXI = nextPlayingXI
    addedPlayers.push(...additions.map((name) => ({ teamCode, name })))
  }

  lineupContext.playingXiNames = [
    ...new Set([
      ...(lineupContext.playingXiNames || []),
      ...addedPlayers.map((player) => player.name),
    ]),
  ]
  return { added: addedPlayers.length, players: addedPlayers }
}

export { appendScoredPlayersToLineups, parseJsonArray }
