import { dbQuery } from '../db.js'
import matchLiveSyncRepository from './repository.js'
import liveScoreProviderService, {
  isProviderActiveScorecard,
  isProviderCompletedStatus,
  scorecardToPlayerStats,
} from './provider.service.js'
import matchScoreService from '../services/match-score.service.js'
import { appendScoredPlayersToLineups, parseJsonArray } from './lineup-impact.service.js'
import { logAutoSyncActivity } from './activity.service.js'
import { recordLiveScoreDbWrite, recordLiveScoreLog } from './logger.js'
import { warnLiveScore } from './settings.js'
import { canonicalizePlayerStatsWithSquad } from './player-name-match.js'

const runningMatchIds = new Set()

const matchLabel = (match = {}) =>
  match.name ||
  `${match.teamAKey || match.teamA || 'Team A'} vs ${match.teamBKey || match.teamB || 'Team B'}`

const findScoreSyncMatches = async () => {
  const result = await dbQuery(
    `SELECT m.id,
            m.tournament_id as "tournamentId",
            m.name,
            m.team_a as "teamA",
            m.team_b as "teamB",
            m.team_a_key as "teamAKey",
            m.team_b_key as "teamBKey",
            m.status,
            m.start_time as "startTime",
            m.source_key as "sourceKey",
            mls.provider_match_id as "providerMatchId",
            COALESCE(mls.live_sync_enabled, true) as "liveSyncEnabled"
     FROM matches m
     LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
     WHERE lower(m.status) = 'inprogress'
       AND now() >= m.start_time
       AND COALESCE(mls.live_sync_enabled, true) = true
       AND mls.provider_match_id IS NOT NULL
       AND mls.provider_match_id <> ''
       AND mls.lineup_synced_at IS NOT NULL
     ORDER BY m.start_time ASC`,
  )
  return result.rows || []
}

const getMatchLineupContext = async (matchId, tournamentId) => {
  const result = await dbQuery(
    `SELECT team_code as "teamCode", playing_xi as "playingXI"
     FROM match_lineups
     WHERE tournament_id = $1
       AND match_id = $2
       AND jsonb_array_length(playing_xi) > 0`,
    [tournamentId, matchId],
  )
  const lineupRows = result.rows || []
  const playingXiNames = [
    ...new Set(
      lineupRows.flatMap((row) =>
        parseJsonArray(row.playingXI)
          .map((name) => String(name || '').trim())
          .filter(Boolean),
      ),
    ),
  ]
  return {
    hasLineups: lineupRows.length >= 2,
    lineupRows,
    playingXiNames,
  }
}

const getMatchTournamentPlayers = (match = {}, tournamentContext = {}) => {
  const teamKeys = new Set(
    [match.teamAKey || match.teamA, match.teamBKey || match.teamB]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )
  return (tournamentContext.tournamentPlayerRows || []).filter((player) =>
    teamKeys.has(String(player.teamKey || player.team || '').trim()),
  )
}

