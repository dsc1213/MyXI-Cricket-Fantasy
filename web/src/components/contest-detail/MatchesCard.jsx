import Button from '../ui/Button.jsx'
import { MatchLabel } from '../ui/CountryFlag.jsx'
import { getCountryFlag } from '../ui/countryFlagUtils.js'
import LoadingNote from '../ui/LoadingNote.jsx'
import SelectField from '../ui/SelectField.jsx'
import StickyTable from '../ui/StickyTable.jsx'
import ParticipantsCard from './ParticipantsCard.jsx'
import { formatMatchStatus, normalizeMatchStatus } from '../../lib/matchStatus.js'

const monthShort = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function EditActionIcon() {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.08H5v-.92l9.06-9.06.92.92L5.92 19.33ZM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83Z"
      />
    </svg>
  )
}

function ViewActionIcon() {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 5c-5.5 0-9.59 3.44-11 7 1.41 3.56 5.5 7 11 7s9.59-3.44 11-7c-1.41-3.56-5.5-7-11-7Zm0 12c-3.54 0-6.53-2.07-7.94-5 1.41-2.93 4.4-5 7.94-5s6.53 2.07 7.94 5c-1.41 2.93-4.4 5-7.94 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  )
}

function AddActionIcon() {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M19 11H13V5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v6a1 1 0 1 0 2 0v-6h6a1 1 0 1 0 0-2Z"
      />
    </svg>
  )
}

function CopyActionIcon() {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M8 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V7Zm2 1h3a3 3 0 0 1 3 3v3h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v1Zm-3 2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H7Z"
      />
    </svg>
  )
}

