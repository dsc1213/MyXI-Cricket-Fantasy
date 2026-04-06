import tournamentService from './tournament.service.js'
import matchService from './match.service.js'
import contestService from './contest.service.js'
import { buildContestView } from './contest.service.js'
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
  '/scoring-rules/save': (data) => scoringRuleService.saveDefaultScoringRules(data.rules),

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
  '/admin/players': (data) => playerService.createPlayer(data),
  '/admin/players/:id/delete': (id) => playerService.deletePlayer(id),
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
    const resolveCatalogActor = async (req) =>
      (await resolveDbUser(
        req.body?.actorUserId ||
          req.query?.actorUserId ||
          req.currentUser?.id ||
          req.currentUser?.userId ||
          req.currentUser?.gameName,
      )) ||
      req.currentUser ||
      null

    router.get('/page-load-data', async (req, res, next) => {
      try {
        const actor = req.currentUser || null
        const userId = actor?.id || actor?.userId || actor?.gameName || ''
        const payload = await pageLoadService.getPageLoadData(userId)
        return res.json(payload)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/bootstrap', async (req, res, next) => {
      try {
        const payload = await pageLoadService.getBootstrapData()
        return res.json(payload)
      } catch (error) {
        return next(error)
      }
    })

    router.post('/scoring-rules/save', async (req, res, next) => {
      try {
        const actor =
          (await resolveDbUser(
            req.body?.actorUserId ||
              req.currentUser?.id ||
              req.currentUser?.userId ||
              req.currentUser?.gameName,
          )) || req.currentUser
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage scoring rules' })
        }
        const payload = await scoringRuleService.saveDefaultScoringRules(
          req.body?.rules || null,
        )
        return res.json({ ok: true, savedAt: new Date().toISOString(), ...payload })
      } catch (error) {
        return next(error)
      }
    })

    router.delete('/admin/contests/:contestId', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can delete contests' })
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
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can delete tournaments' })
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

    router.get('/tournaments', async (req, res, next) => {
      try {
        const rows = await tournamentService.getVisibleTournaments()
        return res.json(rows || [])
      } catch (error) {
        return next(error)
      }
    })

    router.get('/tournaments/:id/matches', async (req, res, next) => {
      try {
        const rows = await tournamentService.getTournamentMatches(req.params.id)
        return res.json(rows || [])
      } catch (error) {
        return next(error)
      }
    })

    router.get('/contests', async (req, res, next) => {
      try {
        const allRows = await contestService.getAllContests()
        const gameFilter = (req.query?.game || '').toString().trim().toLowerCase()
        const tournamentIdFilter = (req.query?.tournamentId || '').toString().trim()
        const joinedFilter = (req.query?.joined || '').toString().trim().toLowerCase()
        const actor =
          (await resolveDbUser(
            req.query?.userId ||
              req.currentUser?.id ||
              req.currentUser?.userId ||
              req.currentUser?.gameName,
          )) ||
          req.currentUser ||
          null

        const rowsWithDerivedState = await Promise.all(
          (allRows || []).map(async (row) => {
            const participantPayload = await contestService.getContestParticipants(row.id)
            const participantRows = Array.isArray(participantPayload?.participants)
              ? participantPayload.participants
              : []
            const joinedCount = Number(
              participantPayload?.joinedCount || participantRows.length || 0,
            )
            const joined = Boolean(
              actor?.id &&
              participantRows.some(
                (participant) => Number(participant.id || 0) === Number(actor.id),
              ),
            )
            return buildContestView(row, {
              joined,
              joinedCount,
              participants: joinedCount,
            })
          }),
        )

        const filtered = rowsWithDerivedState.filter((row) => {
          const gameOk =
            !gameFilter ||
            (row?.game || '').toString().trim().toLowerCase() === gameFilter
          const tournamentOk =
            !tournamentIdFilter || String(row?.tournamentId || '') === tournamentIdFilter
          const joinedOk =
            !joinedFilter ||
            (joinedFilter === 'true' && row.joined) ||
            (joinedFilter === 'false' && !row.joined)
          return gameOk && tournamentOk && joinedOk
        })

        return res.json(filtered)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/contests/:id', async (req, res, next) => {
      try {
        const contest = await contestService.getContestById(req.params.id)
        if (!contest) {
          return res.status(404).json({ message: 'Contest not found' })
        }
        const participantPayload = await contestService.getContestParticipants(
          req.params.id,
        )
        const joinedCount = Number(
          participantPayload?.joinedCount ||
            (Array.isArray(participantPayload?.participants)
              ? participantPayload.participants.length
              : 0),
        )
        return res.json(
          buildContestView(contest, {
            joinedCount,
            participants: joinedCount,
          }),
        )
      } catch (error) {
        return next(error)
      }
    })

    router.get('/contests/:id/matches', async (req, res, next) => {
      try {
        const actor = req.currentUser || null
        const targetUser =
          (await resolveDbUser(
            req.query.userId ||
              actor?.id ||
              actor?.userId ||
              actor?.gameName ||
              actor?.email,
          )) || actor
        const rows = await contestService.getContestMatches(req.params.id, {
          status: req.query.status,
          team: req.query.team,
          viewerUserId: targetUser?.id || null,
        })
        return res.json(rows || [])
      } catch (error) {
        return next(error)
      }
    })

    router.get('/contests/:id/participants', async (req, res, next) => {
      try {
        const actor = req.currentUser || null
        const targetUser =
          (await resolveDbUser(
            req.query.userId ||
              actor?.id ||
              actor?.userId ||
              actor?.gameName ||
              actor?.email,
          )) || actor
        const payload = await contestService.getContestParticipants(req.params.id, {
          matchId: req.query?.matchId,
          viewerUserId: targetUser?.id || null,
        })
        return res.json(payload || { participants: [], joinedCount: 0, previewXI: [] })
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/contests/catalog', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage contests' })
        }
        const tournamentId = (req.query?.tournamentId || '').toString().trim()
        const rows = tournamentId
          ? await contestService.getContestsByTournament(tournamentId)
          : await contestService.getAllContests()
        return res.json(
          (rows || []).map((row) => buildContestView(row, { enabled: true })),
        )
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/match-score-context', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor) && actor?.role !== 'contest_manager') {
          return res
            .status(403)
            .json({ message: 'Only score managers/admin/master can manage scores' })
        }
        const requestedTournamentId = (req.query?.tournamentId || '').toString().trim()
        const tournaments = await tournamentService.getTournamentCatalog()
        const selectedTournamentId =
          requestedTournamentId &&
          (tournaments || []).some((item) => String(item.id) === requestedTournamentId)
            ? requestedTournamentId
            : String(tournaments?.[0]?.id || '')
        const matches = selectedTournamentId
          ? await tournamentService.getTournamentMatches(selectedTournamentId)
          : []
        return res.json({
          tournaments: (tournaments || []).map((row) => ({
            id: String(row.id),
            name: row.name,
            season: row.season,
            status: row.enabled ? 'active' : 'inactive',
          })),
          selectedTournamentId,
          matches: (matches || []).map((row) => ({
            id: String(row.id),
            tournamentId: String(selectedTournamentId),
            label:
              row.name || `${row.teamA || row.teamAKey} vs ${row.teamB || row.teamBKey}`,
            name:
              row.name || `${row.teamA || row.teamAKey} vs ${row.teamB || row.teamBKey}`,
            home: row.teamA || row.teamAKey || '',
            away: row.teamB || row.teamBKey || '',
            date: row.startAt || row.startTime || row.date || '',
          })),
        })
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/users', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage users' })
        }
        const { search, role, status } = req.query || {}
        const rows = await userRepository.findAll({ search, role, status })
        return res.json(rows || [])
      } catch (error) {
        return next(error)
      }
    })

    router.patch('/admin/users/:id', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage users' })
        }
        const target = await userRepository.findById(req.params.id)
        if (!target) {
          return res.status(404).json({ message: 'User not found' })
        }
        if (target.role === 'master_admin' && actor?.role !== 'master_admin') {
          return res
            .status(403)
            .json({ message: 'Only master can modify master admin users' })
        }
        const data = await userRepository.update(req.params.id, req.body || {})
        if (!data) {
          return res.status(404).json({ message: 'User not found' })
        }
        return res.json(data)
      } catch (error) {
        return next(error)
      }
    })

    router.delete('/admin/users/:id', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!actor || actor.role !== 'master_admin') {
          return res.status(403).json({ message: 'Only master can delete users' })
        }
        const target = await userRepository.findById(req.params.id)
        if (!target) {
          return res.status(404).json({ message: 'User not found' })
        }
        if (target.role === 'master_admin') {
          return res.status(400).json({ message: 'Cannot delete master admin' })
        }
        const deleted = await userRepository.delete(req.params.id)
        if (!deleted) {
          return res.status(404).json({ message: 'User not found' })
        }
        return res.json({ deleted: true })
      } catch (error) {
        return next(error)
      }
    })

    router.post('/admin/tournaments/enable', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage tournaments' })
        }
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
        const updated = []
        for (const id of ids) {
          const row = await tournamentService.updateTournament(id, { status: 'active' })
          if (row) updated.push(row)
        }
        return res.json({ ok: true, tournaments: updated })
      } catch (error) {
        return next(error)
      }
    })

    router.post('/admin/tournaments/disable', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage tournaments' })
        }
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
        const updated = []
        for (const id of ids) {
          const row = await tournamentService.updateTournament(id, { status: 'inactive' })
          if (row) updated.push(row)
        }
        return res.json({ ok: true, tournaments: updated })
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
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can create tournaments' })
        }
        const result = await tournamentService.createImportedTournament(req.body || {})
        return res.status(201).json(result)
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0)
        if (statusCode >= 400) {
          return res
            .status(statusCode)
            .json({ message: error.message || 'Failed to create tournament' })
        }
        return next(error)
      }
    })

    router.post('/admin/contests', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can create contests' })
        }
        const result = await contestService.createContest(req.body || {})
        return res.status(201).json(result)
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0)
        if (statusCode >= 400) {
          return res
            .status(statusCode)
            .json({ message: error.message || 'Failed to create contest' })
        }
        return next(error)
      }
    })

    router.post('/admin/contests/:id/start', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can start contests' })
        }
        const result = await contestService.startContest(req.params.id)
        return res.json(result)
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0)
        if (statusCode >= 400) {
          return res
            .status(statusCode)
            .json({ message: error.message || 'Failed to start contest' })
        }
        return next(error)
      }
    })

    router.post('/admin/matches/:id/status', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can update match status' })
        }
        const status = (req.body?.status || '').toString().trim().toLowerCase()
        if (!['notstarted', 'inprogress', 'completed'].includes(status)) {
          return res.status(400).json({ message: 'Valid status is required' })
        }
        const result = await matchService.updateMatchStatus(req.params.id, status)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    })

    router.post('/admin/auctions/import', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can import auction contests' })
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

    router.get('/admin/team-squads', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage squads' })
        }
        const tournamentId = (req.query.tournamentId || '').toString().trim()
        const rows = await playerService.getTeamSquads(tournamentId || null)
        const teamCode = (req.query.teamCode || '').toString().trim().toUpperCase()
        const filtered = teamCode ? rows.filter((row) => row.teamCode === teamCode) : rows
        return res.json(filtered)
      } catch (error) {
        return next(error)
      }
    })

    router.post('/admin/players', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage players' })
        }
        if (Array.isArray(req.body?.players)) {
          const result = await playerService.importPlayers(req.body || {})
          return res.status(201).json(result)
        }
        const player = await playerService.createPlayer(req.body || {})
        return res.status(201).json({ ok: true, player })
      } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to save player' })
      }
    })

    router.delete('/admin/players/:id', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage players' })
        }
        await playerService.deletePlayer(req.params.id)
        return res.json({ ok: true, removedId: req.params.id })
      } catch (error) {
        return res
          .status(400)
          .json({ message: error.message || 'Failed to delete player' })
      }
    })

    router.post('/admin/team-squads', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage squads' })
        }
        const payload = req.body || {}
        if (Array.isArray(payload.teamSquads)) {
          const result = await playerService.importTeamSquadMappings(payload)
          return res.status(201).json(result)
        }
        const teamCode = (payload.teamCode || '').toString().trim().toUpperCase()
        if (!teamCode) {
          return res.status(400).json({ message: 'teamCode is required' })
        }
        const created = await playerService.createTeamSquad(teamCode, payload)
        return res.status(201).json({
          ok: true,
          teamCode,
          createdCount: Array.isArray(created) ? created.length : 0,
        })
      } catch (error) {
        return res.status(400).json({ message: error.message || 'Failed to save squad' })
      }
    })

    router.delete('/admin/team-squads/:teamCode', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res.status(403).json({ message: 'Only admin/master can manage squads' })
        }
        const teamCode = (req.params.teamCode || '').toString().trim().toUpperCase()
        const tournamentId = (req.body?.tournamentId || req.query?.tournamentId || '')
          .toString()
          .trim()
        const result = await playerService.deleteTeamSquad(teamCode, tournamentId || null)
        return res.json({ ok: true, ...result })
      } catch (error) {
        return next(error)
      }
    })

    router.get('/players', async (req, res, next) => {
      try {
        const rows = await playerService.getAllPlayers()
        return res.json(rows)
      } catch (error) {
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
          (await resolveDbUser(
            req.query.userId || actor?.id || actor?.userId || actor?.gameName,
          )) || actor
        if (!actor || !targetUser) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const isSelfRead = Boolean(
          actor?.id && targetUser?.id && Number(actor.id) === Number(targetUser.id),
        )
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

    router.get('/users/:userId/picks', async (req, res, next) => {
      try {
        const actor = req.currentUser || null
        const targetUser =
          (await resolveDbUser(
            req.params.userId || actor?.id || actor?.userId || actor?.gameName,
          )) || actor
        if (!actor || !targetUser) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const isSelfRead = Boolean(
          actor?.id && targetUser?.id && Number(actor.id) === Number(targetUser.id),
        )
        const isMasterAdmin = actor?.role === 'master_admin'
        if (!isSelfRead && !isMasterAdmin) {
          return res.status(403).json({
            message: 'Only master admin can access another user full team.',
          })
        }
        const payload = await playerService.getUserPicks({
          userId: targetUser?.id || '',
          tournamentId: (req.query.tournamentId || '').toString(),
          contestId: (req.query.contestId || '').toString(),
          matchId: (req.query.matchId || '').toString(),
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
          (await resolveDbUser(
            req.body?.userId || actor?.id || actor?.userId || actor?.gameName,
          )) || actor
        if (!actor || !targetUser) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const isSelfWrite = Boolean(
          actor?.id && targetUser?.id && Number(actor.id) === Number(targetUser.id),
        )
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

    router.post('/matches/:id/team', async (req, res, next) => {
      try {
        const actor = req.currentUser || null
        const targetUser =
          (await resolveDbUser(
            req.body?.userId || actor?.id || actor?.userId || actor?.gameName,
          )) || actor
        if (!actor || !targetUser) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const isSelfWrite = Boolean(
          actor?.id && targetUser?.id && Number(actor.id) === Number(targetUser.id),
        )
        const isMasterAdmin = actor?.role === 'master_admin'
        if (!isSelfWrite && !isMasterAdmin) {
          return res.status(403).json({
            message: 'Only master admin can edit another user team.',
          })
        }
        const result = await teamSelectionService.saveTeamSelection(
          req.params.id,
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

    router.post('/contests/:id/join', async (req, res, next) => {
      try {
        const actor = req.currentUser || null
        if (!actor?.id) {
          return res.status(401).json({ message: 'Unauthorized' })
        }
        const requestedUser =
          (await resolveDbUser(
            req.body?.userId || req.currentUser?.id || req.currentUser?.userId,
          )) || actor
        const isSelf = Number(requestedUser?.id || 0) === Number(actor?.id || 0)
        const isMaster = actor?.role === 'master_admin'
        if (!requestedUser?.id || (!isSelf && !isMaster)) {
          return res.status(403).json({ message: 'Forbidden' })
        }
        const result = await contestService.joinContest(req.params.id, requestedUser.id)
        return res.json(result)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/contests/:id/leaderboard', async (req, res, next) => {
      try {
        const rows = await contestService.getContestLeaderboard(req.params.id)
        return res.json(rows)
      } catch (error) {
        return next(error)
      }
    })

    router.get('/admin/match-lineups/:tournamentId/:matchId', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage match lineups' })
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
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage match lineups' })
        }
        const payload = await playerService.upsertMatchLineups(
          req.body?.tournamentId,
          req.body?.matchId,
          req.body?.lineups || {},
          {
            source: req.body?.source || 'manual-xi',
            updatedBy:
              req.body?.updatedBy ||
              req.currentUser?.gameName ||
              req.currentUser?.email ||
              'admin',
            meta: req.body?.meta || {},
          },
        )
        return res.json(payload)
      } catch (error) {
        return res
          .status(400)
          .json({ message: error.message || 'Failed to save match lineups' })
      }
    })

    router.get(
      '/contests/:contestId/users/:userId/match-scores',
      async (req, res, next) => {
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
      },
    )

    router.post('/admin/match-scores/upsert', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage match scores' })
        }
        const uploadedByActor =
          (await resolveDbUser(
            req.body?.userId ||
              req.body?.uploadedBy ||
              actor?.id ||
              actor?.userId ||
              actor?.gameName,
          )) || actor
        const payload = await matchScoreService.uploadMatchScores(
          req.body?.matchId,
          req.body?.tournamentId,
          req.body?.playerStats || [],
          uploadedByActor?.id || null,
        )
        return res.json(payload)
      } catch (error) {
        return res
          .status(400)
          .json({ message: error.message || 'Failed to save match scores' })
      }
    })

    router.post('/match-scores/save', async (req, res, next) => {
      try {
        const actor = await resolveCatalogActor(req)
        if (!canManageCatalog(actor)) {
          return res
            .status(403)
            .json({ message: 'Only admin/master can manage match scores' })
        }

        const {
          payloadText,
          processedPayload,
          tournamentId,
          matchId,
          userId,
          uploadedBy,
        } = req.body || {}

        if (!tournamentId || !matchId) {
          return res
            .status(400)
            .json({ message: 'tournamentId and matchId are required' })
        }

        let parsedPayload = {}
        if (typeof payloadText === 'string' && payloadText.trim()) {
          try {
            parsedPayload = JSON.parse(payloadText)
          } catch {
            return res.status(400).json({ message: 'Invalid JSON payloadText' })
          }
        }

        const rows =
          processedPayload?.playerStats ||
          parsedPayload?.playerStats ||
          req.body?.playerStats

        if (!Array.isArray(rows) || !rows.length) {
          return res
            .status(400)
            .json({ message: 'playerStats required for match upsert' })
        }

        const uploadedByActor =
          (await resolveDbUser(
            userId || uploadedBy || actor?.id || actor?.userId || actor?.gameName,
          )) || actor

        const payload = await matchScoreService.uploadMatchScores(
          String(matchId),
          String(tournamentId),
          rows,
          uploadedByActor?.id || null,
        )

        return res.json(payload)
      } catch (error) {
        return res
          .status(400)
          .json({ message: error.message || 'Failed to save match scores' })
      }
    })
  }

  return { register }
}

const getHandler = (path) => dbHandlers[path] || null
const registerProvider = () => dbHandlers

export { createDbService, getHandler, registerProvider }
