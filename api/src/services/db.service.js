import tournamentService from './tournament.service.js'
import matchService from './match.service.js'
import contestService from './contest.service.js'
import teamSelectionService from './team-selection.service.js'
import scoringRuleService from './scoring-rule.service.js'
import matchScoreService from './match-score.service.js'
import playerService from './player.service.js'
import pageLoadService from './pageload.service.js'
import auctionImportService from './auctionImport.service.js'
import userRepository from '../repositories/user.repository.js'

const resolveDbUser = async (rawIdentifier) => {
  const value = (rawIdentifier ?? '').toString().trim()
  if (!value) return null
  const asNumber = Number(value)
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return userRepository.findById(asNumber)
  }
  return userRepository.findByIdentifier(value)
}

// Handler registry for provider routes
const dbHandlers = {
  // Page load & bootstrap
  '/page-load-data': (userId) => pageLoadService.getPageLoadData(userId),
  '/bootstrap': () => pageLoadService.getBootstrapData(),

  // Tournaments
  '/tournaments': () => tournamentService.getAllTournaments(),
  '/tournaments/:id/matches': (id) => tournamentService.getTournamentMatches(id),
  '/tournaments/:id/leaderboard': (id) => tournamentService.getTournamentLeaderboard(id),

  // Admin tournaments
  '/admin/tournaments': () => tournamentService.getAllTournaments(),
  '/admin/tournaments/catalog': () => tournamentService.getTournamentCatalog(),
  '/admin/tournaments/select': (data) =>
    tournamentService.selectTournament(data.tournamentId),
  '/admin/tournaments/:id': (id) => tournamentService.getTournamentById(id),
  '/admin/tournaments/:id/delete': (id) => tournamentService.deleteTournament(id),
  '/admin/tournaments/enable': (data) =>
    tournamentService.updateTournament(data.tournamentId, { status: 'active' }),
  '/admin/tournaments/disable': (data) =>
    tournamentService.updateTournament(data.tournamentId, { status: 'inactive' }),

  // Matches
  '/admin/matches/import-fixtures': (data) =>
    matchService.importFixtures(data.tournamentId, data.fixtures),
  '/admin/matches/:id/status': (id, status) => matchService.updateMatchStatus(id, status),
  '/admin/matches/:id/score-upload': (id, data) =>
    matchService.uploadScore(id, data.tournamentId, data.playerStats, data.uploadedBy),
  '/admin/matches/:id/score-history': (id) => matchService.getScoreHistory(id),
  '/admin/matches/:id/score-rollback': (id, scoreId) =>
    matchService.rollbackScore(id, scoreId),
  '/admin/matches/:id/auto-swap': (id, data) =>
    matchService.autoSwapPlayers(id, data.userId, data.swaps),

  // Contests
  '/contests': () => contestService.getAllContests(),
  '/contests/:id': (id) => contestService.getContestById(id),
  '/contests/:id/join': (id, userId) => contestService.joinContest(id, userId),
  '/contests/:id/leave': (id, userId) => contestService.leaveContest(id, userId),
  '/contests/:id/matches': (id) => contestService.getContestMatches(id),
  '/contests/:id/participants': (id) => contestService.getContestParticipants(id),
  '/contests/:id/leaderboard': (id) => contestService.getContestLeaderboard(id),

  // Admin contests
  '/admin/contests': () => contestService.getAllContests(),
  '/admin/contests/:id': (id) => contestService.getContestById(id),
  '/admin/contests/:id/delete': (id) => contestService.deleteContest(id),
  '/admin/contests/create': (data) => contestService.createContest(data),
  '/admin/contests/catalog': () => contestService.getAllContests(),
  '/admin/contests/sync': (data) => contestService.syncContest(data.contestId),

  // Team selection
  '/matches/:id/team': (id, userId, data) =>
    teamSelectionService.saveTeamSelection(id, userId, data.playingXi, data.backups),

  // Scoring rules
  '/admin/scoring-rules': (data) =>
    scoringRuleService.createScoringRule(data.tournamentId, data.rules),
  '/scoring-rules/save': (data) =>
    scoringRuleService.saveDefaultScoringRules(data.rules),

  // Match scores
  '/admin/match-scores/:tournamentId/:matchId': (tournamentId, matchId) =>
    matchScoreService.getMatchScores(tournamentId, matchId),
  '/admin/match-score-context': (data) => ({ context: {} }),
  '/admin/match-scores/upsert': (data) =>
    matchScoreService.uploadMatchScores(
      data.matchId,
      data.tournamentId,
      data.playerStats,
      data.uploadedBy,
    ),
  '/match-scores/process-excel': (data) => matchScoreService.processExcelScores(data),
  '/match-scores/save': (data) =>
    matchScoreService.saveExcelProcessedScores(
      data.matchId,
      data.tournamentId,
      data.playerStats,
      data.uploadedBy,
    ),
  '/admin/player-overrides/context': (data) =>
    matchScoreService.getPlayerOverridesContext(data.tournamentId),
  '/admin/player-overrides/save': (data) =>
    matchScoreService.savePlayerOverrides(data.tournamentId, data.overrides),

  // Players & teams
  '/players': () => playerService.getAllPlayers(),
  '/player-stats': () => ({}),
  '/team-pool': () => ({
    teamAName: '',
    teamBName: '',
    teamAPlayers: [],
    teamBPlayers: [],
    source: 'db',
  }),
  '/admin/team-squads': () => playerService.getTeamSquads(),
  '/admin/team-squads/:id': (id, data) => playerService.createTeamSquad(id, data.players),
  '/admin/team-squads/:teamCode/delete': (teamCode) =>
    playerService.deleteTeamSquad(teamCode),
  '/admin/match-lineups/:tournamentId/:matchId': (tournamentId, matchId) =>
    playerService.getTournamentMatchLineups(tournamentId, matchId),
  '/admin/match-lineups/upsert': (data) =>
    playerService.upsertMatchLineups(data.tournamentId, data.matchId, data.lineups),

  // Users
  '/users': (filters) => userRepository.findAll(filters),
  '/users/:id': (id) => userRepository.findById(id),
  '/admin/users': (filters) => userRepository.findAll(filters),
  '/admin/users/:id': (id) => userRepository.findById(id),
  '/admin/users/:id/update': (id, data) => userRepository.update(id, data),
  '/admin/users/:id/delete': (id) => userRepository.delete(id),
}

