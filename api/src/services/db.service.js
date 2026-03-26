import tournamentService from './tournament.service.js'
import matchService from './match.service.js'
import contestService from './contest.service.js'
import teamSelectionService from './team-selection.service.js'
import scoringRuleService from './scoring-rule.service.js'
import matchScoreService from './match-score.service.js'
import playerService from './player.service.js'
import pageLoadService from './pageload.service.js'
import userRepository from '../repositories/user.repository.js'

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
    scoringRuleService.saveScoringRules(data.tournamentId, data.rules),

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
    void router
    // DB mode registers handlers via provider controller
  }

  return { register }
}

const getHandler = (path) => dbHandlers[path] || null
const registerProvider = () => dbHandlers

export { createDbService, getHandler, registerProvider }
