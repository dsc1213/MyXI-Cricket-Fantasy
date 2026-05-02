import { dbQuery } from '../db.js'
import matchLiveSyncRepository from './repository.js'
import liveScoreProviderService, { playingXiToMatchLineups } from './provider.service.js'
import playerService from '../services/player.service.js'
import { logAutoSyncActivity } from './activity.service.js'
import { recordLiveScoreDbWrite, recordLiveScoreLog } from './logger.js'
import { ensureScraperLineupPlayersInSquad } from './squad-sync.service.js'
import { AUTO_SYNC_ACTOR_LABEL, logLiveScore, warnLiveScore } from './settings.js'

const findStartedMatchesForDiscovery = async () => {
  const result = await dbQuery(
    `SELECT m.id,
            m.tournament_id as "tournamentId",
            m.name,
            m.team_a as "teamA",
            m.team_b as "teamB",
            m.team_a_key as "teamAKey",
            m.team_b_key as "teamBKey",
            tsa.team_name as "teamAName",
            tsb.team_name as "teamBName",
            m.start_time as "startTime",
            COALESCE(mls.live_sync_enabled, true) as "liveSyncEnabled",
            mls.provider_match_id as "providerMatchId",
            mls.lineup_synced_at as "lineupSyncedAt"
     FROM matches m
     LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
     LEFT JOIN team_squads tsa
       ON tsa.tournament_id = m.tournament_id
      AND tsa.team_code = COALESCE(m.team_a_key, m.team_a)
     LEFT JOIN team_squads tsb
       ON tsb.tournament_id = m.tournament_id
      AND tsb.team_code = COALESCE(m.team_b_key, m.team_b)
     WHERE lower(m.status) = ANY($1::text[])
       AND COALESCE(mls.live_sync_enabled, true) = true
       AND mls.lineup_synced_at IS NULL
     ORDER BY m.start_time ASC`,
    [['started', 'inprogress']],
  )
  return result.rows || []
}

const hasCompleteLineups = (lineups = {}) =>
  Object.values(lineups).filter((lineup) => (lineup?.playingXI || []).length >= 11)
    .length >= 2

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

const matchLabel = (match = {}) =>
  match.name ||
  `${match.teamAKey || match.teamA || 'Team A'} vs ${match.teamBKey || match.teamB || 'Team B'}`

const preserveExistingBenchWhenMissing = async (tournamentId, matchId, lineups = {}) => {
  const result = await dbQuery(
    `SELECT team_code as "teamCode", bench
     FROM match_lineups
     WHERE tournament_id = $1 AND match_id = $2`,
    [tournamentId, matchId],
  )
  const existingBenchByTeam = new Map(
    (result.rows || []).map((row) => [String(row.teamCode || ''), parseJsonArray(row.bench)]),
  )
  for (const [teamCode, lineup] of Object.entries(lineups)) {
    if ((lineup.bench || []).length) continue
    const existingBench = existingBenchByTeam.get(String(teamCode)) || []
    if (existingBench.length) lineup.bench = existingBench
  }
}

