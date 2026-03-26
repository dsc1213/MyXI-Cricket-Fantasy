import * as dbService from '../services/db.service.js'

// Fallback empty responses for unimplemented endpoints
const fallbackResponses = {
  '/page-load-data': {
    tournaments: [],
    joinedContests: [],
    pointsRuleTemplate: {},
    source: 'db',
  },
  '/bootstrap': { tournaments: [], contests: [], source: 'db' },
  '/tournaments': [],
  '/tournaments/:id': {},
  '/tournaments/:id/matches': [],
  '/tournaments/:id/leaderboard': [],
  '/contests': [],
  '/contests/:id': {},
  '/team-pool': {
    teamAName: '',
    teamBName: '',
    teamAPlayers: [],
    teamBPlayers: [],
    source: 'db',
  },
  '/players': [],
  '/player-stats': [],
  '/admin/tournaments': [],
  '/admin/contests/catalog': [],
  '/admin/team-squads': {},
  '/admin/match-lineups/:tournamentId/:matchId': [],
}

// Get handler for a route path

const getHandler = (path) => {
  const handler = dbService.getHandler(path)
  if (handler) return handler
  return fallbackResponses[path] || {}
}

export const createProviderController = ({
  mockApiEnabled,
  shouldHandleProviderPath,
  mockProviderRouter,
  dbProviderRouter,
}) => {
  const buildDbFallbackResponse = ({ method = 'GET', path = '' }) => {
    return {
      status: 200,
      payload: fallbackResponses[path] || {},
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

  return { dispatch, getHandler }
}
