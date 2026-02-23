const createProviderController = ({
  mockApiEnabled,
  shouldHandleProviderPath,
  mockProviderRouter,
  dbProviderRouter,
}) => {
  const buildDbFallbackResponse = ({ method = 'GET', path = '' }) => {
    const normalizedMethod = (method || 'GET').toString().toUpperCase()
    if (normalizedMethod === 'GET') {
      if (path === '/page-load-data' || path === '/bootstrap') {
        return {
          status: 200,
          payload: {
            tournaments: [],
            joinedContests: [],
            pointsRuleTemplate: { batting: [], bowling: [], fielding: [] },
            adminManager: [],
            masterConsole: [],
            auditLogs: [],
            source: 'db',
          },
        }
      }
      if (path === '/tournaments') return { status: 200, payload: [] }
      if (path === '/tournaments/pretty') return { status: 200, payload: {} }
      if (path === '/contests') return { status: 200, payload: [] }
      if (/^\/contests\/[^/]+$/.test(path)) {
        return { status: 400, payload: { message: 'Contest not found', source: 'db' } }
      }
      if (/^\/contests\/[^/]+\/matches$/.test(path)) return { status: 200, payload: [] }
      if (/^\/contests\/[^/]+\/participants$/.test(path)) {
        return {
          status: 200,
          payload: {
            activeMatch: null,
            joinedCount: 0,
            withTeamCount: 0,
            participants: [],
            previewXI: [],
            source: 'db',
          },
        }
      }
      if (/^\/contests\/[^/]+\/leaderboard$/.test(path)) return { status: 200, payload: [] }
      if (/^\/contests\/[^/]+\/users\/[^/]+\/match-scores$/.test(path)) {
        return { status: 200, payload: [] }
      }
      if (path === '/players') return { status: 200, payload: [] }
      if (path === '/player-stats') return { status: 200, payload: [] }
      if (path === '/team-pool') {
        return {
          status: 200,
          payload: {
            teamAName: 'Team A',
            teamBName: 'Team B',
            teamAPlayers: [],
            teamBPlayers: [],
            source: 'db',
          },
        }
      }
      if (path === '/match-options') {
        return {
          status: 200,
          payload: { tournaments: [], matches: [], selectedTournamentId: '', source: 'db' },
        }
      }
      if (/^\/users\/[^/]+\/picks$/.test(path)) return { status: 200, payload: [] }
      if (path === '/admin/users') return { status: 200, payload: [] }
      if (path === '/admin/tournaments/catalog') return { status: 200, payload: [] }
      if (path === '/admin/contest-match-options') return { status: 200, payload: [] }
      if (path === '/admin/contests/catalog') return { status: 200, payload: [] }
      if (path === '/admin/match-score-context') {
        return {
          status: 200,
          payload: { tournaments: [], matches: [], selectedTournamentId: '', source: 'db' },
        }
      }
      if (path === '/admin/player-overrides/context') {
        return {
          status: 200,
          payload: { tournaments: [], matches: [], players: [], source: 'db' },
        }
      }
    }
    return {
      status: 400,
      payload: {
        message: `Endpoint ${path} is not implemented for DB mode yet`,
        source: 'db',
      },
    }
  }

  const dispatch = (req, res, next) => {
    const path = (req.path || '').toString()
    if (!shouldHandleProviderPath(path)) return next()

    if (mockApiEnabled) {
      return mockProviderRouter(req, res, next)
    }

    return dbProviderRouter(req, res, (error) => {
      if (error) return next(error)
      if (res.headersSent) return next()
      const { status, payload } = buildDbFallbackResponse({
        method: req.method,
        path,
      })
      return res.status(status).json(payload)
    })
  }

  return { dispatch }
}

export { createProviderController }
