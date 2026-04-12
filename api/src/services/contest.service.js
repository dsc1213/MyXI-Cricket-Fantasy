import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { mapMatchWithDerivedStatus } from './tournamentImport.service.js'
import teamSelectionService from './team-selection.service.js'
import { resolveEffectiveSelection } from '../scoring.js'
import auditLogService from './audit-log.service.js'

const factory = createRepositoryFactory()
const STARTING_SOON_WINDOW_MS = 6 * 60 * 60 * 1000
const FIXED_ROSTER_COUNTED_SIZE = 11

const normalizeContestDateInput = (value) => {
  const raw = (value || '').toString().trim()
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const normalizeContestStatusInput = (value) => {
  const raw = (value || '').toString().trim().toLowerCase()
  if (!raw) return 'Open'
  if (['completed', 'complete'].includes(raw)) return 'Completed'
  if (['locked', 'closed', 'inactive', 'disabled'].includes(raw)) return 'Locked'
  return 'Open'
}

const deriveContestLifecycle = (contest = {}, nowInput = new Date()) => {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput)
  const rawStatus = (contest?.status || '').toString().trim().toLowerCase()
  const scheduledStart = contest?.startAt ? new Date(contest.startAt) : null
  const manualStart = contest?.startedAt ? new Date(contest.startedAt) : null
  const scheduledStartValid =
    scheduledStart instanceof Date && !Number.isNaN(scheduledStart.getTime())
      ? scheduledStart
      : null
  const manualStartValid =
    manualStart instanceof Date && !Number.isNaN(manualStart.getTime())
      ? manualStart
      : null
  const isCompleted = rawStatus === 'completed'
  const isLocked = ['locked', 'closed', 'inactive', 'disabled'].includes(rawStatus)
  const hasStarted = Boolean(
    manualStartValid ||
    (scheduledStartValid && scheduledStartValid.getTime() <= now.getTime()),
  )

  if (isCompleted) {
    return {
      status: 'Completed',
      joinOpen: false,
      canStart: false,
      hasStarted: true,
    }
  }

  if (hasStarted) {
    return {
      status: 'In Progress',
      joinOpen: false,
      canStart: false,
      hasStarted: true,
    }
  }

  if (isLocked) {
    return {
      status: 'Locked',
      joinOpen: false,
      canStart: false,
      hasStarted: false,
    }
  }

  const msUntilStart = scheduledStartValid
    ? scheduledStartValid.getTime() - now.getTime()
    : Number.POSITIVE_INFINITY
  const startingSoon =
    Number.isFinite(msUntilStart) && msUntilStart <= STARTING_SOON_WINDOW_MS

  return {
    status: startingSoon ? 'Starting Soon' : 'Open',
    joinOpen: true,
    canStart: true,
    hasStarted: false,
  }
}

const buildContestView = (contest = {}, extras = {}) => {
  const lifecycle = deriveContestLifecycle(contest)
  const joinedCount = Number(extras.joinedCount ?? contest?.participantsCount ?? 0)
  const maxPlayers = Number(contest?.maxParticipants || extras.maxPlayers || 0)
  const hasCapacity = maxPlayers <= 0 || joinedCount < maxPlayers
  return {
    ...contest,
    status: lifecycle.status,
    rawStatus: contest?.status || 'Open',
    joinOpen: lifecycle.joinOpen && hasCapacity,
    canStart: lifecycle.canStart,
    hasStarted: lifecycle.hasStarted,
    startAt: contest?.startAt || null,
    startedAt: contest?.startedAt || null,
    joinedCount,
    maxPlayers,
    teams: maxPlayers,
    hasCapacity,
    ...extras,
  }
}

const buildPreviewEntries = (selectionIds = [], playerById = new Map()) =>
  (Array.isArray(selectionIds) ? selectionIds : [])
    .map((id) => playerById.get(String(id)))
    .filter(Boolean)

const sortFixedRosterByTotalPoints = (rows = []) =>
  [...rows].sort((left, right) => {
    if (Number(right.points || 0) !== Number(left.points || 0)) {
      return Number(right.points || 0) - Number(left.points || 0)
    }
    return Number(left.rosterSlot || 0) - Number(right.rosterSlot || 0)
  })

const assignDenseRanks = (rows = [], pointsSelector = (row) => Number(row?.points || 0)) => {
  let lastPoints = null
  let currentRank = 0
  return rows.map((row, index) => {
    const points = Number(pointsSelector(row) || 0)
    if (index === 0 || points !== lastPoints) {
      currentRank = index + 1
      lastPoints = points
    }
    return {
      ...row,
      rank: currentRank,
    }
  })
}

class ContestService {
  async getContestRemovalImpact(contestId) {
    const repo = await factory.getContestRepository()
    const contest = await repo.findByIdIncludingPending(contestId)
    if (!contest) return null
    const summaryResult = await dbQuery(
      `SELECT
         (SELECT COUNT(*)::int FROM contest_joins WHERE contest_id = $1) as "joinedCount",
         (SELECT COUNT(*)::int FROM team_selections WHERE contest_id = $1) as "teamSelectionsCount",
         (SELECT COUNT(*)::int FROM contest_fixed_rosters WHERE contest_id = $1) as "fixedRostersCount",
         (SELECT COUNT(*)::int FROM contest_scores WHERE contest_id = $1) as "contestScoresCount"`,
      [contestId],
    )
    const summary = summaryResult.rows[0] || {}
    return {
      contestId: String(contest.id),
      contestName: contest.name,
      tournamentId: String(contest.tournamentId || ''),
      previousStatus: contest.status || 'Open',
      matchCount: Array.isArray(contest.matchIds) ? contest.matchIds.length : 0,
      joinedCount: Number(summary.joinedCount || 0),
      teamSelectionsCount: Number(summary.teamSelectionsCount || 0),
      fixedRostersCount: Number(summary.fixedRostersCount || 0),
      contestScoresCount: Number(summary.contestScoresCount || 0),
    }
  }

