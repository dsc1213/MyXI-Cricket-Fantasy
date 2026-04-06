import { NavLink, useLocation } from 'react-router-dom'

function TournamentPageTabs({ tournamentId }) {
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)
  const isContestLeaderboardRoute =
    pathParts[0] === 'tournaments' &&
    pathParts[1] === tournamentId &&
    pathParts[2] === 'contests' &&
    Boolean(pathParts[3]) &&
    pathParts[4] === 'leaderboard'
  const isLeaderboardRoute =
    location.pathname === `/tournaments/${tournamentId}/leaderboard` || isContestLeaderboardRoute
  return (
    <div className="tournament-page-tabs-wrap">
      <div className="tournament-page-tabs">
        <NavLink
          to={`/tournaments/${tournamentId}`}
          className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
          end
        >
          My Contests
        </NavLink>
        <NavLink
          to={`/tournaments/${tournamentId}/leaderboard`}
          className={({ isActive }) =>
            `tab-link ${isActive || isLeaderboardRoute ? 'active' : ''}`
          }
          end
        >
          Leaderboard
        </NavLink>
        <NavLink
          to={`/tournaments/${tournamentId}/cricketer-stats`}
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
