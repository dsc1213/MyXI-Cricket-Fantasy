import { Link } from 'react-router-dom'
import FilterableTable from '../components/ui/FilterableTable.jsx'

const pageRows = [
  { id: 'home-landing', page: 'Home', route: '/', example: '/' },
  { id: 'home-dashboard', page: 'Home Dashboard', route: '/home', example: '/home' },
  { id: 'login', page: 'Login', route: '/login', example: '/login' },
  { id: 'register', page: 'Register', route: '/register', example: '/register' },
  { id: 'pending', page: 'Pending', route: '/pending', example: '/pending' },
  { id: 'fantasy-hub', page: 'Fantasy Hub', route: '/fantasy', example: '/fantasy' },
  {
    id: 'team-select',
    page: 'Fantasy Team Selection',
    route: '/fantasy/select',
    example: '/fantasy/select?contest=huntercherry&match=m1&mode=edit',
  },
  { id: 'drafts', page: 'Drafts Hub', route: '/drafts', example: '/drafts' },
  { id: 'pickem', page: "Pick'em Hub", route: '/pickem', example: '/pickem' },
  { id: 'tournaments', page: 'Tournaments', route: '/tournaments', example: '/tournaments' },
  {
    id: 'tournament-home',
    page: 'Tournament Home',
    route: '/tournaments/:tournamentId',
    example: '/tournaments/t20wc-2026',
  },
  {
    id: 'tournament-contests',
    page: 'Tournament Contests',
    route: '/tournaments/:tournamentId/contests',
    example: '/tournaments/t20wc-2026/contests',
  },
  {
    id: 'contest-detail',
    page: 'Contest Detail',
    route: '/tournaments/:tournamentId/contests/:contestId',
    example: '/tournaments/t20wc-2026/contests/huntercherry',
  },
  {
    id: 'contest-leaderboard',
    page: 'Contest Leaderboard',
    route: '/tournaments/:tournamentId/contests/:contestId/leaderboard',
    example: '/tournaments/t20wc-2026/contests/huntercherry/leaderboard',
  },
  {
    id: 'tournament-leaderboard',
    page: 'Tournament Leaderboard',
    route: '/tournaments/:tournamentId/leaderboard',
    example: '/tournaments/t20wc-2026/leaderboard',
  },
  {
    id: 'tournament-stats',
    page: 'Tournament Cricketer Stats',
    route: '/tournaments/:tournamentId/cricketer-stats',
    example: '/tournaments/t20wc-2026/cricketer-stats',
  },
  { id: 'stats', page: 'Cricketer Stats', route: '/cricketer-stats', example: '/cricketer-stats' },
  { id: 'my-team', page: 'My Team', route: '/my-team', example: '/my-team' },
  { id: 'profile', page: 'Profile', route: '/profile', example: '/profile' },
  {
    id: 'change-password',
    page: 'Change Password',
    route: '/change-password',
    example: '/change-password',
  },
  { id: 'admin-dashboard', page: 'Admin Dashboard', route: '/admin/dashboard', example: '/admin/dashboard' },
  { id: 'leaderboard', page: 'Leaderboard', route: '/leaderboard', example: '/leaderboard' },
  { id: 'admin-rules', page: 'Admin Scoring Rules', route: '/admin/scoring', example: '/admin/scoring' },
  { id: 'admin-upload', page: 'Admin Score Upload', route: '/admin/score-upload', example: '/admin/score-upload' },
]

const columns = [
  { key: 'page', label: 'Page' },
  { key: 'route', label: 'Route', render: (row) => <code>{row.route}</code> },
  {
    key: 'example',
    label: 'Example Route',
    render: (row) => (
      <Link className="leaderboard-link" to={row.example}>
        {row.example}
      </Link>
    ),
  },
]

function AllPages() {
  return (
    <section className="admin catalog-shell">
      <div className="admin-header catalog-head">
        <div>
          <h2>All pages</h2>
        </div>
        <div className="top-actions">
          <Link to="/all-apis" className="ghost small">
            All APIs
          </Link>
        </div>
      </div>

      <article className="admin-card catalog-card">
        <FilterableTable
          columns={columns}
          rows={pageRows}
          searchPlaceholder="Search routes (e.g. home, tournament, admin)"
          emptyText="No matching routes"
        />
      </article>
    </section>
  )
}

export default AllPages
