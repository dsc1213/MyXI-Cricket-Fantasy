import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'

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
    return await repo.create(data)
  }

  async updateContest(id, data) {
    const repo = await factory.getContestRepository()
    return await repo.update(id, data)
  }

  async deleteContest(id) {
    const repo = await factory.getContestRepository()
    return await repo.delete(id)
  }

  async joinContest(contestId, userId) {
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
    await contestRepository.incrementParticipants(contestId)
    return { joined: true }
  }

  async leaveContest(contestId, userId) {
    const result = await dbQuery(
      `DELETE FROM contest_joins WHERE contest_id = $1 AND user_id = $2 RETURNING id`,
      [contestId, userId],
    )
    if (result.rows.length > 0) {
      await contestRepository.decrementParticipants(contestId)
      return { left: true }
    }
    return { left: false, message: 'Not joined' }
  }

  async getContestParticipants(contestId) {
    const result = await dbQuery(
      `SELECT u.id, u.name, u.user_id as "userId", u.game_name as "gameName", cj.joined_at as "joinedAt"
       FROM contest_joins cj
       JOIN users u ON u.id = cj.user_id
       WHERE cj.contest_id = $1
       ORDER BY cj.joined_at ASC`,
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
    return result.rows
  }

  async getContestLeaderboard(contestId) {
    // Get participants and their scores
    const result = await dbQuery(
      `SELECT cj.user_id as "userId", u.name, u.game_name as "gameName",
              COALESCE(SUM(CAST(COALESCE(cs.total_points, '0')::numeric AS integer)), 0) as total_points
       FROM contest_joins cj
       JOIN users u ON u.id = cj.user_id
       LEFT JOIN contest_scores cs ON cs.user_id = u.id AND cs.contest_id = $1
       WHERE cj.contest_id = $1
       GROUP BY cj.user_id, u.name, u.game_name
       ORDER BY total_points DESC`,
      [contestId],
    )
    return result.rows
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
