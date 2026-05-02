import { dbQuery } from '../db.js'
import { getAutoCompleteHours, logLiveScore } from './settings.js'
import { recordLiveScoreDbWrite, recordLiveScoreLog } from './logger.js'

const STARTED_WINDOW_MINUTES = 30

const matchLabelSql = `COALESCE(
  NULLIF(name, ''),
  CONCAT_WS(' vs ', NULLIF(team_a_key, ''), NULLIF(team_b_key, '')),
  CONCAT_WS(' vs ', NULLIF(team_a, ''), NULLIF(team_b, ''))
) as "matchLabel",
team_a_key as "teamAKey",
team_b_key as "teamBKey",
team_a as "teamA",
team_b as "teamB",
start_time as "startTime"`

const runStatusMaintenance = async (context = {}) => {
  const autoCompleteHours = getAutoCompleteHours()

  const startedResult = await dbQuery(
    `UPDATE matches
     SET status = 'started', updated_at = now()
     WHERE lower(status) = 'notstarted'
       AND now() >= start_time - ($1::int * interval '1 minute')
       AND now() < start_time
     RETURNING id, tournament_id as "tournamentId", status, ${matchLabelSql}`,
    [STARTED_WINDOW_MINUTES],
  )

  const inProgressResult = await dbQuery(
    `UPDATE matches
     SET status = 'inprogress', updated_at = now()
     WHERE lower(status) = ANY($1::text[])
       AND now() >= start_time
     RETURNING id, tournament_id as "tournamentId", status, ${matchLabelSql}`,
    [['started', 'notstarted']],
  )

  const completedResult = await dbQuery(
    `UPDATE matches
     SET status = 'completed', updated_at = now()
     WHERE lower(status) = ANY($1::text[])
       AND now() >= start_time + ($2::int * interval '1 hour')
     RETURNING id, tournament_id as "tournamentId", status, ${matchLabelSql}`,
    [['started', 'inprogress'], autoCompleteHours],
  )

  const transitions = [
    ...(startedResult.rows || []).map((row) => ({ ...row, result: 'started' })),
    ...(inProgressResult.rows || []).map((row) => ({ ...row, result: 'inprogress' })),
    ...(completedResult.rows || []).map((row) => ({
      ...row,
      result: 'completed',
      reason: 'stale-fallback',
    })),
  ]
  for (const row of transitions) {
    const fields = {
      syncId: context.syncId,
      matchId: row.id,
      tournamentId: row.tournamentId,
      match: row.matchLabel,
      teams: `${row.teamAKey || row.teamA || 'Team A'} vs ${row.teamBKey || row.teamB || 'Team B'}`,
      startTime: row.startTime,
      result: row.result,
      ...(row.reason ? { reason: row.reason } : {}),
    }
    logLiveScore('match-status-transition', fields)
    await recordLiveScoreLog(context, {
      step: 'match-status-transition',
      status: 'synced',
      matchId: row.id,
      tournamentId: row.tournamentId,
      matchLabel: row.matchLabel,
      message: `Match status changed to ${row.result}`,
      details: fields,
    })
    await recordLiveScoreDbWrite(context, {
      table: 'matches',
      action: 'update',
      rows: 1,
      fields: ['status', 'updated_at'],
      matchId: row.id,
      tournamentId: row.tournamentId,
      matchLabel: row.matchLabel,
      message: `DB wrote match status=${row.result}`,
      details: {
        newStatus: row.result,
        reason: row.reason || 'time-transition',
        startTime: row.startTime,
      },
    })
  }

  return {
    started: startedResult.rows.length,
    inprogress: inProgressResult.rows.length,
    completed: completedResult.rows.length,
  }
}

export { runStatusMaintenance }
