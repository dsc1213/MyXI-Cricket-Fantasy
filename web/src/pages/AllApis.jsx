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
    path: '/page-load-data',
    purpose: 'Dashboard bootstrap payload',
    group: 'Dashboard',
    example: '/page-load-data',
  },
  {
    id: 'api-tournaments',
    method: 'GET',
    path: '/tournaments',
    purpose: 'Tournament list',
    group: 'Tournament',
    example: '/tournaments',
  },
  {
    id: 'api-contests',
    method: 'GET',
    path: '/contests',
    purpose: 'Contest list with filters',
    group: 'Tournament',
    example: '/contests?game=Fantasy&tournamentId=t20wc-2026',
  },
  {
    id: 'api-contest',
    method: 'GET',
    path: '/contests/:contestId',
    purpose: 'Contest details',
    group: 'Contest',
    example: '/contests/huntercherry',
  },
  {
    id: 'api-matches',
    method: 'GET',
    path: '/contests/:contestId/matches',
    purpose: 'Contest matches',
    group: 'Contest',
    example: '/contests/huntercherry/matches?status=completed',
  },
  {
    id: 'api-participants',
    method: 'GET',
    path: '/contests/:contestId/participants',
    purpose: 'Participant list by match',
    group: 'Contest',
    example: '/contests/huntercherry/participants?matchId=m1',
  },
  {
    id: 'api-leaderboard',
    method: 'GET',
    path: '/contests/:contestId/leaderboard',
    purpose: 'Contest leaderboard',
    group: 'Contest',
    example: '/contests/huntercherry/leaderboard',
  },
  {
    id: 'api-user-match-scores',
    method: 'GET',
    path: '/contests/:contestId/users/:userId/match-scores',
    purpose: 'User match-by-match score breakdown + compare',
    group: 'Contest',
    example: '/contests/huntercherry/users/rahul-xi/match-scores?compareUserId=kiran-11',
  },
  {
    id: 'api-user-picks',
    method: 'GET',
    path: '/users/:userId/picks',
    purpose: 'User XI picks (+points)',
    group: 'Contest',
    example: '/users/rahul-xi/picks?tournamentId=t20wc-2026&contestId=huntercherry',
  },
  {
    id: 'api-player-stats',
    method: 'GET',
    path: '/player-stats',
    purpose: 'Cricketer stats by tournament',
    group: 'Stats',
    example: '/player-stats?tournamentId=t20wc-2026',
  },
  {
    id: 'api-team-pool',
    method: 'GET',
    path: '/team-pool',
    purpose: 'Team selection pool',
    group: 'Team',
    example: '/team-pool?contestId=huntercherry&matchId=m1',
  },
  {
    id: 'api-score-context',
    method: 'GET',
    path: '/admin/match-score-context',
    purpose: 'Manual score upload context',
    group: 'Scoring',
    example: '/admin/match-score-context?tournamentId=t20wc-2026',
  },
  {
    id: 'api-admin-users',
    method: 'GET',
    path: '/admin/users',
    purpose: 'Admin manager users list',
    group: 'Admin',
    example: '/admin/users',
  },
  {
    id: 'api-admin-user-update',
    method: 'PATCH',
    path: '/admin/users/:id',
    purpose: 'Admin update user role/profile',
    group: 'Admin',
    example: '/admin/users/1103',
  },
  {
    id: 'api-admin-user-delete',
    method: 'DELETE',
    path: '/admin/users/:id',
    purpose: 'Admin delete user',
    group: 'Admin',
    example: '/admin/users/1103',
  },
  {
    id: 'api-admin-tournament-catalog',
    method: 'GET',
    path: '/admin/tournaments/catalog',
    purpose: 'Admin tournament catalog',
    group: 'Admin',
    example: '/admin/tournaments/catalog',
  },
  {
    id: 'api-admin-tournament-enable',
    method: 'POST',
    path: '/admin/tournaments/enable',
    purpose: 'Enable tournaments for fantasy',
    group: 'Admin',
    example: '/admin/tournaments/enable',
  },
  {
    id: 'api-admin-team-squads-list',
    method: 'GET',
    path: '/admin/team-squads',
    purpose: 'Squad manager list (filter by teamCode optional)',
    group: 'Admin',
    example: '/admin/team-squads?teamCode=IND',
  },
  {
    id: 'api-admin-team-squads-upsert',
    method: 'POST',
    path: '/admin/team-squads',
    purpose: 'Create/update team squad with player active flags',
    group: 'Admin',
    example: '/admin/team-squads',
  },
  {
    id: 'api-admin-team-squads-delete',
    method: 'DELETE',
    path: '/admin/team-squads/:teamCode',
    purpose: 'Delete squad row by teamCode',
    group: 'Admin',
    example: '/admin/team-squads/CSK',
  },
  {
    id: 'api-admin-contest-create',
    method: 'POST',
    path: '/admin/contests',
    purpose: 'Create fantasy contest',
    group: 'Admin',
    example: '/admin/contests',
  },
  {
    id: 'api-admin-contest-catalog',
    method: 'GET',
    path: '/admin/contests/catalog',
    purpose: 'Contest catalog by tournament with enabled state',
    group: 'Admin',
    example: '/admin/contests/catalog?tournamentId=t20wc-2026',
  },
  {
    id: 'api-admin-contest-sync',
    method: 'POST',
    path: '/admin/contests/sync',
    purpose: 'Enable/disable contests via checkbox save',
    group: 'Admin',
    example: '/admin/contests/sync',
  },
  {
    id: 'api-admin-contest-delete',
    method: 'DELETE',
    path: '/admin/contests/:contestId',
    purpose: 'Remove fantasy contest',
    group: 'Admin',
    example: '/admin/contests/huntercherry',
  },
  {
    id: 'api-score-upsert',
    method: 'POST',
    path: '/admin/match-scores/upsert',
    purpose: 'Save manual match score rows',
    group: 'Scoring',
    example: '/admin/match-scores/upsert',
  },
  {
    id: 'api-excel-process',
    method: 'POST',
    path: '/match-scores/process-excel',
    purpose: 'Process uploaded excel',
    group: 'Scoring',
    example: '/match-scores/process-excel',
  },
  {
    id: 'api-score-save',
    method: 'POST',
    path: '/match-scores/save',
    purpose: 'Persist parsed score payload',
    group: 'Scoring',
    example: '/match-scores/save',
  },
  {
    id: 'api-rules-save',
    method: 'POST',
    path: '/scoring-rules/save',
    purpose: 'Save scoring rule matrix',
    group: 'Scoring',
    example: '/scoring-rules/save',
  },
  {
    id: 'api-override-context',
    method: 'GET',
    path: '/admin/player-overrides/context',
    purpose: 'Override context for admin/master',
    group: 'Admin',
    example: '/admin/player-overrides/context',
  },
  {
    id: 'api-override-save',
    method: 'POST',
    path: '/admin/player-overrides/save',
    purpose: 'Save manual player replacement',
    group: 'Admin',
    example: '/admin/player-overrides/save',
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
