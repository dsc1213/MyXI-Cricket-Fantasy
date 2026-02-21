import Button from '../ui/Button.jsx'
import { MatchLabel } from '../ui/CountryFlag.jsx'
import { getCountryFlag } from '../ui/countryFlagUtils.js'
import SelectField from '../ui/SelectField.jsx'
import StickyTable from '../ui/StickyTable.jsx'

const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function EditActionIcon() {
  return (
    <svg className="action-icon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.08H5v-.92l9.06-9.06.92.92L5.92 19.33ZM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83Z"
      />
    </svg>
  )
}

function ViewActionIcon() {
  return (
    <svg className="action-icon" viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c-5.5 0-9.59 3.44-11 7 1.41 3.56 5.5 7 11 7s9.59-3.44 11-7c-1.41-3.56-5.5-7-11-7Zm0 12c-3.54 0-6.53-2.07-7.94-5 1.41-2.93 4.4-5 7.94-5s6.53 2.07 7.94 5c-1.41 2.93-4.4 5-7.94 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  )
}

function normalizeMatchStatus(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function formatMatchStatus(value) {
  const normalized = normalizeMatchStatus(value)
  if (normalized === 'completed') return 'Completed'
  if (normalized === 'inprogress') return 'inprogress'
  if (normalized === 'notstarted') return 'notstarted'
  return value || '-'
}

function formatShortDate(value) {
  if (typeof value !== 'string') return value
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!isoMatch) return value
  const monthIndex = Number(isoMatch[2]) - 1
  const day = Number(isoMatch[3])
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return value
  return `${String(day).padStart(2, '0')} ${monthShort[monthIndex]}`
}

function MatchesCard({
  matches,
  selectedMatchId,
  onSelectMatch,
  matchFilter,
  onChangeMatchFilter,
  teamFilter,
  onChangeTeamFilter,
  teamOptions,
  contestId,
  onPreviewLeaderboard,
  onPreviewTeam,
  isLoggedIn = false,
}) {
  const columns = [
    {
      key: 'match',
      label: 'Match',
      render: (match) => (
        <button
          type="button"
          className="match-name-btn"
          onClick={() => onSelectMatch(match.id)}
        >
          <strong>
            <MatchLabel home={match.home} away={match.away} />
          </strong>
          <span>{`Match ${match.matchNo}`}</span>
        </button>
      ),
    },
    { key: 'date', label: 'Date', render: (match) => formatShortDate(match.date) },
    {
      key: 'status',
      label: 'Status',
      render: (match) => formatMatchStatus(match.status),
    },
    {
      key: 'myTeam',
      label: 'My Team',
      render: (match) => (match.hasTeam ? 'Added' : 'Not added'),
    },
    {
      key: 'action',
      label: 'Action',
      render: (match) => {
        const normalizedStatus = normalizeMatchStatus(match.status)
        const canEdit = normalizedStatus === 'notstarted'
        const canManageOwnTeam = Boolean(match.viewerJoined)
        const canView =
          normalizedStatus === 'notstarted' ||
          normalizedStatus === 'inprogress' ||
          normalizedStatus === 'completed'
        const loginRequired = !isLoggedIn
        return (
          <div className="top-actions">
            {canEdit ? (
              <>
                {canManageOwnTeam &&
                  (loginRequired ? (
                    <Button
                      variant="ghost"
                      size="small"
                      className="icon-edit-btn match-action-icon-btn"
                      disabled
                      aria-label="Login required"
                      title="Login required to edit team"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <EditActionIcon />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="small"
                      className="icon-edit-btn match-action-icon-btn"
                      to={`/fantasy/select?contest=${contestId}&match=${match.id}&mode=${match.hasTeam ? 'edit' : 'add'}`}
                      aria-label={match.hasTeam ? 'Edit team' : 'Add team'}
                      title={match.hasTeam ? 'Edit team' : 'Add team'}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <EditActionIcon />
                    </Button>
                  ))}
                <Button
                  variant="ghost"
                  size="small"
                  className="icon-eye-btn match-action-icon-btn"
                  disabled={!match.hasTeam || loginRequired}
                  aria-label="View team"
                  title={
                    loginRequired
                      ? 'Login required to view team'
                      : match.hasTeam
                        ? 'View team'
                        : 'No team added'
                  }
                  onClick={(event) => {
                    event.stopPropagation()
                    onPreviewTeam?.(match)
                  }}
                >
                  <ViewActionIcon />
                  <span>{` (${Number(match.submittedCount || 0)})`}</span>
                </Button>
              </>
            ) : canView ? (
              <Button
                variant="ghost"
                size="small"
                className="icon-eye-btn match-action-icon-btn"
                disabled={!match.hasTeam || loginRequired}
                aria-label="View team"
                title={
                  loginRequired
                    ? 'Login required to view team'
                    : match.hasTeam
                      ? 'View team'
                      : 'No team added'
                }
                onClick={(event) => {
                  event.stopPropagation()
                  onPreviewTeam?.(match)
                }}
              >
                <ViewActionIcon />
                <span>{` (${Number(match.submittedCount || 0)})`}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="small"
                className="icon-edit-btn"
                disabled
                aria-label="Action unavailable"
                title="No actions available for this match status"
                onClick={(event) => event.stopPropagation()}
              >
                <EditActionIcon />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <article className="admin-card matches-card">
      <div className="contest-card-top">
        <h3>Matches</h3>
        <div className="module-filters compact three">
          <SelectField
            value={matchFilter}
            onChange={(event) => onChangeMatchFilter(event.target.value)}
            options={[
              { value: 'all', label: `All (${matches.length})` },
              { value: 'completed', label: 'Completed' },
              { value: 'inprogress', label: 'inprogress' },
              { value: 'notstarted', label: 'notstarted' },
            ]}
          />
          <SelectField
            value={teamFilter}
            onChange={(event) => onChangeTeamFilter(event.target.value)}
            options={[
              { value: 'all', label: 'All teams' },
              ...teamOptions.map((team) => {
                const flag = getCountryFlag(team)
                return { value: team, label: flag ? `${team} ${flag}` : team }
              }),
            ]}
          />
          <Button
            variant="secondary"
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onPreviewLeaderboard?.()
            }}
          >
            Preview leaderboard
          </Button>
        </div>
      </div>

      <StickyTable
        columns={columns}
        rows={matches}
        rowKey={(row) => row.id}
        rowClassName={(row) => (selectedMatchId === row.id ? 'active' : '')}
        onRowClick={(row) => onSelectMatch(row.id)}
        emptyText="No matches found"
        wrapperClassName="match-table-wrap"
        tableClassName="match-table"
      />
    </article>
  )
}

export default MatchesCard