const syncPlayingXiForStartedMatch = async (
  match,
  providerMatchId,
  providerMatch = null,
  context = {},
) => {
  await recordLiveScoreLog(context, {
    step: 'playing-xi',
    status: 'started',
    matchId: match.id,
    tournamentId: match.tournamentId,
    providerMatchId,
    matchLabel: matchLabel(match),
    message: 'Fetching Playing XI',
    details: { fn: 'syncPlayingXiForStartedMatch', route: `/playing-xi/${providerMatchId}` },
  })
  const playingXi = await liveScoreProviderService.getPlayingXi(providerMatchId, {
    ...context,
    matchId: match.id,
    tournamentId: match.tournamentId,
  })
  const lineups = playingXiToMatchLineups(playingXi, match)

  if (!hasCompleteLineups(lineups)) {
    context.liveStatus.pxi = {
      status: 'skipped',
      matchId: match.id,
      providerMatchId,
      message: 'Provider Playing XI is incomplete',
    }
    await recordLiveScoreLog(context, {
      level: 'warn',
      step: 'playing-xi',
      status: 'skipped',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId,
      matchLabel: matchLabel(match),
      message: 'Provider Playing XI is incomplete',
      details: { fn: 'syncPlayingXiForStartedMatch', route: `/playing-xi/${providerMatchId}` },
    })
    return { skipped: true, reason: 'provider-playing-xi-incomplete' }
  }

  await ensureScraperLineupPlayersInSquad({
    tournamentId: match.tournamentId,
    match,
    lineups,
    context,
  })
  await preserveExistingBenchWhenMissing(match.tournamentId, match.id, lineups)

  await playerService.upsertMatchLineups(match.tournamentId, match.id, lineups, {
    source: 'live-score-api',
    updatedBy: AUTO_SYNC_ACTOR_LABEL,
    meta: {
      provider: 'cricbuzz',
      providerMatchId,
      providerStatus: providerMatch?.status || playingXi?.status || '',
      providerTitle: providerMatch?.title || playingXi?.title || '',
    },
  })
  await recordLiveScoreDbWrite(context, {
    table: 'match_lineups',
    action: 'upsert',
    rows: Object.keys(lineups).length,
    fields: ['squad', 'playing_xi', 'bench', 'source', 'updated_by', 'meta'],
    matchId: match.id,
    tournamentId: match.tournamentId,
    providerMatchId,
    matchLabel: matchLabel(match),
    message: 'DB wrote Playing XI',
    details: {
      teams: Object.entries(lineups).map(([teamCode, lineup]) => ({
        teamCode,
        playingXI: lineup.playingXI?.length || 0,
        impactPlayers: lineup.impactPlayers?.length || 0,
        bench: lineup.bench?.length || 0,
      })),
      updatedBy: AUTO_SYNC_ACTOR_LABEL,
    },
  })

  await matchLiveSyncRepository.upsert(match.id, {
    providerMatchId,
    lineupSyncedAt: new Date().toISOString(),
    lastProviderStatus: providerMatch?.status || playingXi?.status || '',
    lastError: '',
  }, {
    ...context,
    matchId: match.id,
    tournamentId: match.tournamentId,
    providerMatchId,
    matchLabel: matchLabel(match),
  })

  context.liveStatus.pxi = {
    status: 'saved',
    matchId: match.id,
    providerMatchId,
    message: 'Playing XI saved to DB',
  }
  await logAutoSyncActivity({
    context,
    action: 'Auto synced playing XI',
    resourceType: 'match-lineup',
    match,
    detail: `Auto synced Playing XI for match ${match.id}`,
    extraChanges: {
      providerMatchId,
      providerStatus: providerMatch?.status || playingXi?.status || '',
    },
  })
  await recordLiveScoreLog(context, {
    step: 'playing-xi',
    status: 'synced',
    matchId: match.id,
    tournamentId: match.tournamentId,
    providerMatchId,
    matchLabel: matchLabel(match),
    message: 'Saved Playing XI to DB',
    details: { fn: 'syncPlayingXiForStartedMatch', teams: Object.keys(lineups) },
  })

  return { synced: true }
}

