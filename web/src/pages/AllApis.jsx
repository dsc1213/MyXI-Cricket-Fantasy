import { Link } from 'react-router-dom'
import FilterableTable from '../components/ui/FilterableTable.jsx'

const apiRows = [
  {
    id: 'auth-login',
    method: 'POST',
    path: '/auth/login',
    purpose: 'User login',
    group: 'Auth',
    example: '/auth/login',
  },
  {
    id: 'auth-register',
    method: 'POST',
    path: '/auth/register',
    purpose: 'Register user',
    group: 'Auth',
    example: '/auth/register',
  },
  {
    id: 'auth-approve',
    method: 'POST',
    path: '/auth/approve-user',
    purpose: 'Approve pending user (master)',
    group: 'Auth',
    example: '/auth/approve-user',
  },
  {
    id: 'dashboard-page-load',
    method: 'GET',
    path: '/mock/page-load-data',
    purpose: 'Dashboard bootstrap payload',
    group: 'Dashboard',
    example: '/mock/page-load-data',
  },
  {
    id: 'mock-tournaments',
    method: 'GET',
    path: '/mock/tournaments',
    purpose: 'Tournament list',
    group: 'Tournament',
    example: '/mock/tournaments',
  },
  {
    id: 'mock-contests',
    method: 'GET',
    path: '/mock/contests',
    purpose: 'Contest list with filters',
    group: 'Tournament',
    example: '/mock/contests?game=Fantasy&tournamentId=t20wc-2026',
  },
  {
    id: 'mock-contest',
    method: 'GET',
    path: '/mock/contests/:contestId',
    purpose: 'Contest details',
    group: 'Contest',
    example: '/mock/contests/huntercherry',
  },
  {
    id: 'mock-matches',
    method: 'GET',
    path: '/mock/contests/:contestId/matches',
    purpose: 'Contest matches',
    group: 'Contest',
    example: '/mock/contests/huntercherry/matches?status=completed',
  },
  {
    id: 'mock-participants',
    method: 'GET',
    path: '/mock/contests/:contestId/participants',
    purpose: 'Participant list by match',
    group: 'Contest',
    example: '/mock/contests/huntercherry/participants?matchId=m1',
  },
  {
    id: 'mock-leaderboard',
    method: 'GET',
    path: '/mock/contests/:contestId/leaderboard',
    purpose: 'Contest leaderboard',
    group: 'Contest',
    example: '/mock/contests/huntercherry/leaderboard',
  },
  {
    id: 'mock-user-match-scores',
    method: 'GET',
    path: '/mock/contests/:contestId/users/:userId/match-scores',
    purpose: 'User match-by-match score breakdown + compare',
    group: 'Contest',
    example: '/mock/contests/huntercherry/users/rahul-xi/match-scores?compareUserId=kiran-11',
  },
  {
    id: 'mock-user-picks',
    method: 'GET',
    path: '/mock/users/:userId/picks',
    purpose: 'User XI picks (+points)',
    group: 'Contest',
    example: '/mock/users/rahul-xi/picks?tournamentId=t20wc-2026&contestId=huntercherry',
  },
  {
    id: 'mock-player-stats',
    method: 'GET',
    path: '/mock/player-stats',
    purpose: 'Cricketer stats by tournament',
    group: 'Stats',
    example: '/mock/player-stats?tournamentId=t20wc-2026',
  },
  {
    id: 'mock-team-pool',
    method: 'GET',
    path: '/mock/team-pool',
    purpose: 'Team selection pool',
    group: 'Team',
    example: '/mock/team-pool?contestId=huntercherry&matchId=m1',
  },
  {
    id: 'mock-score-context',
    method: 'GET',
    path: '/mock/admin/match-score-context',
    purpose: 'Manual score upload context',
    group: 'Scoring',
    example: '/mock/admin/match-score-context?tournamentId=t20wc-2026',
  },
  {
    id: 'mock-admin-users',
    method: 'GET',
    path: '/mock/admin/users',
    purpose: 'Admin manager users list',
    group: 'Admin',
    example: '/mock/admin/users',
  },
  {
    id: 'mock-admin-user-update',
    method: 'PATCH',
    path: '/mock/admin/users/:id',
    purpose: 'Admin update user role/profile',
    group: 'Admin',
    example: '/mock/admin/users/1103',
  },
  {
    id: 'mock-admin-user-delete',
    method: 'DELETE',
    path: '/mock/admin/users/:id',
    purpose: 'Admin delete user',
    group: 'Admin',
    example: '/mock/admin/users/1103',
  },
  {
    id: 'mock-admin-tournament-catalog',
    method: 'GET',
    path: '/mock/admin/tournaments/catalog',
    purpose: 'Admin tournament catalog',
    group: 'Admin',
    example: '/mock/admin/tournaments/catalog',
  },
  {
    id: 'mock-admin-tournament-enable',
    method: 'POST',
    path: '/mock/admin/tournaments/enable',
    purpose: 'Enable tournaments for fantasy',
    group: 'Admin',
    example: '/mock/admin/tournaments/enable',
  },
  {
    id: 'mock-admin-team-squads-list',
    method: 'GET',
    path: '/mock/admin/team-squads',
    purpose: 'Squad manager list (filter by teamCode optional)',
    group: 'Admin',
    example: '/mock/admin/team-squads?teamCode=IND',
  },
  {
    id: 'mock-admin-team-squads-upsert',
    method: 'POST',
    path: '/mock/admin/team-squads',
    purpose: 'Create/update team squad with player active flags',
    group: 'Admin',
    example: '/mock/admin/team-squads',
  },
  {
    id: 'mock-admin-team-squads-delete',
    method: 'DELETE',
    path: '/mock/admin/team-squads/:teamCode',
    purpose: 'Delete squad row by teamCode',
    group: 'Admin',
    example: '/mock/admin/team-squads/CSK',
  },
  {
    id: 'mock-admin-contest-create',
    method: 'POST',
    path: '/mock/admin/contests',
    purpose: 'Create fantasy contest',
    group: 'Admin',
    example: '/mock/admin/contests',
  },
  {
    id: 'mock-admin-contest-catalog',
    method: 'GET',
    path: '/mock/admin/contests/catalog',
    purpose: 'Contest catalog by tournament with enabled state',
    group: 'Admin',
    example: '/mock/admin/contests/catalog?tournamentId=t20wc-2026',
  },
  {
    id: 'mock-admin-contest-sync',
    method: 'POST',
    path: '/mock/admin/contests/sync',
    purpose: 'Enable/disable contests via checkbox save',
    group: 'Admin',
    example: '/mock/admin/contests/sync',
  },
  {
    id: 'mock-admin-contest-delete',
    method: 'DELETE',
    path: '/mock/admin/contests/:contestId',
    purpose: 'Remove fantasy contest',
    group: 'Admin',
    example: '/mock/admin/contests/huntercherry',
  },
  {
    id: 'mock-score-upsert',
    method: 'POST',
    path: '/mock/admin/match-scores/upsert',
    purpose: 'Save manual match score rows',
    group: 'Scoring',
    example: '/mock/admin/match-scores/upsert',
  },
  {
    id: 'mock-excel-process',
    method: 'POST',
    path: '/mock/match-scores/process-excel',
    purpose: 'Process uploaded excel',
    group: 'Scoring',
    example: '/mock/match-scores/process-excel',
  },
  {
    id: 'mock-score-save',
    method: 'POST',
    path: '/mock/match-scores/save',
    purpose: 'Persist parsed score payload',
    group: 'Scoring',
    example: '/mock/match-scores/save',
  },
  {
    id: 'mock-rules-save',
    method: 'POST',
    path: '/mock/scoring-rules/save',
    purpose: 'Save scoring rule matrix',
    group: 'Scoring',
    example: '/mock/scoring-rules/save',
  },
  {
    id: 'mock-override-context',
    method: 'GET',
    path: '/mock/admin/player-overrides/context',
    purpose: 'Override context for admin/master',
    group: 'Admin',
    example: '/mock/admin/player-overrides/context',
  },
  {
    id: 'mock-override-save',
    method: 'POST',
    path: '/mock/admin/player-overrides/save',
    purpose: 'Save manual player replacement',
    group: 'Admin',
    example: '/mock/admin/player-overrides/save',
  },
]

const columns = [
  {
    key: 'method',
    label: 'Method',
    render: (row) => (
      <span className={`method-tag ${row.method.toLowerCase()}`}>{row.method}</span>
    ),
  },
  { key: 'path', label: 'API Route', render: (row) => <code>{row.path}</code> },
  { key: 'example', label: 'Example', render: (row) => <code>{row.example}</code> },
  { key: 'purpose', label: 'Purpose' },
  { key: 'group', label: 'Group' },
]

function AllApis() {
  return (
    <section className="admin catalog-shell">
      <div className="admin-header catalog-head">
        <div>
          <h2>All APIs</h2>
        </div>
        <div className="top-actions">
          <Link to="/all-pages" className="ghost small">
            All pages
          </Link>
        </div>
      </div>

      <article className="admin-card catalog-card">
        <FilterableTable
          columns={columns}
          rows={apiRows}
          searchPlaceholder="Search APIs (e.g. home, contests, score)"
          emptyText="No matching APIs"
        />
      </article>
    </section>
  )
}

export default AllApis
