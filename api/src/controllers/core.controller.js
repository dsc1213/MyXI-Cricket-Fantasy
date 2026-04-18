// ES module, dependency-injected controller for all core endpoints
const createCoreController = ({
  tournamentService,
  matchService,
  teamSelectionService,
  scoringRuleService,
  matchScoreService,
  playerService,
  contestService,
  pageLoadService,
  userRepository,
}) => {
  // Tournaments
  const getTournaments = async (req, res) => {
    try {
      const data = await tournamentService.getVisibleTournaments()
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getTournamentMatches = async (req, res) => {
    try {
      const { id } = req.params
      const data = await tournamentService.getTournamentMatches(id)
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getTournamentLeaderboard = async (req, res) => {
    try {
      const { id } = req.params
      const data = await tournamentService.getTournamentLeaderboard(id)
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  // Matches
  const updateMatchStatus = async (req, res) => {
    try {
      const { id } = req.params
      const { status } = req.body
      if (!status) return res.status(400).json({ error: 'Status required' })
      const data = await matchService.updateMatchStatus(id, status)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const replaceMatchBackups = async (req, res) => {
    try {
      const { id } = req.params
      const data = await matchService.forceApplyBackupReplacement(id)
      res.json(data)
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500)
      res.status(statusCode).json({ error: error.message })
    }
  }
  const uploadMatchScore = async (req, res) => {
    try {
      const { id } = req.params
      const { tournamentId, playerStats, uploadedBy } = req.body
      if (!tournamentId || !playerStats) {
        return res.status(400).json({ error: 'tournamentId and playerStats required' })
      }
      const data = await matchService.uploadScore(
        id,
        tournamentId,
        playerStats,
        uploadedBy,
      )
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getMatchScoreHistory = async (req, res) => {
    try {
      const { id } = req.params
      const data = await matchService.getScoreHistory(id)
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const rollbackMatchScore = async (req, res) => {
    try {
      const { id } = req.params
      const { scoreId } = req.body
      if (!scoreId) return res.status(400).json({ error: 'scoreId required' })
      const data = await matchService.rollbackScore(id, scoreId)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  // Team selection
  const saveTeamSelection = async (req, res) => {
    try {
      const { id } = req.params
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const { playingXi, backups, contestId, captainId, viceCaptainId } = req.body
      if (!playingXi || !Array.isArray(playingXi)) {
        return res.status(400).json({ error: 'playingXi array required' })
      }
      const data = await teamSelectionService.saveTeamSelection(
        id,
        userId,
        playingXi,
        backups || [],
        contestId || null,
        captainId || null,
        viceCaptainId || null,
      )
      res.json(data)
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500)
      res.status(statusCode).json({ error: error.message })
    }
  }
  // Scoring rules
  const createScoringRule = async (req, res) => {
    try {
      const { tournamentId, rules } = req.body
      if (!tournamentId || !rules) {
        return res.status(400).json({ error: 'tournamentId and rules required' })
      }
      const data = await scoringRuleService.createScoringRule(tournamentId, rules)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  // Users
  const getUsers = async (req, res) => {
    try {
      const { search, role, status } = req.query
      const data = await userRepository.findAll({ search, role, status })
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const updateUser = async (req, res) => {
    try {
      const { id } = req.params
      const data = await userRepository.update(id, req.body)
      if (!data) return res.status(404).json({ error: 'User not found' })
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const deleteUser = async (req, res) => {
    try {
      const { id } = req.params
      const success = await userRepository.delete(id)
      if (!success) return res.status(404).json({ error: 'User not found' })
      res.json({ deleted: true })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  // Contests
  const getContests = async (req, res) => {
    try {
      const data = await contestService.getAllContests()
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getContest = async (req, res) => {
    try {
      const { id } = req.params
      const data = await contestService.getContestById(id)
      if (!data) return res.status(404).json({ error: 'Contest not found' })
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const joinContest = async (req, res) => {
    try {
      const { id } = req.params
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const data = await contestService.joinContest(id, userId)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const leaveContest = async (req, res) => {
    try {
      const { id } = req.params
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      const data = await contestService.leaveContest(id, userId)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getContestMatches = async (req, res) => {
    try {
      const { id } = req.params
      const data = await contestService.getContestMatches(id)
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getContestParticipants = async (req, res) => {
    try {
      const { id } = req.params
      const data = await contestService.getContestParticipants(id)
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
  const getContestLeaderboard = async (req, res) => {
    try {
      const { id } = req.params
      const data = await contestService.getContestLeaderboard(id)
      res.json(data || [])
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }

  return {
    getTournaments,
    getTournamentMatches,
    getTournamentLeaderboard,
    updateMatchStatus,
    replaceMatchBackups,
    uploadMatchScore,
    getMatchScoreHistory,
    rollbackMatchScore,
    saveTeamSelection,
    createScoringRule,
    getUsers,
    updateUser,
    deleteUser,
    getContests,
    getContest,
    joinContest,
    leaveContest,
    getContestMatches,
    getContestParticipants,
    getContestLeaderboard,
  }
}

export { createCoreController }