const syncScoreForMatch = async (
  match,
  tournamentContext = {},
  context = {},
  options = {},
) => {
  const isForceSync = Boolean(options.force)
  const matchKey = String(match.id)
  if (runningMatchIds.has(matchKey)) {
    await recordLiveScoreLog(context, {
      step: 'score-sync',
      status: 'skipped',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
      message: 'Match sync already running',
      details: { fn: 'syncScoreForMatch' },
    })
    return { skipped: true, reason: 'match-sync-already-running' }
  }
  runningMatchIds.add(matchKey)

  try {
    const lineupContext = await getMatchLineupContext(match.id, match.tournamentId)
    if (!lineupContext.hasLineups) {
      context.liveStatus.latestMatchScores = {
        status: 'skipped',
        matchId: match.id,
        providerMatchId: match.providerMatchId,
        message: 'Playing XI missing; scorecard not fetched',
      }
      await recordLiveScoreLog(context, {
        step: 'score-sync',
        status: 'skipped',
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId: match.providerMatchId,
        matchLabel: matchLabel(match),
        message: 'Playing XI missing; scorecard not fetched',
        details: { fn: 'syncScoreForMatch', route: `/scorecard/${match.providerMatchId}` },
      })
      return { skipped: true, reason: 'playing-xi-missing' }
    }

    await recordLiveScoreLog(context, {
      step: 'score-sync',
      status: 'started',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
      message: 'Fetching scorecard',
      details: { fn: 'syncScoreForMatch', route: `/scorecard/${match.providerMatchId}` },
    })
    const scorecard = await liveScoreProviderService.getScorecard(match.providerMatchId, {
      ...context,
      matchId: match.id,
      tournamentId: match.tournamentId,
    })
    const providerStatus = scorecard?.status || ''
    const playerStats = canonicalizePlayerStatsWithSquad(
      scorecardToPlayerStats(scorecard),
      getMatchTournamentPlayers(match, tournamentContext),
    )
    await matchLiveSyncRepository.upsert(match.id, {
      providerMatchId: match.providerMatchId,
      lastProviderStatus: providerStatus,
    }, {
      ...context,
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
    })

    const providerCompleted = isProviderCompletedStatus(providerStatus)
    const providerLive = isProviderActiveScorecard(scorecard)
    if (!isForceSync && !providerCompleted && !providerLive) {
      context.liveStatus.latestMatchScores = {
        status: 'skipped',
        matchId: match.id,
        providerMatchId: match.providerMatchId,
        providerStatus,
        message: `Playing XI saved but match is not live/completed in scraper: ${providerStatus || 'blank status'}`,
      }
      await recordLiveScoreLog(context, {
        step: 'score-sync',
        status: 'skipped',
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId: match.providerMatchId,
        matchLabel: matchLabel(match),
        message: 'Provider status is not live/completed',
        details: {
          fn: 'syncScoreForMatch',
          route: `/scorecard/${match.providerMatchId}`,
          providerStatus,
        },
      })
      return { skipped: true, reason: 'provider-not-live', providerStatus }
    }

    const impactResult = await appendScoredPlayersToLineups({
      match,
      lineupContext,
      playerStats,
      tournamentContext,
      context,
    })
    if (impactResult.added) {
      await logAutoSyncActivity({
        context,
        action: 'Auto added scored impact player',
        resourceType: 'match-lineup',
        match,
        detail: `Auto added ${impactResult.added} scored player(s) to Playing XI for match ${match.id}`,
        extraChanges: {
          providerMatchId: match.providerMatchId,
          players: impactResult.players,
        },
      })
      await recordLiveScoreLog(context, {
        step: 'impact-player',
        status: 'synced',
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId: match.providerMatchId,
        matchLabel: matchLabel(match),
        message: `Added ${impactResult.added} scored impact player(s) to DB lineup`,
        details: { fn: 'appendScoredPlayersToLineups', players: impactResult.players },
      })
    }

    const scorecardProvider = {
      getPlayerStats: async () => ({ scorecard, playerStats }),
    }
    const result = await matchScoreService.syncLiveMatchScores({
      tournamentId: match.tournamentId,
      matchId: match.id,
      sourceMatchId: match.providerMatchId,
      uploadedBy: options.uploadedBy || null,
      provider: scorecardProvider,
      context: {
        ...context,
        ...tournamentContext,
        match,
        providerMatchId: match.providerMatchId,
        lineupRows: lineupContext.lineupRows,
        playingXiNames: lineupContext.playingXiNames,
      },
    })

    if (providerCompleted) {
      await dbQuery(
        `UPDATE matches SET status = 'completed', updated_at = now() WHERE id = $1`,
        [match.id],
      )
      await recordLiveScoreDbWrite(context, {
        table: 'matches',
        action: 'update',
        rows: 1,
        fields: ['status', 'updated_at'],
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId: match.providerMatchId,
        matchLabel: matchLabel(match),
        message: 'DB wrote match status=completed from provider',
        details: {
          fn: 'syncScoreForMatch',
          providerStatus,
        },
      })
      await recordLiveScoreLog(context, {
        step: 'match-status',
        status: 'synced',
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId: match.providerMatchId,
        matchLabel: matchLabel(match),
        message: 'Marked match completed from provider status',
        details: { fn: 'syncScoreForMatch', providerStatus },
      })
    }

    await matchLiveSyncRepository.upsert(match.id, {
      providerMatchId: match.providerMatchId,
      lastScoreSyncAt: new Date().toISOString(),
      lastProviderStatus: providerStatus,
      lastError: '',
    }, {
      ...context,
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
    })

    await logAutoSyncActivity({
      context,
      action: result?.skipped
        ? isForceSync
          ? 'Admin force score sync skipped'
          : 'Auto score sync skipped'
        : providerCompleted
          ? isForceSync
            ? 'Admin force synced final match score'
            : 'Auto synced final match score'
          : isForceSync
            ? 'Admin force synced match score'
            : 'Auto synced live match score',
      resourceType: 'match-score',
      match,
      detail: result?.skipped
        ? `Auto score sync skipped for match ${match.id}: ${result.reason || 'unchanged'}`
        : `Auto synced ${providerCompleted ? 'final' : 'live'} score for match ${match.id}`,
      extraChanges: {
        providerMatchId: match.providerMatchId,
        providerStatus,
        reason: result?.reason || '',
        savedPlayers: result?.savedPlayers || 0,
        fetchedPlayers: result?.fetchedPlayers || 0,
      },
    })
    await recordLiveScoreLog(context, {
      step: 'score-sync',
      status: result?.skipped ? 'skipped' : 'synced',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
      message: result?.skipped ? result.reason || 'Score unchanged' : 'Saved score snapshot to DB',
      details: {
        fn: 'syncScoreForMatch',
        route: `/scorecard/${match.providerMatchId}`,
        providerStatus,
        fetchedPlayers: result?.fetchedPlayers || 0,
        savedPlayers: result?.savedPlayers || 0,
      },
    })

    if (providerCompleted) {
      context.liveStatus.latestMatchScores = {
        status: 'completed',
        matchId: match.id,
        providerMatchId: match.providerMatchId,
        providerStatus,
        message: 'Final score saved and match marked completed',
      }
      return { completed: true }
    }
    if (result?.skipped) {
      context.liveStatus.latestMatchScores = {
        status: 'skipped',
        matchId: match.id,
        providerMatchId: match.providerMatchId,
        providerStatus,
        message: result.reason || 'Score sync skipped',
      }
      return { skipped: true, reason: result.reason }
    }
    context.liveStatus.latestMatchScores = {
      status: 'saved',
      matchId: match.id,
      providerMatchId: match.providerMatchId,
      providerStatus,
      message: 'Latest match scores saved to DB',
    }
    return { synced: true }
  } catch (error) {
    context.liveStatus.latestMatchScores = {
      status: 'failed',
      matchId: match.id,
      providerMatchId: match.providerMatchId,
      message: error?.message || String(error),
    }
    await matchLiveSyncRepository.updateError(match.id, error?.message || error, {
      step: 'score-sync',
      fn: 'syncScoreForMatch',
      route: match.providerMatchId ? `/scorecard/${match.providerMatchId}` : '',
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
      syncId: context.syncId,
    })
    await recordLiveScoreLog(context, {
      level: 'error',
      step: 'score-sync',
      status: 'failed',
      matchId: match.id,
      tournamentId: match.tournamentId,
      providerMatchId: match.providerMatchId,
      matchLabel: matchLabel(match),
      message: error?.message || String(error),
      details: {
        fn: 'syncScoreForMatch',
        route: match.providerMatchId ? `/scorecard/${match.providerMatchId}` : '',
      },
    })
    throw error
  } finally {
    runningMatchIds.delete(matchKey)
  }
}

