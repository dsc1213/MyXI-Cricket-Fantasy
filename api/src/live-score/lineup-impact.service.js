import { dbQuery } from '../db.js'
import { AUTO_SYNC_ACTOR_LABEL } from './settings.js'
import { recordLiveScoreDbWrite, recordLiveScoreLog } from './logger.js'
import liveScoreProviderService, { playingXiToMatchLineups } from './provider.service.js'
import { canonicalizeLineupNamesWithSquad } from './player-name-match.js'

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

const getProviderImpactPlayersByTeam = async ({ match, tournamentContext, context }) => {
  if (!match.providerMatchId) return new Map()
  try {
    const providerPlayingXi = await liveScoreProviderService.getPlayingXi(
      match.providerMatchId,
      {
        ...context,
        matchId: match.id,
        tournamentId: match.tournamentId,
      },
    )
    const lineups = playingXiToMatchLineups(providerPlayingXi, match)
    const players = tournamentContext.tournamentPlayerRows || []
    const impactByTeam = new Map()

    Object.entries(lineups).forEach(([teamCode, lineup]) => {
      canonicalizeLineupNamesWithSquad(lineup, players)
      const impactPlayers = Array.isArray(lineup.impactPlayers)
        ? lineup.impactPlayers
        : []
      impactByTeam.set(
        String(teamCode || '').trim(),
        new Map(
          impactPlayers
            .map((name) => [normalizeName(name), String(name || '').trim()])
            .filter(([key, name]) => key && name),
        ),
      )
    })

    return impactByTeam
  } catch (error) {
    await recordLiveScoreLog(context, {
      level: 'warn',
      step: 'impact-player',
      status: 'skipped',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: match.name,
      message: 'Could not verify scored player against provider impact list',
      details: {
        fn: 'getProviderImpactPlayersByTeam',
        route: match.providerMatchId ? `/playing-xi/${match.providerMatchId}` : '',
        error: error?.message || String(error),
      },
    })
    return new Map()
  }
}

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
  const candidatesByTeam = new Map()

  for (const row of playerStats) {
    const playerName = (row?.playerName || row?.name || '').toString().trim()
    const playerKey = normalizeName(playerName)
    if (!playerKey || lineupNames.has(playerKey)) continue
    const teamKey = teamByPlayerName.get(playerKey)
    if (!teamKey) continue
    if (!candidatesByTeam.has(teamKey)) candidatesByTeam.set(teamKey, [])
    candidatesByTeam.get(teamKey).push({ key: playerKey, name: playerName })
  }

  if (!candidatesByTeam.size) return { added: 0, players: [] }

  const providerImpactByTeam = await getProviderImpactPlayersByTeam({
    match,
    tournamentContext,
    context,
  })
  const additionsByTeam = new Map()
  const skippedPlayers = []

  for (const [teamKey, candidates] of candidatesByTeam.entries()) {
    const impactPlayers = providerImpactByTeam.get(teamKey) || new Map()
    for (const candidate of candidates) {
      const verifiedName = impactPlayers.get(candidate.key)
      if (!verifiedName) {
        skippedPlayers.push({ teamCode: teamKey, name: candidate.name })
        continue
      }
      if (!additionsByTeam.has(teamKey)) additionsByTeam.set(teamKey, [])
      additionsByTeam.get(teamKey).push(verifiedName)
      lineupNames.add(candidate.key)
    }
  }

  if (skippedPlayers.length) {
    await recordLiveScoreLog(context, {
      step: 'impact-player',
      status: 'skipped',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: match.name,
      message: 'Ignored scored player(s) not listed as provider impact player(s)',
      details: {
        fn: 'appendScoredPlayersToLineups',
        skippedPlayers,
      },
    })
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