const discoverProviderIdsForStartedMatches = async (context = {}) => {
  const matches = await findStartedMatchesForDiscovery()
  await recordLiveScoreLog(context, {
    step: 'lineup-discovery',
    status: 'started',
    message: `Found ${matches.length} started/inprogress match(es) needing lineup sync`,
    details: { matchCount: matches.length },
  })
  const summary = { discovered: 0, lineupsSynced: 0, skipped: 0, failed: 0 }
  if (!matches.length) {
    context.liveStatus.matchId = {
      status: 'not_required',
      message: 'No started/inprogress match needs provider match id discovery',
    }
    context.liveStatus.pxi = {
      status: 'not_required',
      message: 'No started/inprogress match needs Playing XI sync',
    }
  }

  for (const match of matches) {
    let providerMatchId = match.providerMatchId
    let providerMatch = null
    try {
      if (!providerMatchId) {
        context.liveStatus.matchId = {
          status: 'checking',
          matchId: match.id,
          message: 'Checking provider match id from /matches/live',
        }
        const discovery = await liveScoreProviderService.discoverMatch(match, {
          ...context,
          matchId: match.id,
          tournamentId: match.tournamentId,
        })
        if (!discovery.ok) {
          summary.skipped += 1
          context.liveStatus.matchId = {
            status: 'failed',
            matchId: match.id,
            message: discovery.reason,
          }
          context.liveStatus.pxi = {
            status: 'skipped',
            matchId: match.id,
            message: 'Playing XI not fetched because provider match id was not found',
          }
          await matchLiveSyncRepository.updateError(match.id, discovery.reason, {
            step: 'provider-match-discovery',
            fn: 'discoverProviderIdsForStartedMatches',
            route: '/matches/live',
            matchLabel: matchLabel(match),
            syncId: context.syncId,
          })
          await recordLiveScoreLog(context, {
            level: 'warn',
            step: 'provider-match-discovery',
            status: 'skipped',
            matchId: match.id,
            tournamentId: match.tournamentId,
            matchLabel: matchLabel(match),
            message: discovery.reason,
            details: {
              fn: 'discoverProviderIdsForStartedMatches',
              route: '/matches/live',
              candidates: discovery.candidates?.length || 0,
            },
          })
          continue
        }
        providerMatchId = discovery.providerMatchId
        providerMatch = discovery.match
        await matchLiveSyncRepository.upsert(match.id, {
          providerMatchId,
          lastProviderStatus: providerMatch?.status || '',
          lastError: '',
        }, {
          ...context,
          matchId: match.id,
          tournamentId: match.tournamentId,
          providerMatchId,
          matchLabel: matchLabel(match),
        })
        summary.discovered += 1
        context.liveStatus.matchId = {
          status: 'saved',
          matchId: match.id,
          providerMatchId,
          message: 'Provider match id saved to DB',
        }
        logLiveScore('provider-match-discovered', {
          syncId: context.syncId,
          matchId: match.id,
          tournamentId: match.tournamentId,
          providerMatchId,
        })
        await recordLiveScoreLog(context, {
          step: 'provider-match-discovery',
          status: 'synced',
          matchId: match.id,
          tournamentId: match.tournamentId,
          providerMatchId,
          matchLabel: matchLabel(match),
          message: 'Stored provider match id',
          details: { fn: 'discoverProviderIdsForStartedMatches', route: '/matches/live' },
        })
      }
      if (providerMatchId && context.liveStatus.matchId.status === 'pending') {
        context.liveStatus.matchId = {
          status: 'already_saved',
          matchId: match.id,
          providerMatchId,
          message: 'Provider match id already exists in DB',
        }
      }

      const lineupResult = await syncPlayingXiForStartedMatch(
        match,
        providerMatchId,
        providerMatch,
        context,
      )
      if (lineupResult?.synced) summary.lineupsSynced += 1
      else {
        summary.skipped += 1
        await matchLiveSyncRepository.updateError(match.id, lineupResult?.reason, {
          step: 'playing-xi',
          fn: 'syncPlayingXiForStartedMatch',
          route: providerMatchId ? `/playing-xi/${providerMatchId}` : '',
          providerMatchId,
          matchLabel: matchLabel(match),
          syncId: context.syncId,
        })
      }
    } catch (error) {
      summary.failed += 1
      context.liveStatus.pxi = {
        status: 'failed',
        matchId: match.id,
        providerMatchId,
        message: error?.message || String(error),
      }
      await matchLiveSyncRepository.updateError(match.id, error?.message || error, {
        step: 'playing-xi',
        fn: 'discoverProviderIdsForStartedMatches',
        route: providerMatchId ? `/playing-xi/${providerMatchId}` : '/matches/live',
        providerMatchId,
        matchLabel: matchLabel(match),
        syncId: context.syncId,
      })
      warnLiveScore('provider-playing-xi-sync-failed', {
        syncId: context.syncId,
        matchId: match.id,
        tournamentId: match.tournamentId,
        match: matchLabel(match),
        route: providerMatchId ? `/playing-xi/${providerMatchId}` : '/matches/live',
        fn: 'discoverProviderIdsForStartedMatches',
        error: error?.message || String(error),
      })
      await recordLiveScoreLog(context, {
        level: 'error',
        step: 'playing-xi',
        status: 'failed',
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId,
        matchLabel: matchLabel(match),
        message: error?.message || String(error),
        details: {
          fn: 'discoverProviderIdsForStartedMatches',
          route: providerMatchId ? `/playing-xi/${providerMatchId}` : '/matches/live',
        },
      })
    }
  }

  return summary
}

export { discoverProviderIdsForStartedMatches }