const runScoreSync = async (context = {}) => {
  const matches = await findScoreSyncMatches()
  await recordLiveScoreLog(context, {
    step: 'score-candidates',
    status: 'started',
    message: `Found ${matches.length} inprogress match(es) eligible for score sync`,
    details: { matchCount: matches.length },
  })
  const summary = { synced: 0, skipped: 0, completed: 0, failed: 0 }
  if (!matches.length) {
    context.liveStatus.latestMatchScores = {
      status: 'not_required',
      message: 'No inprogress match is eligible for score sync',
    }
  }
  const tournamentContextById = new Map()

  for (const match of matches) {
    try {
      const tournamentKey = String(match.tournamentId)
      if (!tournamentContextById.has(tournamentKey)) {
        tournamentContextById.set(
          tournamentKey,
          await matchScoreService.buildTournamentScoreContext(match.tournamentId),
        )
      }
      const result = await syncScoreForMatch(
        match,
        tournamentContextById.get(tournamentKey),
        context,
      )
      if (result?.completed) summary.completed += 1
      else if (result?.skipped) summary.skipped += 1
      else summary.synced += 1
    } catch (error) {
      summary.failed += 1
      warnLiveScore('score-sync-failed', {
        syncId: context.syncId,
        matchId: match.id,
        tournamentId: match.tournamentId,
        providerMatchId: match.providerMatchId,
        match: matchLabel(match),
        route: match.providerMatchId ? `/scorecard/${match.providerMatchId}` : '',
        fn: 'runScoreSync',
        error: error?.message || String(error),
      })
    }
  }

  return summary
}