  async getFixedRosterAggregateIndex(contest, { userIds = [] } = {}) {
    const contestId = contest?.id
    const tournamentId = contest?.tournamentId
    const matchIds = Array.isArray(contest?.matchIds)
      ? contest.matchIds.map((value) => String(value || '').trim()).filter(Boolean)
      : []
    if (!contestId || !tournamentId || !matchIds.length) return new Map()

    const normalizedUserIds = (Array.isArray(userIds) ? userIds : [])
      .map((value) => Number(value))
      .filter(Boolean)
    const playerRepo = await factory.getPlayerRepository()
    const [rosterResult, tournamentPlayers] = await Promise.all([
      normalizedUserIds.length
        ? dbQuery(
            `SELECT fr.user_id as "userId",
                    fr.player_ids as "playerIds",
                    u.name,
                    u.game_name as "gameName"
             FROM contest_fixed_rosters fr
             JOIN users u ON u.id = fr.user_id
             WHERE fr.contest_id = $1
               AND fr.user_id = ANY($2::bigint[])`,
            [contestId, normalizedUserIds],
          )
        : dbQuery(
            `SELECT fr.user_id as "userId",
                    fr.player_ids as "playerIds",
                    u.name,
                    u.game_name as "gameName"
             FROM contest_fixed_rosters fr
             JOIN users u ON u.id = fr.user_id
             WHERE fr.contest_id = $1`,
            [contestId],
          ),
      playerRepo.findByTournament(tournamentId),
    ])

    const rosterRows = rosterResult.rows || []
    if (!rosterRows.length) return new Map()

    const allPlayerIds = [
      ...new Set(
        rosterRows.flatMap((row) =>
          (Array.isArray(row.playerIds) ? row.playerIds : [])
            .map((value) => Number(value))
            .filter(Boolean),
        ),
      ),
    ]
    const matchScoreResult = allPlayerIds.length
      ? await dbQuery(
          `SELECT match_id as "matchId", player_id as "playerId", fantasy_points as "fantasyPoints"
           FROM player_match_scores
           WHERE tournament_id = $1
             AND match_id::text = ANY($2::text[])
             AND player_id = ANY($3::bigint[])`,
          [tournamentId, matchIds, allPlayerIds],
        )
      : { rows: [] }

    const playerById = new Map(
      (tournamentPlayers || []).map((player) => [
        Number(player.id),
        {
          id: player.id,
          name:
            player.displayName ||
            [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
          role: player.role || '-',
          team: player.teamKey || player.team || '-',
          imageUrl: player.imageUrl || '',
        },
      ]),
    )

    const pointsByMatchPlayer = new Map()
    const totalPointsByPlayerId = new Map()
    for (const row of matchScoreResult.rows || []) {
      const numericPlayerId = Number(row.playerId)
      const numericPoints = Number(row.fantasyPoints || 0)
      pointsByMatchPlayer.set(`${row.matchId}:${numericPlayerId}`, numericPoints)
      totalPointsByPlayerId.set(
        numericPlayerId,
        Number(totalPointsByPlayerId.get(numericPlayerId) || 0) + numericPoints,
      )
    }

    return new Map(
      rosterRows.map((row) => {
        const orderedPlayerIds = (Array.isArray(row.playerIds) ? row.playerIds : [])
          .map((value) => Number(value))
          .filter(Boolean)
        const unsortedRows = orderedPlayerIds
          .map((playerId, index) => {
            const player = playerById.get(playerId)
            if (!player) return null
            return {
              ...player,
              points: Number(totalPointsByPlayerId.get(playerId) || 0),
              rosterSlot: index + 1,
            }
          })
          .filter(Boolean)
        const rankedRows = sortFixedRosterByTotalPoints(unsortedRows).map((entry, index) => ({
          ...entry,
          counted: index < FIXED_ROSTER_COUNTED_SIZE,
          lineupBucket: index < FIXED_ROSTER_COUNTED_SIZE ? 'playing' : 'bench',
        }))
        const countedPlayerIds = rankedRows
          .filter((entry) => entry.counted)
          .map((entry) => Number(entry.id))
        const matchTotals = new Map(
          matchIds.map((matchId) => [
            String(matchId),
            countedPlayerIds.reduce(
              (sum, playerId) =>
                sum + Number(pointsByMatchPlayer.get(`${matchId}:${playerId}`) || 0),
              0,
            ),
          ]),
        )
        return [
          String(row.userId),
          {
            userId: row.userId,
            name: row.name || row.gameName || '',
            gameName: row.gameName || row.name || '',
            rows: rankedRows,
            countedPlayerIds,
            totalPoints: rankedRows.reduce(
              (sum, entry) => sum + (entry.counted ? Number(entry.points || 0) : 0),
              0,
            ),
            rosterSize: rankedRows.length,
            matchTotals,
          },
        ]
      }),
    )
  }

  async getContestViewerStatsMap(contestIds = [], userId = null) {
    const normalizedContestIds = (Array.isArray(contestIds) ? contestIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
    const viewerId = Number(userId || 0)
    if (!normalizedContestIds.length || !viewerId) return new Map()

    const contestRepo = await factory.getContestRepository()
    const contests = await Promise.all(
      normalizedContestIds.map((contestId) => contestRepo.findById(contestId)),
    )
    const fixedRosterContests = (contests || []).filter(
      (contest) =>
        contest &&
        (contest.mode || '').toString().trim().toLowerCase() === 'fixed_roster',
    )
    const standardContestIds = (contests || [])
      .filter(
        (contest) =>
          contest &&
          (contest.mode || '').toString().trim().toLowerCase() !== 'fixed_roster',
      )
      .map((contest) => String(contest.id))

    const statsMap = new Map()

    if (standardContestIds.length) {
      const result = await dbQuery(
        `WITH participant_ids AS (
           SELECT contest_id::text as contest_id, user_id
           FROM contest_joins
           WHERE contest_id::text = ANY($1::text[])
           UNION
           SELECT contest_id::text as contest_id, user_id
           FROM contest_fixed_rosters
           WHERE contest_id::text = ANY($1::text[])
         ),
         participant_totals AS (
           SELECT p.contest_id,
                  p.user_id,
                  COALESCE(SUM(cs.points), 0) as points
           FROM participant_ids p
           LEFT JOIN contest_scores cs
             ON cs.contest_id::text = p.contest_id
            AND cs.user_id = p.user_id
           GROUP BY p.contest_id, p.user_id
         ),
         ranked AS (
           SELECT contest_id,
                  user_id,
                  points,
                  DENSE_RANK() OVER (
                    PARTITION BY contest_id
                    ORDER BY points DESC, user_id ASC
                  ) as rank
           FROM participant_totals
         )
         SELECT contest_id as "contestId", points, rank
         FROM ranked
         WHERE user_id = $2`,
        [standardContestIds, viewerId],
      )
      for (const row of result.rows || []) {
        statsMap.set(String(row.contestId), {
          points: Number(row.points || 0),
          rank: Number(row.rank || 0) || '-',
        })
      }
    }

    for (const contest of fixedRosterContests) {
      const index = await this.getFixedRosterAggregateIndex(contest)
      const rankedRows = assignDenseRanks(
        [...index.values()].sort((left, right) => {
          if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints
          return String(left.gameName || '').localeCompare(String(right.gameName || ''))
        }),
        (row) => row.totalPoints,
      )
      const viewerRow = rankedRows.find((row) => Number(row.userId) === viewerId)
      if (viewerRow) {
        statsMap.set(String(contest.id), {
          points: Number(viewerRow.totalPoints || 0),
          rank: Number(viewerRow.rank || 0) || '-',
        })
      }
    }

    return statsMap
  }

  // Returns latest score upload metadata for matches tied to a contest.
  async getContestLastScoreMeta(contest = {}) {
    const tournamentId = contest?.tournamentId
    const contestMatchIds = Array.isArray(contest?.matchIds)
      ? contest.matchIds.map((value) => String(value || '').trim()).filter(Boolean)
      : []
    if (!tournamentId || !contestMatchIds.length) {
      return {
        lastScoreUpdatedAt: null,
        lastScoreUpdatedBy: null,
        lastUpdatedAt: null,
        lastUpdatedBy: null,
        lastUpdatedContext: null,
      }
    }

    const auditResult = await dbQuery(
      `SELECT al.created_at as "lastUpdatedAt",
              al.resource_type as "resourceType",
              m.team_a_key as "teamAKey",
              m.team_a as "teamA",
              m.team_b_key as "teamBKey",
              m.team_b as "teamB",
              COALESCE(
                NULLIF(u.game_name, ''),
                NULLIF(u.name, ''),
                NULLIF(u.user_id, '')
              ) as "lastUpdatedBy"
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.performed_by
       LEFT JOIN matches m ON m.id::text = al.resource_id
       WHERE COALESCE(al.changes->>'tournamentId', $1::text) = $1::text
         AND al.resource_id = ANY($2::text[])
         AND al.resource_type IN ('match-score', 'match-lineup')
       ORDER BY al.created_at DESC
       LIMIT 1`,
      [tournamentId, contestMatchIds],
    )
    const latestAudit = auditResult.rows?.[0] || null
    if (latestAudit?.lastUpdatedAt) {
      const teamA = latestAudit.teamAKey || latestAudit.teamA || 'Team A'
      const teamB = latestAudit.teamBKey || latestAudit.teamB || 'Team B'
      const kind =
        latestAudit.resourceType === 'match-lineup' ? 'playing xi' : 'score'
      const context = `${teamA} vs ${teamB} ${kind}`
      return {
        lastScoreUpdatedAt: latestAudit.lastUpdatedAt,
        lastScoreUpdatedBy: latestAudit.lastUpdatedBy || null,
        lastUpdatedAt: latestAudit.lastUpdatedAt,
        lastUpdatedBy: latestAudit.lastUpdatedBy || null,
        lastUpdatedContext: context,
      }
    }

    const result = await dbQuery(
      `SELECT ms.created_at as "lastScoreUpdatedAt",
              m.team_a_key as "teamAKey",
              m.team_a as "teamA",
              m.team_b_key as "teamBKey",
              m.team_b as "teamB",
              COALESCE(
                NULLIF(u.game_name, ''),
                NULLIF(u.name, ''),
                NULLIF(u.user_id, ''),
                CASE WHEN ms.uploaded_by IS NULL THEN NULL ELSE ms.uploaded_by::text END
              ) as "lastScoreUpdatedBy"
       FROM match_scores ms
       LEFT JOIN users u ON u.id = ms.uploaded_by
       LEFT JOIN matches m ON m.id = ms.match_id
       WHERE ms.active = true
         AND ms.tournament_id = $1
         AND ms.match_id::text = ANY($2::text[])
       ORDER BY ms.created_at DESC
       LIMIT 1`,
      [tournamentId, contestMatchIds],
    )

    const latest = result.rows?.[0] || null
    const teamA = latest?.teamAKey || latest?.teamA || 'Team A'
    const teamB = latest?.teamBKey || latest?.teamB || 'Team B'
    return {
      lastScoreUpdatedAt: latest?.lastScoreUpdatedAt || null,
      lastScoreUpdatedBy: latest?.lastScoreUpdatedBy || null,
      lastUpdatedAt: latest?.lastScoreUpdatedAt || null,
      lastUpdatedBy: latest?.lastScoreUpdatedBy || null,
      lastUpdatedContext: latest?.lastScoreUpdatedAt ? `${teamA} vs ${teamB} score` : null,
    }
  }

  // Returns all contests.
  async getAllContests() {
    const repo = await factory.getContestRepository()
    return await repo.findAll()
  }

  // Returns one contest by id.
  async getContestById(id) {
    const repo = await factory.getContestRepository()
    return await repo.findById(id)
  }

  // Returns contests for a specific tournament.
  async getContestsByTournament(tournamentId) {
    const repo = await factory.getContestRepository()
    return await repo.findByTournament(tournamentId)
  }

  // Creates a contest after validating tournament, participants, and match mapping.
  async createContest(data) {
    const repo = await factory.getContestRepository()
    const tournamentId = data?.tournamentId
    if (!tournamentId) {
      const error = new Error('tournamentId is required')
      error.statusCode = 400
      throw error
    }
    const rawMaxParticipants =
      data?.maxParticipants != null ? data.maxParticipants : data?.teams
    const maxParticipants = Number(rawMaxParticipants || 0)
    if (!Number.isFinite(maxParticipants) || maxParticipants < 2) {
      const error = new Error('Max players must be at least 2')
      error.statusCode = 400
      throw error
    }
    const matchRepo = await factory.getMatchRepository()
    const tournamentMatches = await matchRepo.findByTournament(tournamentId)
    const validMatchIds = tournamentMatches.map((match) => match.id)
    const validSet = new Set(validMatchIds.map((id) => String(id)))
    const requestedMatchIds = Array.isArray(data?.matchIds) ? data.matchIds : []
    const normalizedMatchIds = Array.from(
      new Set(
        (requestedMatchIds.length ? requestedMatchIds : validMatchIds)
          .map((id) => String(id))
          .filter((id) => validSet.has(id)),
      ),
    )
    if (!normalizedMatchIds.length) {
      const error = new Error('Select at least one tournament match for the contest')
      error.statusCode = 400
      throw error
    }
    const startAt = normalizeContestDateInput(data?.startAt)
    if (data?.startAt && !startAt) {
      const error = new Error('Contest start time must be a valid date')
      error.statusCode = 400
      throw error
    }
    return await repo.create({
      ...data,
      status: normalizeContestStatusInput(data?.status),
      maxParticipants,
      matchIds: normalizedMatchIds,
      startAt,
    })
  }

  // Returns selectable match options for contest creation in a tournament.
  async getContestMatchOptions(tournamentId) {
    if (!tournamentId) return []
    const matchRepo = await factory.getMatchRepository()
    const matches = await matchRepo.findByTournament(tournamentId)
    return matches
      .map((match) => mapMatchWithDerivedStatus(match))
      .map((match) => ({
        id: String(match.id),
        matchNo: match.matchNo ?? null,
        name:
          match.name ||
          `${match.teamA || match.teamAKey} vs ${match.teamB || match.teamBKey}`,
        date: match.startTime || match.date || '',
        startAt: match.startTime || match.startAt || '',
        status: match.status,
        tournamentId: String(tournamentId),
        selectable: true,
      }))
  }

  // Updates contest fields by id.
  async updateContest(id, data) {
    const repo = await factory.getContestRepository()
    const payload = { ...data }
    if (payload.status !== undefined) {
      payload.status = normalizeContestStatusInput(payload.status)
    }
    if (payload.startAt !== undefined) {
      payload.startAt = payload.startAt
        ? normalizeContestDateInput(payload.startAt)
        : null
    }
    if (payload.startedAt !== undefined) {
      payload.startedAt = payload.startedAt
        ? normalizeContestDateInput(payload.startedAt)
        : null
    }
    return await repo.update(id, payload)
  }

  async requestContestRemoval(id, { performedBy = null, ipAddress = '', userAgent = '' } = {}) {
    const repo = await factory.getContestRepository()
    const contest = await repo.findByIdIncludingPending(id)
    if (!contest) return { ok: false, pending: false, contestId: null }
    const impactSummary = await this.getContestRemovalImpact(id)
    await repo.update(id, { status: 'pending_removal' })
    await auditLogService.logAction({
      performedBy,
      action: 'Delete requested',
      resourceType: 'contest',
      resourceId: String(contest.id),
      tournamentId: contest.tournamentId || 'global',
      module: 'contests',
      detail: `Requested removal for contest "${contest.name}"`,
      target: contest.name,
      changes: {
        contestId: String(contest.id),
        contestName: contest.name,
        impactSummary,
      },
      ipAddress,
      userAgent,
    })
    return {
      ok: true,
      pending: true,
      contestId: String(contest.id),
      contestName: contest.name,
      tournamentId: contest.tournamentId || null,
      requestedAt: new Date().toISOString(),
      impactSummary,
    }
  }

  async listPendingContestRemovals() {
    const result = await dbQuery(
      `SELECT c.id as "contestId",
              c.name as "contestName",
              c.tournament_id as "tournamentId",
              t.name as "tournamentName",
              c.updated_at as "requestedAt",
              COALESCE(NULLIF(u.game_name, ''), NULLIF(u.name, ''), NULLIF(u.user_id, '')) as "requestedBy",
              al.changes
       FROM contests c
       LEFT JOIN tournaments t ON t.id = c.tournament_id
       LEFT JOIN LATERAL (
         SELECT performed_by, changes
         FROM audit_logs
         WHERE resource_type = 'contest'
           AND resource_id = c.id::text
           AND action = 'Delete requested'
         ORDER BY created_at DESC
         LIMIT 1
       ) al ON true
       LEFT JOIN users u ON u.id = al.performed_by
       WHERE COALESCE(lower(c.status), 'open') = 'pending_removal'
       ORDER BY c.updated_at DESC`,
    )
    return (result.rows || []).map((row) => ({
      ...row,
      impactSummary: row.changes?.impactSummary || row.changes || {},
      resourceType: 'contest',
      id: `contest-${row.contestId}`,
      resourceId: row.contestId,
      resourceName: row.contestName,
    }))
  }

  async rejectContestRemoval(id, { performedBy = null, ipAddress = '', userAgent = '' } = {}) {
    const repo = await factory.getContestRepository()
    const contest = await repo.findByIdIncludingPending(id)
    if (!contest || String(contest.status || '').toLowerCase() !== 'pending_removal') {
      return { ok: false, restored: false, contestId: null }
    }
    const auditResult = await dbQuery(
      `SELECT changes
       FROM audit_logs
       WHERE resource_type = 'contest'
         AND resource_id = $1::text
         AND action = 'Delete requested'
       ORDER BY created_at DESC
       LIMIT 1`,
      [id],
    )
    const previousStatus =
      auditResult.rows?.[0]?.changes?.impactSummary?.previousStatus ||
      auditResult.rows?.[0]?.changes?.previousStatus ||
      'Open'
    await repo.update(id, { status: previousStatus })
    await auditLogService.logAction({
      performedBy,
      action: 'Delete rejected',
      resourceType: 'contest',
      resourceId: String(id),
      tournamentId: contest.tournamentId || 'global',
      module: 'contests',
      detail: `Rejected removal for contest "${contest.name || id}"`,
      target: contest.name || String(id),
      changes: {
        contestId: String(id),
        contestName: contest.name || '',
        previousStatus,
      },
      ipAddress,
      userAgent,
    })
    return { ok: true, restored: true, contestId: String(id) }
  }

  async confirmContestRemoval(id, { performedBy = null, ipAddress = '', userAgent = '' } = {}) {
    const contest = await this.getContestRemovalImpact(id)
    if (!contest) {
      return { ok: false, removedId: null, removedParticipants: 0 }
    }
    const result = await this.deleteContest(id)
    if (!result?.ok) return result
    await auditLogService.logAction({
      performedBy,
      action: 'Delete approved',
      resourceType: 'contest',
      resourceId: String(result.removedId || id),
      tournamentId: result.tournamentId || 'global',
      module: 'contests',
      detail: `Approved permanent delete for contest "${contest.contestName || id}"`,
      target: contest.contestName || String(id),
      changes: {
        contestId: String(result.removedId || id),
        contestName: contest.contestName || '',
        impactSummary: contest,
      },
      ipAddress,
      userAgent,
    })
    return result
  }

  // Deletes a contest and cleans dependent participation rows.
  async deleteContest(id) {
    const repo = await factory.getContestRepository()
    const contest = await repo.findByIdIncludingPending(id)
    if (!contest) return { ok: false, removedId: null, removedParticipants: 0 }
    const participantResult = await dbQuery(
      `SELECT COUNT(*)::int AS count
       FROM (
         SELECT user_id FROM contest_joins WHERE contest_id = $1
         UNION
         SELECT user_id FROM contest_fixed_rosters WHERE contest_id = $1
       ) participants`,
      [id],
    )
    const deleted = await repo.delete(id)
    return {
      ok: Boolean(deleted),
      removedId: deleted ? String(id) : null,
      tournamentId: contest.tournamentId || null,
      removedParticipants: Number(participantResult.rows[0]?.count || 0),
    }
  }

  // Joins a user to a contest if capacity and lifecycle checks pass.
  async joinContest(contestId, userId) {
    const contestRepo = await factory.getContestRepository()
    const contest = await contestRepo.findById(contestId)
    if (!contest) {
      const error = new Error('Contest not found')
      error.statusCode = 404
      throw error
    }
    const lifecycle = buildContestView(contest)
    if (!lifecycle.joinOpen) {
      const error = new Error(
        lifecycle.hasStarted
          ? 'Contest join is closed because the contest has already started'
          : 'Contest join is closed',
      )
      error.statusCode = 403
      throw error
    }
    // Check if user already joined
    const result = await dbQuery(
      `SELECT id FROM contest_joins WHERE contest_id = $1 AND user_id = $2`,
      [contestId, userId],
    )
    if (result.rows.length > 0) {
      return { joined: true, message: 'Already joined' }
    }
    if (
      lifecycle.maxPlayers > 0 &&
      Number(contest?.participantsCount || 0) >= lifecycle.maxPlayers
    ) {
      const error = new Error('Contest is full')
      error.statusCode = 403
      throw error
    }
    // Add join record
    await dbQuery(
      `INSERT INTO contest_joins (contest_id, user_id, joined_at) VALUES ($1, $2, now())`,
      [contestId, userId],
    )
    // Increment participant count
    await contestRepo.incrementParticipants(contestId)
    return { joined: true }
  }

  // Removes a user from a contest participation list.
  async leaveContest(contestId, userId) {
    const contestRepo = await factory.getContestRepository()
    const result = await dbQuery(
      `DELETE FROM contest_joins WHERE contest_id = $1 AND user_id = $2 RETURNING id`,
      [contestId, userId],
    )
    if (result.rows.length > 0) {
      await dbQuery(`DELETE FROM contest_scores WHERE contest_id = $1 AND user_id = $2`, [
        contestId,
        userId,
      ])
      await dbQuery(
        `DELETE FROM contest_match_players WHERE contest_id = $1 AND user_id = $2`,
        [contestId, userId],
      )
      await dbQuery(
        `DELETE FROM team_selections WHERE contest_id = $1 AND user_id = $2`,
        [contestId, userId],
      )
      await contestRepo.decrementParticipants(contestId)
      return { left: true }
    }
    return { left: false, message: 'Not joined' }
  }

  // Returns contest participants with preview picks and optional compare context.
  async getContestParticipants(contestId, options = {}) {
    const contest = await this.getContestById(contestId)
    if (!contest) {
      return {
        participants: [],
        joinedCount: 0,
        withTeamCount: 0,
        previewXI: [],
        previewBackups: [],
      }
    }
    const participantSourceSql =
      (contest.mode || '').toString() === 'fixed_roster'
        ? `WITH participant_ids AS (
             SELECT user_id, MIN(joined_at) as joined_at
             FROM contest_joins
             WHERE contest_id = $1
             GROUP BY user_id
             UNION
             SELECT user_id, MIN(created_at) as joined_at
             FROM contest_fixed_rosters
             WHERE contest_id = $1
             GROUP BY user_id
           )`
        : `WITH participant_ids AS (
             SELECT user_id, MIN(joined_at) as joined_at
             FROM contest_joins
             WHERE contest_id = $1
             GROUP BY user_id
           )`
    const result = await dbQuery(
      `${participantSourceSql}
       SELECT u.id, u.name, u.user_id as "userId", u.game_name as "gameName", MIN(p.joined_at) as "joinedAt"
       FROM participant_ids p
       JOIN users u ON u.id = p.user_id
       GROUP BY u.id, u.name, u.user_id, u.game_name
       ORDER BY MIN(p.joined_at) ASC NULLS LAST, u.game_name ASC`,
      [contestId],
    )
    const joinedParticipants = result.rows || []
    const joinedCount = joinedParticipants.length
    const matchId = options?.matchId ? Number(options.matchId) : null
    const viewerUserId = options?.viewerUserId ? Number(options.viewerUserId) : null

    let previewXI = []
    let previewBackups = []
    if (matchId && viewerUserId && (contest.mode || '').toString() === 'fixed_roster') {
      const fixedRosterIndex = await this.getFixedRosterAggregateIndex(contest, {
        userIds: [viewerUserId],
      })
      const viewerRoster = fixedRosterIndex.get(String(viewerUserId))
      previewXI = (viewerRoster?.rows || []).filter((entry) => entry.counted)
      previewBackups = (viewerRoster?.rows || []).filter((entry) => !entry.counted)
    } else if (
      matchId &&
      viewerUserId &&
      (contest.mode || '').toString() !== 'fixed_roster'
    ) {
      const selection = await teamSelectionService.getUserPicksByMatch(
        viewerUserId,
        matchId,
        contestId,
      )
      if (selection) {
        const playerRepo = await factory.getPlayerRepository()
        const tournamentPlayers =
          contest.tournamentId != null
            ? await playerRepo.findByTournament(contest.tournamentId)
            : await playerRepo.findAll()
        const playerById = new Map(
          (tournamentPlayers || []).map((player) => [
            String(player.id),
            {
              id: player.id,
              name:
                player.displayName ||
                [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
              imageUrl: player.imageUrl || '',
            },
          ]),
        )
        previewXI = buildPreviewEntries(selection.playingXi, playerById)
        previewBackups = buildPreviewEntries(selection.backups, playerById)
      }
    }

    if (!matchId) {
      return {
        participants: [],
        joinedCount,
        withTeamCount: 0,
        previewXI,
        previewBackups,
      }
    }

    if ((contest.mode || '').toString() === 'fixed_roster') {
      const fixedRosterIndex = await this.getFixedRosterAggregateIndex(contest)
      return {
        participants: joinedParticipants.map((row) => ({
          ...row,
          points: Number(
            fixedRosterIndex.get(String(row.id))?.matchTotals?.get(String(matchId)) || 0,
          ),
        })),
        joinedCount,
        withTeamCount: joinedParticipants.length,
        previewXI,
        previewBackups,
      }
    }

    const submittedResult = await dbQuery(
      `SELECT ts.user_id as "userId", COALESCE(cs.points, 0) as points
       FROM team_selections ts
       LEFT JOIN contest_scores cs
         ON cs.contest_id = ts.contest_id
        AND cs.match_id = ts.match_id
        AND cs.user_id = ts.user_id
       WHERE ts.contest_id = $1
         AND ts.match_id = $2`,
      [contestId, matchId],
    )
    const submittedByUser = new Map(
      submittedResult.rows.map((row) => [String(row.userId), Number(row.points || 0)]),
    )
    const participants = joinedParticipants
      .filter((row) => submittedByUser.has(String(row.id)))
      .map((row) => ({
        ...row,
        points: Number(submittedByUser.get(String(row.id)) || 0),
      }))

    return {
      participants,
      joinedCount,
      withTeamCount: participants.length,
      previewXI,
      previewBackups,
    }
  }

  // Returns contest match list enriched with viewer-specific team state.
  async getContestMatches(contestId, options = {}) {
    const contest = await this.getContestById(contestId)
    if (!contest) return []
    const matchIds = contest.matchIds || []
    if (matchIds.length === 0) return []
    const statusFilter = (options?.status || 'all').toString().trim().toLowerCase()
    const teamFilter = (options?.team || 'all').toString().trim().toUpperCase()
    const viewerUserId = options?.viewerUserId ? Number(options.viewerUserId) : null

    const result = await dbQuery(
      `SELECT id, name,
              team_a as "teamA", team_b as "teamB",
              start_time as "startTime", status
       FROM matches
       WHERE id = ANY($1::bigint[])
       ORDER BY start_time ASC`,
      [matchIds],
    )
    const baseRows = result.rows.map((row, index) =>
      mapMatchWithDerivedStatus({
        ...row,
        matchNo: index + 1,
        home: row.teamA || '',
        away: row.teamB || '',
        startAt: row.startTime || '',
        date: row.startTime ? row.startTime.toString().slice(0, 10) : '',
      }),
    )
    const filteredRows = baseRows.filter((row) => {
      const normalizedStatus = (row.status || '').toString().trim().toLowerCase()
      const statusOk = statusFilter === 'all' || normalizedStatus === statusFilter
      const teamOk =
        teamFilter === 'ALL' ||
        row.home?.toUpperCase() === teamFilter ||
        row.away?.toUpperCase() === teamFilter
      return statusOk && teamOk
    })

    const joinedCountResult = await dbQuery(
      `WITH participant_ids AS (
         SELECT user_id
         FROM contest_joins
         WHERE contest_id = $1
         UNION
         SELECT user_id
         FROM contest_fixed_rosters
         WHERE contest_id = $1
       )
       SELECT COUNT(*)::int as count
       FROM participant_ids`,
      [contestId],
    )
    const joinedCount = Number(joinedCountResult.rows[0]?.count || 0)

    const selectionCountsResult = await dbQuery(
      `SELECT match_id as "matchId", COUNT(*)::int as count
       FROM team_selections
       WHERE contest_id = $1
         AND match_id = ANY($2::bigint[])
       GROUP BY match_id`,
      [contestId, filteredRows.map((row) => row.id)],
    )
    const submittedCountByMatch = new Map(
      selectionCountsResult.rows.map((row) => [
        String(row.matchId),
        Number(row.count || 0),
      ]),
    )

    let viewerJoined = false
    let viewerSelections = new Set()
    let viewerHasFixedRoster = false
    if (viewerUserId) {
      const viewerJoinedResult = await dbQuery(
        `SELECT EXISTS(
           SELECT 1 FROM contest_joins WHERE contest_id = $1 AND user_id = $2
           UNION
           SELECT 1 FROM contest_fixed_rosters WHERE contest_id = $1 AND user_id = $2
         ) as joined`,
        [contestId, viewerUserId],
      )
      viewerJoined = Boolean(viewerJoinedResult.rows[0]?.joined)
      const viewerSelectionsResult = await dbQuery(
        `SELECT match_id as "matchId"
         FROM team_selections
         WHERE contest_id = $1
           AND user_id = $2
           AND match_id = ANY($3::bigint[])`,
        [contestId, viewerUserId, filteredRows.map((row) => row.id)],
      )
      viewerSelections = new Set(
        viewerSelectionsResult.rows.map((row) => String(row.matchId)),
      )
      if ((contest.mode || '').toString() === 'fixed_roster') {
        const fixedRosterResult = await dbQuery(
          `SELECT EXISTS(
             SELECT 1
             FROM contest_fixed_rosters
             WHERE contest_id = $1 AND user_id = $2
           ) as has_roster`,
          [contestId, viewerUserId],
        )
        viewerHasFixedRoster = Boolean(fixedRosterResult.rows[0]?.has_roster)
      }
    }

    return filteredRows.map((row) => ({
      ...row,
      hasTeam:
        (contest.mode || '').toString() === 'fixed_roster'
          ? viewerHasFixedRoster
          : viewerSelections.has(String(row.id)),
      submittedCount: Number(submittedCountByMatch.get(String(row.id)) || 0),
      joinedCount,
      viewerJoined,
    }))
  }

  // Returns ranked leaderboard rows for a contest.
  async getContestLeaderboard(contestId) {
    const contest = await this.getContestById(contestId)
    const isFixedRoster =
      (contest?.mode || '').toString().trim().toLowerCase() === 'fixed_roster'
    if (isFixedRoster) {
      const index = await this.getFixedRosterAggregateIndex(contest)
      return assignDenseRanks(
        [...index.values()].sort((left, right) => {
          if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints
          return String(left.gameName || '').localeCompare(String(right.gameName || ''))
        }),
        (row) => row.totalPoints,
      ).map((row) => ({
          userId: row.userId,
          name: row.name,
          gameName: row.gameName,
          points: Number(row.totalPoints || 0),
          countedPlayers: FIXED_ROSTER_COUNTED_SIZE,
          rosterSize: row.rosterSize || 15,
          rank: row.rank,
        }))
    }
    const result = await dbQuery(
      `WITH participant_ids AS (
         SELECT user_id
         FROM contest_joins
         WHERE contest_id = $1
         UNION
         SELECT user_id
         FROM contest_fixed_rosters
         WHERE contest_id = $1
       )
       SELECT p.user_id as "userId", u.name, u.game_name as "gameName",
              COALESCE(SUM(cs.points), 0) as points
       FROM participant_ids p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN contest_scores cs
         ON cs.user_id = p.user_id
        AND cs.contest_id = $1
       GROUP BY p.user_id, u.name, u.game_name
       ORDER BY points DESC, u.game_name ASC`,
      [contestId],
    )
    return result.rows.map((row) => ({
      ...row,
      countedPlayers: isFixedRoster ? FIXED_ROSTER_COUNTED_SIZE : null,
      rosterSize: isFixedRoster ? 15 : null,
    }))
  }

  // Returns per-match score comparison for a user within a contest.
  async getContestUserMatchScores(contestId, userId, compareUserId = '') {
    const contest = await this.getContestById(contestId)
    if (!contest)
      return {
        contestId,
        userId,
        compareUserId,
        totals: { userPoints: 0, comparePoints: 0, delta: 0 },
        rows: [],
      }
    const isFixedRoster =
      (contest?.mode || '').toString().trim().toLowerCase() === 'fixed_roster'
    const matches = await this.getContestMatches(contestId)
    if (isFixedRoster) {
      const requestedUserIds = [Number(userId), ...(compareUserId ? [Number(compareUserId)] : [])]
      const index = await this.getFixedRosterAggregateIndex(contest, {
        userIds: requestedUserIds,
      })
      const rows = matches.map((match) => ({
        matchId: match.id,
        matchNo: null,
        matchName: match.name,
        date: match.startTime,
        status: mapMatchWithDerivedStatus(match).status,
        userPoints: Number(index.get(String(userId))?.matchTotals?.get(String(match.id)) || 0),
        comparePoints: compareUserId
          ? Number(index.get(String(compareUserId))?.matchTotals?.get(String(match.id)) || 0)
          : 0,
        delta:
          Number(index.get(String(userId))?.matchTotals?.get(String(match.id)) || 0) -
          Number(index.get(String(compareUserId))?.matchTotals?.get(String(match.id)) || 0),
      }))
      const totals = rows.reduce(
        (acc, row) => {
          acc.userPoints += Number(row.userPoints || 0)
          acc.comparePoints += Number(row.comparePoints || 0)
          return acc
        },
        { userPoints: 0, comparePoints: 0 },
      )
      return {
        contestId,
        tournamentId: contest.tournamentId,
        userId,
        compareUserId,
        totals: {
          userPoints: totals.userPoints,
          comparePoints: totals.comparePoints,
          delta: totals.userPoints - totals.comparePoints,
        },
        rows,
      }
    }
    const scoreResult = await dbQuery(
      `SELECT match_id as "matchId", user_id as "userId", points
       FROM contest_scores
       WHERE contest_id = $1
         AND user_id = ANY($2::bigint[])`,
      [contestId, [Number(userId), ...(compareUserId ? [Number(compareUserId)] : [])]],
    )
    const scoreIndex = new Map(
      scoreResult.rows.map((row) => [
        `${row.userId}:${row.matchId}`,
        Number(row.points || 0),
      ]),
    )
    const rows = matches.map((match) => ({
      matchId: match.id,
      matchNo: null,
      matchName: match.name,
      date: match.startTime,
      status: mapMatchWithDerivedStatus(match).status,
      userPoints: Number(scoreIndex.get(`${userId}:${match.id}`) || 0),
      comparePoints: compareUserId
        ? Number(scoreIndex.get(`${compareUserId}:${match.id}`) || 0)
        : 0,
      delta:
        Number(scoreIndex.get(`${userId}:${match.id}`) || 0) -
        Number(scoreIndex.get(`${compareUserId}:${match.id}`) || 0),
    }))
    const totals = rows.reduce(
      (acc, row) => {
        acc.userPoints += Number(row.userPoints || 0)
        acc.comparePoints += Number(row.comparePoints || 0)
        return acc
      },
      { userPoints: 0, comparePoints: 0 },
    )
    return {
      contestId,
      tournamentId: contest.tournamentId,
      userId,
      compareUserId,
      totals: {
        userPoints: totals.userPoints,
        comparePoints: totals.comparePoints,
        delta: totals.userPoints - totals.comparePoints,
      },
      rows,
    }
  }

  // Returns per-player contribution totals for a user within a contest.
  async getContestUserPlayerBreakdown(contestId, userId) {
    const contest = await this.getContestById(contestId)
    if (!contest) {
      return {
        contestId,
        userId,
        tournamentId: null,
        mode: '',
        totalPoints: 0,
        countedPlayers: null,
        rosterSize: null,
        note: '',
        rows: [],
      }
    }

    const matches = await this.getContestMatches(contestId)
    const matchIds = (matches || []).map((match) => String(match.id || '').trim()).filter(Boolean)
    if (!matchIds.length) {
      return {
        contestId,
        userId,
        tournamentId: contest.tournamentId,
        mode: contest.mode || '',
        totalPoints: 0,
        countedPlayers:
          (contest.mode || '').toString().trim().toLowerCase() === 'fixed_roster'
            ? FIXED_ROSTER_COUNTED_SIZE
            : null,
        rosterSize:
          (contest.mode || '').toString().trim().toLowerCase() === 'fixed_roster'
            ? 15
            : null,
        note: '',
        rows: [],
      }
    }

    const playerRepo = await factory.getPlayerRepository()
    const tournamentPlayers =
      contest.tournamentId != null
        ? await playerRepo.findByTournament(contest.tournamentId)
        : await playerRepo.findAll()
    const playerById = new Map(
      (tournamentPlayers || []).map((player) => [
        Number(player.id),
        {
          id: player.id,
          name:
            player.displayName ||
            [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
          role: player.role || '-',
          team: player.teamKey || player.team || '-',
          imageUrl: player.imageUrl || '',
        },
      ]),
    )

    const isFixedRoster =
      (contest.mode || '').toString().trim().toLowerCase() === 'fixed_roster'

    if (isFixedRoster) {
      const fixedRosterResult = await dbQuery(
        `SELECT player_ids as "playerIds"
         FROM contest_fixed_rosters
         WHERE contest_id = $1 AND user_id = $2
         LIMIT 1`,
        [contestId, userId],
      )
      const playerIds = Array.isArray(fixedRosterResult.rows[0]?.playerIds)
        ? fixedRosterResult.rows[0].playerIds.map((value) => Number(value)).filter(Boolean)
        : []
      if (!playerIds.length) {
        return {
          contestId,
          userId,
          tournamentId: contest.tournamentId,
          mode: contest.mode || '',
          totalPoints: 0,
          countedPlayers: FIXED_ROSTER_COUNTED_SIZE,
          rosterSize: 15,
          note: 'Auction totals count the top 11 roster players by overall contest points. The remaining 4 stay on the bench.',
          rows: [],
        }
      }
      const index = await this.getFixedRosterAggregateIndex(contest, {
        userIds: [userId],
      })
      const aggregateRow = index.get(String(userId))
      const rows = aggregateRow?.rows || []

      return {
        contestId,
        userId,
        tournamentId: contest.tournamentId,
        mode: contest.mode || '',
        totalPoints: Number(aggregateRow?.totalPoints || 0),
        countedPlayers: FIXED_ROSTER_COUNTED_SIZE,
        rosterSize: aggregateRow?.rosterSize || playerIds.length,
        note: 'Auction totals count the top 11 roster players by overall contest points. The remaining 4 stay on the bench.',
        rows,
      }
    }

    const matchScoreResult = await dbQuery(
      `SELECT match_id as "matchId", player_id as "playerId", fantasy_points as "fantasyPoints"
       FROM player_match_scores
       WHERE tournament_id = $1
         AND match_id::text = ANY($2::text[])`,
      [contest.tournamentId, matchIds],
    )
    const activePlayerIdsByMatch = new Map()
    const pointsByMatchPlayer = new Map()
    for (const row of matchScoreResult.rows || []) {
      const key = String(row.matchId || '')
      const list = activePlayerIdsByMatch.get(key) || []
      list.push(Number(row.playerId))
      activePlayerIdsByMatch.set(key, list)
      pointsByMatchPlayer.set(`${row.matchId}:${row.playerId}`, Number(row.fantasyPoints || 0))
    }

    const selections = await dbQuery(
      `SELECT match_id as "matchId",
              captain_id as "captainId",
              vice_captain_id as "viceCaptainId",
              playing_xi as "playingXi",
              backups
       FROM team_selections
       WHERE contest_id = $1
         AND user_id = $2
         AND match_id::text = ANY($3::text[])`,
      [contestId, userId, matchIds],
    )

    const contributionByPlayerId = new Map()
    const selectedMatchCountByPlayerId = new Map()
    for (const row of selections.rows || []) {
      const playingXi =
        typeof row.playingXi === 'string' ? JSON.parse(row.playingXi) : row.playingXi || []
      const backups =
        typeof row.backups === 'string' ? JSON.parse(row.backups) : row.backups || []
      const resolved = resolveEffectiveSelection({
        playingXi,
        backups,
        activePlayerIds: activePlayerIdsByMatch.get(String(row.matchId || '')) || [],
        captainId: row.captainId,
        viceCaptainId: row.viceCaptainId,
      })
      for (const playerId of resolved.effectivePlayerIds || []) {
        const numericPlayerId = Number(playerId)
        const base = Number(pointsByMatchPlayer.get(`${row.matchId}:${numericPlayerId}`) || 0)
        let multiplier = 1
        if (resolved.captainApplies && Number(row.captainId) === numericPlayerId) {
          multiplier = 2
        } else if (
          resolved.viceCaptainApplies &&
          Number(row.viceCaptainId) === numericPlayerId
        ) {
          multiplier = 1.5
        }
        contributionByPlayerId.set(
          numericPlayerId,
          Number(contributionByPlayerId.get(numericPlayerId) || 0) + base * multiplier,
        )
        selectedMatchCountByPlayerId.set(
          numericPlayerId,
          Number(selectedMatchCountByPlayerId.get(numericPlayerId) || 0) + 1,
        )
      }
    }

    const rows = Array.from(contributionByPlayerId.entries())
      .map(([playerId, points]) => {
        const player = playerById.get(Number(playerId))
        if (!player) return null
        return {
          ...player,
          points: Number(points || 0),
          selectedMatches: Number(selectedMatchCountByPlayerId.get(Number(playerId)) || 0),
        }
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (right.points !== left.points) return right.points - left.points
        return String(left.name || '').localeCompare(String(right.name || ''))
      })

    return {
      contestId,
      userId,
      tournamentId: contest.tournamentId,
      mode: contest.mode || '',
      totalPoints: rows.reduce((sum, row) => sum + Number(row.points || 0), 0),
      countedPlayers: null,
      rosterSize: null,
      note: 'Rows below show how each selected player contributed to this contest total.',
      rows,
    }
  }

  // Sets contest status to open.
  async enableContest(contestId) {
    return await this.updateContest(contestId, { status: 'Open' })
  }

  // Sets contest status to locked.
  async disableContest(contestId) {
    return await this.updateContest(contestId, { status: 'Locked' })
  }

  // Starts a contest and updates lifecycle fields.
  async startContest(contestId) {
    const contest = await this.getContestById(contestId)
    if (!contest) {
      const error = new Error('Contest not found')
      error.statusCode = 404
      throw error
    }
    const lifecycle = buildContestView(contest)
    if (lifecycle.hasStarted) {
      return buildContestView(contest)
    }
    const updated = await this.updateContest(contestId, {
      startedAt: new Date().toISOString(),
      status: 'Open',
    })
    return buildContestView(updated)
  }

  // Placeholder sync hook for external contest recalculation flows.
  async syncContest(contestId) {
    // Sync contest data from external source or recalculate scores
    return { synced: true, contestId }
  }
}

export default new ContestService()
export { buildContestView, deriveContestLifecycle }