function ExpandActionIcon({ expanded = false }) {
  return (
    <svg
      className={`match-expand-icon ${expanded ? 'expanded' : ''}`.trim()}
      viewBox="0 0 20 20"
      role="presentation"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M6.2 7.3a1 1 0 0 1 1.4 0L10 9.7l2.4-2.4a1 1 0 1 1 1.4 1.4l-3.1 3.1a1 1 0 0 1-1.4 0L6.2 8.7a1 1 0 0 1 0-1.4Z"
      />
    </svg>
  )
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

function formatMatchDateTime(match) {
  const shortDate = formatShortDate(match?.date || '')
  const rawStart = (match?.startAt || '').toString().trim()
  if (!rawStart) {
    return { dateText: shortDate, timeText: '' }
  }
  const parsed = new Date(rawStart)
  if (Number.isNaN(parsed.getTime())) {
    return { dateText: shortDate, timeText: '' }
  }
  const formattedDate = `${String(parsed.getDate()).padStart(2, '0')} ${monthShort[parsed.getMonth()]}`
  const formattedTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
  return { dateText: formattedDate, timeText: formattedTime }
}

function MatchesCard({
  contestMode = '',
  matches,
  isLoadingMatches = false,
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
  onCopyTeam,
  isLoggedIn = false,
  participants = [],
  joinedParticipantsCount = 0,
  isLoadingParticipants = false,
  onPreviewPlayer,
  onComparePlayer,
  canEditFullTeams = false,
  canSeeMissingTeams = false,
  viewerUserId = '',
}) {
  const isFixedRosterContest = contestMode === 'fixed_roster'
  const columns = [
    {
      key: 'match',
      label: 'Match',
      render: (match) => (
        <button
          type="button"
          className="match-name-btn"
          onClick={(event) => {
            event.stopPropagation()
            onSelectMatch(match.id)
          }}
        >
          <span className="match-name-copy">
            <strong>
              <MatchLabel home={match.home} away={match.away} />
            </strong>
            <span>{`Match ${match.matchNo}`}</span>
          </span>
        </button>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (match) => {
        const { dateText, timeText } = formatMatchDateTime(match)
        return (
          <span className="match-date-cell">
            <span className="match-date-main">{dateText || '-'}</span>
            {timeText ? <span className="match-date-time">{timeText}</span> : null}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (match) => formatMatchStatus(match.status),
    },
    {
      key: 'action',
      label: 'Action',
      render: (match) => {
        const normalizedStatus = normalizeMatchStatus(match.status)
        if (isFixedRosterContest) {
          const loginRequired = !isLoggedIn
          return (
            <div className="top-actions">
              <Button
                variant="ghost"
                size="small"
                className="icon-eye-btn match-action-icon-btn"
                disabled={!match.hasTeam || loginRequired}
                aria-label="View roster"
                title={
                  loginRequired
                    ? 'Login required to view roster'
                    : match.hasTeam
                      ? 'View roster'
                      : 'No owned players in this match'
                }
                onClick={(event) => {
                  event.stopPropagation()
                  onPreviewTeam?.(match)
                }}
              >
                <ViewActionIcon />
                <span>{` (${Number(match.submittedCount || 0)})`}</span>
              </Button>
            </div>
          )
        }
        const canEdit =
          typeof match.teamEditingLocked === 'boolean'
            ? !match.teamEditingLocked
            : normalizedStatus === 'notstarted' || normalizedStatus === 'started'
        const canManageOwnTeam = Boolean(match.viewerJoined)
        const canCopyTeam = Boolean(onCopyTeam)
        const canView =
          normalizedStatus === 'notstarted' ||
          normalizedStatus === 'started' ||
          normalizedStatus === 'inprogress' ||
          normalizedStatus === 'completed'
        const loginRequired = !isLoggedIn
        if (match.hasTeam) {
          const ActionIcon = canEdit ? EditActionIcon : ViewActionIcon
          const label = canEdit ? 'Edit team' : 'View team'
          const disabled = loginRequired || (!canEdit && !canView)
          return (
            <div className="top-actions">
              <Button
                variant="ghost"
                size="small"
                className={`match-action-icon-btn ${canEdit ? 'icon-edit-btn' : 'icon-eye-btn'}`}
                disabled={disabled}
                to={
                  canEdit && !disabled
                    ? `/fantasy/select?contest=${contestId}&match=${match.id}&mode=edit`
                    : undefined
                }
                aria-label={loginRequired ? 'Login required' : label}
                title={loginRequired ? 'Login required' : label}
                onClick={
                  canEdit
                    ? (event) => event.stopPropagation()
                    : (event) => {
                        event.stopPropagation()
                        onPreviewTeam?.(match)
                      }
                }
              >
                <ActionIcon />
                <span>{` (${Number(match.submittedCount || 0)})`}</span>
              </Button>
            </div>
          )
        }
        return (
          <div className="top-actions">
            {canEdit ? (
              <>
                {canManageOwnTeam &&
                  (loginRequired ? (
                    <Button
                      variant="ghost"
                      size="small"
                      className="icon-edit-btn match-action-icon-btn join-action-btn"
                      disabled
                      aria-label="Login required"
                      title="Login required to add team"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <AddActionIcon />
                      <span className="join-action-label">Join</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="small"
                        className="icon-edit-btn match-action-icon-btn join-action-btn"
                        to={`/fantasy/select?contest=${contestId}&match=${match.id}&mode=add`}
                        aria-label="Add team"
                        title="Add team"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <AddActionIcon />
                        <span className="join-action-label">Join</span>
                      </Button>
                      {canCopyTeam ? (
                        <Button
                          variant="ghost"
                          size="small"
                          className="icon-copy-btn match-action-icon-btn"
                          aria-label="Copy team"
                          title="Copy team from another contest"
                          onClick={(event) => {
                            event.stopPropagation()
                            onCopyTeam?.(match)
                          }}
                        >
                          <CopyActionIcon />
                        </Button>
                      ) : null}
                    </>
                  ))}
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
    {
      key: 'expand',
      label: '',
      sortable: false,
      cellClassName: 'match-expand-cell',
      render: (match) => (
        <button
          type="button"
          className="match-expand-btn"
          aria-label={
            String(selectedMatchId) === String(match.id)
              ? 'Hide participants'
              : 'Show participants'
          }
          onClick={(event) => {
            event.stopPropagation()
            onSelectMatch(match.id)
          }}
        >
          <ExpandActionIcon expanded={String(selectedMatchId) === String(match.id)} />
        </button>
      ),
    },
  ]
  const loadingEmptyState = <LoadingNote loading loadingText="Loading matches..." />

  return (
    <article className="admin-card matches-card">
      <div className="contest-card-top">
        <h3>Matches</h3>
        <div className="match-filters-scroll">
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
      </div>

      <StickyTable
        columns={columns}
        rows={matches}
        rowKey={(row) => row.id}
        rowClassName={(row) =>
          String(selectedMatchId) === String(row.id) ? 'active' : ''
        }
        onRowClick={(row) => onSelectMatch(row.id)}
        isRowExpanded={(row) => String(selectedMatchId) === String(row.id)}
        expandedRowClassName="match-participants-expanded-row"
        renderExpandedRow={(row) => (
          <ParticipantsCard
            contestMode={contestMode}
            contestId={contestId}
            activeMatch={row}
            participants={participants}
            isLoading={isLoadingParticipants}
            joinedCount={joinedParticipantsCount}
            onPreviewPlayer={onPreviewPlayer}
            onComparePlayer={onComparePlayer}
            canEditFullTeams={canEditFullTeams}
            canSeeMissingTeams={canSeeMissingTeams}
            isLoggedIn={isLoggedIn}
            viewerUserId={viewerUserId}
            viewerJoined={Boolean(row?.viewerJoined)}
            inline
          />
        )}
        emptyText={isLoadingMatches ? loadingEmptyState : 'No matches found'}
        wrapperClassName="match-table-wrap"
        tableClassName="match-table"
      />
    </article>
  )
}

export default MatchesCard
