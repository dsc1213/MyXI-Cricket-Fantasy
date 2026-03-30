import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { mapMatchWithDerivedStatus } from './tournamentImport.service.js'

const factory = createRepositoryFactory()

class ContestService {
  async getAllContests() {
    const repo = await factory.getContestRepository()
    return await repo.findAll()
  }

  async getContestById(id) {
    const repo = await factory.getContestRepository()
    return await repo.findById(id)
  }

  async getContestsByTournament(tournamentId) {
    const repo = await factory.getContestRepository()
    return await repo.findByTournament(tournamentId)
  }

  async createContest(data) {
    const repo = await factory.getContestRepository()
    const tournamentId = data?.tournamentId
    if (!tournamentId) {
      const error = new Error('tournamentId is required')
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
    return await repo.create({
      ...data,
      matchIds: normalizedMatchIds,
    })
  }

  async getContestMatchOptions(tournamentId) {
    if (!tournamentId) return []
    const matchRepo = await factory.getMatchRepository()
    const matches = await matchRepo.findByTournament(tournamentId)
    return matches
      .map((match) => mapMatchWithDerivedStatus(match))
      .map((match) => ({
        id: String(match.id),
        matchNo: match.matchNo ?? null,
        name: match.name || `${match.teamA || match.teamAKey} vs ${match.teamB || match.teamBKey}`,
        date: match.startTime || match.date || '',
        startAt: match.startTime || match.startAt || '',
        status: match.status,
        tournamentId: String(tournamentId),
        selectable: true,
      }))
  }

  async updateContest(id, data) {
    const repo = await factory.getContestRepository()
    return await repo.update(id, data)
  }

  async deleteContest(id) {
    const repo = await factory.getContestRepository()
    const contest = await repo.findById(id)
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

  async joinContest(contestId, userId) {
    const contestRepo = await factory.getContestRepository()
    // Check if user already joined
    const result = await dbQuery(
      `SELECT id FROM contest_joins WHERE contest_id = $1 AND user_id = $2`,
      [contestId, userId],
    )
    if (result.rows.length > 0) {
      return { joined: true, message: 'Already joined' }
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

  async getContestParticipants(contestId) {
    const result = await dbQuery(
      `WITH participant_ids AS (
         SELECT user_id, MIN(joined_at) as joined_at
         FROM contest_joins
         WHERE contest_id = $1
         GROUP BY user_id
         UNION
         SELECT user_id, MIN(created_at) as joined_at
         FROM contest_fixed_rosters
         WHERE contest_id = $1
         GROUP BY user_id
       )
       SELECT u.id, u.name, u.user_id as "userId", u.game_name as "gameName", MIN(p.joined_at) as "joinedAt"
       FROM participant_ids p
       JOIN users u ON u.id = p.user_id
       GROUP BY u.id, u.name, u.user_id, u.game_name
       ORDER BY MIN(p.joined_at) ASC NULLS LAST, u.game_name ASC`,
      [contestId],
    )
    return result.rows
  }

  async getContestMatches(contestId) {
    const contest = await this.getContestById(contestId)
    if (!contest) return []
    const matchIds = contest.matchIds || []
    if (matchIds.length === 0) return []

    const result = await dbQuery(
      `SELECT id, name, team_a as "teamA", team_b as "teamB", start_time as "startTime", status
       FROM matches
       WHERE id = ANY($1::bigint[])
       ORDER BY start_time ASC`,
      [matchIds],
    )
    return result.rows.map((row) => mapMatchWithDerivedStatus(row))
  }

  async getContestLeaderboard(contestId) {
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
    return result.rows
  }

  async getContestUserMatchScores(contestId, userId, compareUserId = '') {
    const contest = await this.getContestById(contestId)
    if (!contest) return { contestId, userId, compareUserId, totals: { userPoints: 0, comparePoints: 0, delta: 0 }, rows: [] }
    const matches = await this.getContestMatches(contestId)
    const scoreResult = await dbQuery(
      `SELECT match_id as "matchId", user_id as "userId", points
       FROM contest_scores
       WHERE contest_id = $1
         AND user_id = ANY($2::bigint[])`,
      [contestId, [Number(userId), ...(compareUserId ? [Number(compareUserId)] : [])]],
    )
    const scoreIndex = new Map(
      scoreResult.rows.map((row) => [`${row.userId}:${row.matchId}`, Number(row.points || 0)]),
    )
    const rows = matches.map((match) => ({
      matchId: match.id,
      matchNo: null,
      matchName: match.name,
      date: match.startTime,
      status: mapMatchWithDerivedStatus(match).status,
      userPoints: Number(scoreIndex.get(`${userId}:${match.id}`) || 0),
      comparePoints: compareUserId ? Number(scoreIndex.get(`${compareUserId}:${match.id}`) || 0) : 0,
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

  async enableContest(contestId) {
    return await this.updateContest(contestId, { status: 'active' })
  }

  async disableContest(contestId) {
    return await this.updateContest(contestId, { status: 'inactive' })
  }

  async syncContest(contestId) {
    // Sync contest data from external source or recalculate scores
    return { synced: true, contestId }
  }
}

export default new ContestService()
