// Conditional repository factory: returns mock or DB repos based on MOCK_API env
const isMockMode = () => {
  const mode = (process.env.MOCK_API || '').toString().trim().toLowerCase()
  return mode === 'true'
}

let mockContext = null // Lazily injected from routerBuilder

const setMockContext = (ctx) => {
  mockContext = ctx
}

const createRepositoryFactory = () => {
  return {
    isMockMode,
    setMockContext,
    getMockContext: () => mockContext,
    getTournamentRepository: async () => {
      if (isMockMode()) {
        const { TournamentMockRepository } =
          await import('./mock/tournament.mock.repository.js')
        return new TournamentMockRepository(mockContext)
      }
      const { default: tournamentRepository } = await import('./tournament.repository.js')
      return tournamentRepository
    },
    getMatchRepository: async () => {
      if (isMockMode()) {
        const { MatchMockRepository } = await import('./mock/match.mock.repository.js')
        return new MatchMockRepository(mockContext)
      }
      const { default: matchRepository } = await import('./match.repository.js')
      return matchRepository
    },
    getTeamSelectionRepository: async () => {
      if (isMockMode()) {
        const { TeamSelectionMockRepository } =
          await import('./mock/team-selection.mock.repository.js')
        return new TeamSelectionMockRepository(mockContext)
      }
      const { default: teamSelectionRepository } =
        await import('./team-selection.repository.js')
      return teamSelectionRepository
    },
    getScoringRuleRepository: async () => {
      if (isMockMode()) {
        const { ScoringRuleMockRepository } =
          await import('./mock/scoring-rule.mock.repository.js')
        return new ScoringRuleMockRepository(mockContext)
      }
      const { default: scoringRuleRepository } =
        await import('./scoring-rule.repository.js')
      return scoringRuleRepository
    },
    getMatchScoreRepository: async () => {
      if (isMockMode()) {
        const { MatchScoreMockRepository } =
          await import('./mock/match-score.mock.repository.js')
        return new MatchScoreMockRepository(mockContext)
      }
      const { default: matchScoreRepository } =
        await import('./match-score.repository.js')
      return matchScoreRepository
    },
    getContestRepository: async () => {
      if (isMockMode()) {
        const { ContestMockRepository } =
          await import('./mock/contest.mock.repository.js')
        return new ContestMockRepository(mockContext)
      }
      const { default: contestRepository } = await import('./contest.repository.js')
      return contestRepository
    },
    getPlayerRepository: async () => {
      if (isMockMode()) {
        const { PlayerMockRepository } = await import('./mock/player.mock.repository.js')
        return new PlayerMockRepository(mockContext)
      }
      const { default: playerRepository } = await import('./player.repository.js')
      return playerRepository
    },
    getUserRepository: async () => {
      try {
        if (isMockMode()) {
          const { UserMockRepository } = await import('./mock/user.mock.repository.js')
          return new UserMockRepository(mockContext)
        }
        const { default: userRepository } = await import('./user.repository.js')
        return userRepository
      } catch (err) {
        console.error('>>>>err', err)
        return null
      }
    },
  }
}

export { createRepositoryFactory, setMockContext, isMockMode }