const createDbService = (dependencies) => {
  void dependencies
  const register = (router) => {
    const canManageCatalog = (user) =>
      Boolean(user && ['admin', 'master_admin'].includes(user.role))

    router.delete('/admin/contests/:contestId', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can delete contests' })
        }
        const result = await contestService.deleteContest(req.params.contestId)
        if (!result?.ok) {
          return res.status(404).json({ message: 'Contest not found' })
        }
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    })

    router.delete('/admin/tournaments/:id', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can delete tournaments' })
        }
        const result = await tournamentService.deleteTournament(req.params.id)
        if (!result?.ok) {
          return res.status(404).json({ message: 'Tournament not found' })
        }
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/tournaments/catalog', async (req, res, next) => {
      try {
        const rows = await tournamentService.getTournamentCatalog()
        return res.json(rows)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/contest-match-options', async (req, res, next) => {
      try {
        const tournamentId = (req.query.tournamentId || '').toString()
        const rows = await contestService.getContestMatchOptions(tournamentId)
        return res.json(rows)
      } catch (error) {
        return next(error)
      }
    })

    router.post('/admin/tournaments', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can create tournaments' })
        }
        const result = await tournamentService.createImportedTournament(req.body || {})
        return res.status(201).json(result)
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0)
        if (statusCode >= 400) {
          return res.status(statusCode).json({ message: error.message || 'Failed to create tournament' })
        }
        return next(error)
      }
    })

    router.post('/admin/contests', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can create contests' })
        }
        const result = await contestService.createContest(req.body || {})
        return res.status(201).json(result)
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0)
        if (statusCode >= 400) {
          return res.status(statusCode).json({ message: error.message || 'Failed to create contest' })
        }
        return next(error)
      }
    })

    router.post('/admin/auctions/import', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can import auction contests' })
        }
        const result = await auctionImportService.importAuctionContest(req.body || {})
        return res.status(201).json(result)
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0)
        if (statusCode >= 400) {
          return res
            .status(statusCode)
            .json({ message: error.message || 'Failed to import auction contest' })
        }
        return next(error)
      }
    })

    router.get('/player-stats', async (req, res, next) => {
      try {
        const tournamentId = (req.query.tournamentId || '').toString()
        const rows = await playerService.getTournamentPlayerStats(tournamentId)
        return res.json(rows)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/team-pool', async (req, res, next) => {
      try {
        const contestId = (req.query.contestId || '').toString()
        const tournamentId = (req.query.tournamentId || '').toString()
        const matchId = (req.query.matchId || '').toString()
        const actor = req.currentUser || null
        const targetUser =
          (await resolveDbUser(req.query.userId || actor?.id || actor?.userId || actor?.gameName)) ||
          actor
        if (!actor || !targetUser) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const isSelfRead = Boolean(actor?.id && targetUser?.id && Number(actor.id) === Number(targetUser.id))
        const isMasterAdmin = actor?.role === 'master_admin'
        if (!isSelfRead && !isMasterAdmin) {
          return res.status(403).json({
            message: 'Only master admin can access another user full team.',
          })
        }
        const payload = await playerService.getTeamPool({
          contestId,
          tournamentId,
          matchId,
          userId: targetUser?.id || '',
        })
        return res.json(payload)
      } catch (error) {
        return next(error)
      }
    })

    router.post('/team-selection/save', async (req, res, next) => {
      try {
        const matchId = req.body?.matchId
        const actor = req.currentUser || null
        const targetUser =
          (await resolveDbUser(req.body?.userId || actor?.id || actor?.userId || actor?.gameName)) ||
          actor
        if (!actor || !targetUser) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const isSelfWrite = Boolean(actor?.id && targetUser?.id && Number(actor.id) === Number(targetUser.id))
        const isMasterAdmin = actor?.role === 'master_admin'
        if (!isSelfWrite && !isMasterAdmin) {
          return res.status(403).json({
            message: 'Only master admin can edit another user team.',
          })
        }
        const result = await teamSelectionService.saveTeamSelection(
          matchId,
          targetUser?.id,
          req.body?.playingXi || [],
          req.body?.backups || [],
          req.body?.contestId || null,
          req.body?.captainId || null,
          req.body?.viceCaptainId || null,
        )
        return res.json({
          selection: result,
          saved: true,
        })
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/match-lineups/:tournamentId/:matchId', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can manage match lineups' })
        }
        const payload = await playerService.getTournamentMatchLineups(
          req.params.tournamentId,
          req.params.matchId,
        )
        if (!payload) return res.status(404).json({ message: 'Match not found' })
        return res.json(payload)
      } catch (error) {
        return next(error)
      }
    })

    router.post('/admin/match-lineups/upsert', async (req, res, next) => {
      try {
        if (!canManageCatalog(req.currentUser)) {
          return res.status(403).json({ message: 'Only admin/master can manage match lineups' })
        }
        const payload = await playerService.upsertMatchLineups(
          req.body?.tournamentId,
          req.body?.matchId,
          req.body?.lineups || {},
          {
            source: req.body?.source || 'manual-xi',
            updatedBy: req.body?.updatedBy || req.currentUser?.gameName || req.currentUser?.email || 'admin',
            meta: req.body?.meta || {},
          },
        )
        return res.json(payload)
      } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to save match lineups' })
      }
    })

    router.get('/contests/:contestId/users/:userId/match-scores', async (req, res, next) => {
      try {
        const payload = await contestService.getContestUserMatchScores(
          req.params.contestId,
          req.params.userId,
          req.query.compareUserId || '',
        )
        return res.json(payload)
      } catch (error) {
        return next(error)
      }
    })
  }

  return { register }
}

const getHandler = (path) => dbHandlers[path] || null
const registerProvider = () => dbHandlers

export { createDbService, getHandler, registerProvider }
