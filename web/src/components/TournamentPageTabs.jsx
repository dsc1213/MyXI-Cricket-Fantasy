import { NavLink, useLocation } from 'react-router-dom'

function TournamentPageTabs({ tournamentId }) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const viewMode = searchParams.get('view') || ''
  const contestIdFromQuery = searchParams.get('contestId') || ''
  const pathParts = location.pathname.split('/').filter(Boolean)
  const isContestLeaderboardRoute =
    pathParts[0] === 'tournaments' &&
    pathParts[1] === tournamentId &&
    pathParts[2] === 'contests' &&
    Boolean(pathParts[3]) &&
    pathParts[4] === 'leaderboard'
  const isLeaderboardRoute =
    location.pathname === `/tournaments/${tournamentId}/leaderboard` ||
    isContestLeaderboardRoute
  const contestIdFromPath = isContestLeaderboardRoute ? pathParts[3] || '' : ''
  const stickyContestId = contestIdFromQuery || contestIdFromPath
  const buildSearch = ({ includeContestId = false } = {}) => {
    const next = new URLSearchParams()
    if (viewMode) next.set('view', viewMode)
    if (includeContestId && stickyContestId) next.set('contestId', stickyContestId)
    const query = next.toString()
    return query ? `?${query}` : ''
  }
  const leaderboardTo = stickyContestId
    ? `/tournaments/${tournamentId}/contests/${stickyContestId}/leaderboard${buildSearch({ includeContestId: true })}`
    : `/tournaments/${tournamentId}/leaderboard${buildSearch()}`
  const statsTo = `/tournaments/${tournamentId}/cricketer-stats${buildSearch({ includeContestId: true })}`
  const contestsTo = `/tournaments/${tournamentId}${buildSearch()}`
  return (
    <div className="tournament-page-tabs-wrap">
      <div className="tournament-page-tabs">
        <NavLink
          to={contestsTo}
          className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
          end
        >
          My Contests
        </NavLink>
        <NavLink
          to={leaderboardTo}
          className={({ isActive }) =>
            `tab-link ${isActive || isLeaderboardRoute ? 'active' : ''}`
          }
          end
        >
          Leaderboard
        </NavLink>
        <NavLink
          to={statsTo}
          className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
          end
        >
          Stats
        </NavLink>
      </div>
    </div>
  )
}

export default TournamentPageTabs
