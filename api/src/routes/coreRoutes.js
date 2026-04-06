// Accept injected controller instance for all endpoints
const registerCoreRoutes = (router, { authenticate, requireRole, coreController }) => {
  // Admin scoring rules
  router.post(
    '/admin/scoring-rules',
    requireRole(['admin', 'master_admin']),
    coreController.createScoringRule,
  )

  // Admin tournaments
  router.get(
    '/admin/tournaments',
    requireRole(['admin', 'master_admin']),
    coreController.getTournaments,
  )

  // Admin matches
  router.patch(
    '/admin/matches/:id/status',
    requireRole(['admin', 'master_admin']),
    coreController.updateMatchStatus,
  )

  router.post(
    '/admin/matches/:id/score-upload',
    requireRole(['admin', 'master_admin']),
    coreController.uploadMatchScore,
  )

  router.get(
    '/admin/matches/:id/score-history',
    requireRole(['admin', 'master_admin']),
    coreController.getMatchScoreHistory,
  )

  router.post(
    '/admin/matches/:id/score-rollback',
    requireRole(['admin', 'master_admin']),
    coreController.rollbackMatchScore,
  )

  // Public tournaments
  router.get('/tournaments', coreController.getTournaments)

  router.get('/tournaments/:id/matches', coreController.getTournamentMatches)

  router.get('/tournaments/:id/leaderboard', coreController.getTournamentLeaderboard)

  // Team selection
  router.post('/matches/:id/team', authenticate, coreController.saveTeamSelection)

  // Users
  router.get('/users', requireRole(['admin', 'master_admin']), coreController.getUsers)

  router.patch('/users/:id', authenticate, coreController.updateUser)

  router.delete('/users/:id', requireRole(['master_admin']), coreController.deleteUser)

  // Contests
  router.get('/contests', coreController.getContests)

  router.get('/contests/:id', coreController.getContest)

  router.post('/contests/:id/join', authenticate, coreController.joinContest)

  router.post('/contests/:id/leave', authenticate, coreController.leaveContest)

  router.get('/contests/:id/matches', coreController.getContestMatches)

  router.get('/contests/:id/participants', coreController.getContestParticipants)

  router.get('/contests/:id/leaderboard', coreController.getContestLeaderboard)
}

export { registerCoreRoutes }