const getForceScoreSyncMatch = async (matchId) => {
  const result = await dbQuery(
    `SELECT m.id,
            m.tournament_id as "tournamentId",
            m.name,
            m.team_a as "teamA",
            m.team_b as "teamB",
            m.team_a_key as "teamAKey",
            m.team_b_key as "teamBKey",
            m.status,
            m.start_time as "startTime",
            m.source_key as "sourceKey",
            mls.provider_match_id as "providerMatchId",
            COALESCE(mls.live_sync_enabled, true) as "liveSyncEnabled"
     FROM matches m
     LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
     WHERE m.id = $1
     LIMIT 1`,
    [matchId],
  )
  return result.rows?.[0] || null
}

const forceSyncScoreForMatch = async ({ matchId, actorUserId = null, context = {} }) => {
  const match = await getForceScoreSyncMatch(matchId)
  if (!match) throw new Error('Match not found')
  if (!match.providerMatchId) {
    throw new Error('Provider match ID is required before force score sync')
  }

  await recordLiveScoreLog(context, {
    step: 'force-score-sync',
    status: 'started',
    matchId: match.id,
    tournamentId: match.tournamentId,
    providerMatchId: match.providerMatchId,
    matchLabel: matchLabel(match),
    message: 'Admin force score sync started',
    details: {
      fn: 'forceSyncScoreForMatch',
      route: `/scorecard/${match.providerMatchId}`,
    },
  })

  const tournamentContext = await matchScoreService.buildTournamentScoreContext(
    match.tournamentId,
  )
  const result = await syncScoreForMatch(match, tournamentContext, context, {
    force: true,
    uploadedBy: actorUserId,
  })

  await recordLiveScoreLog(context, {
    step: 'force-score-sync',
    status: result?.skipped ? 'skipped' : 'finished',
    matchId: match.id,
    tournamentId: match.tournamentId,
    providerMatchId: match.providerMatchId,
    matchLabel: matchLabel(match),
    message: result?.skipped
      ? result.reason || 'Admin force score sync skipped'
      : 'Admin force score sync finished',
    details: {
      fn: 'forceSyncScoreForMatch',
      result,
    },
  })

  return {
    ok: !result?.skipped,
    matchId: String(match.id),
    tournamentId: String(match.tournamentId),
    providerMatchId: String(match.providerMatchId),
    result,
  }
}

export { forceSyncScoreForMatch, runScoreSync }
