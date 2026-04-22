import StickyTable from '../ui/StickyTable.jsx'
import { MatchLabel } from '../ui/CountryFlag.jsx'
import Button from '../ui/Button.jsx'
import LoadingNote from '../ui/LoadingNote.jsx'
import { normalizeMatchStatus } from '../../lib/matchStatus.js'
import { getDisplayName } from '../../lib/displayName.js'

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

function CompareActionIcon() {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M8 4h2v13h3l-4 4-4-4h3V4Zm8 16h-2V7h-3l4-4 4 4h-3v13Z"
      />
    </svg>
  )
}

function ParticipantsCard({
  contestMode = '',
  contestId,
  activeMatch,
  participants,
  joinedCount = 0,
  onPreviewPlayer,
  onComparePlayer = () => {},
  canEditFullTeams = false,
  isLoggedIn = false,
  viewerUserId = '',
  viewerJoined = false,
  isLoading = false,
}) {
  const hasNoRows = participants.length === 0
  const isFixedRosterContest = contestMode === 'fixed_roster'
  const normalizedStatus = normalizeMatchStatus(activeMatch?.status)
  const isNotStarted = normalizedStatus === 'notstarted'
  const canViewAllTeams =
    isLoggedIn &&
    (normalizedStatus === 'inprogress' ||
      normalizedStatus === 'completed' ||
      isFixedRosterContest)
  const normalizeIdentity = (value) => (value || '').toString().trim().toLowerCase()
  const viewerIdentity = normalizeIdentity(viewerUserId)
  const isViewerRow = (player) => {
    const playerUserId = normalizeIdentity(player?.userId)
    const playerGameName = normalizeIdentity(player?.gameName)
    return Boolean(
      viewerIdentity &&
      (playerUserId === viewerIdentity || playerGameName === viewerIdentity),
    )
  }
  const canViewPlayerTeam = (player) => {
    if (canViewAllTeams) return true
    if (!viewerJoined) return false
    return isViewerRow(player)
  }
  const showFixedRosterNote = isFixedRosterContest
  const showPrestartNote = Boolean(activeMatch) && isNotStarted && !isFixedRosterContest
  const showNoRowsNote = Number(joinedCount || 0) > 0 && participants.length === 0
  const showLoadingNote = isLoading
  const hasNotes =
    showFixedRosterNote || showPrestartNote || showNoRowsNote || showLoadingNote
  const canViewTeams = participants.some((player) => canViewPlayerTeam(player))
  const canEditTeams = !isFixedRosterContest && (isNotStarted || canEditFullTeams)
  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (player) => (
        <strong className="participant-name">{getDisplayName(player)}</strong>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      cellClassName: 'participant-row-score',
      render: (player) => Number(player.points || 0),
    },
    {
      key: 'team',
      label: 'Actions',
      render: (player) => {
        const targetIdentity = (player?.userId || player?.gameName || '')
          .toString()
          .trim()
        return (
          <div className="top-actions">
            {!isFixedRosterContest && canEditFullTeams && (
              <Button
                variant="ghost"
                size="small"
                className="icon-edit-btn match-action-icon-btn"
                disabled={!canEditTeams || !isLoggedIn || !targetIdentity}
                to={`/fantasy/select?contest=${contestId}&match=${activeMatch?.id || ''}&mode=edit&userId=${encodeURIComponent(targetIdentity)}`}
                aria-label={`Edit ${getDisplayName(player)} team`}
                title={
                  !isLoggedIn
                    ? 'Login required to edit team'
                    : canEditTeams
                      ? `Edit ${getDisplayName(player)} team`
                      : 'Team can only be edited before match starts'
                }
              >
                <EditActionIcon />
              </Button>
            )}
            <Button
              variant="ghost"
              size="small"
              className="icon-eye-btn match-action-icon-btn"
              disabled={!canViewPlayerTeam(player) || !isLoggedIn}
              onClick={() => onPreviewPlayer(player)}
              aria-label={`View ${getDisplayName(player)} team`}
              title={
                !isLoggedIn
                  ? 'Login required to view team'
                  : canViewPlayerTeam(player)
                    ? `View ${getDisplayName(player)} team`
                    : 'Player teams are disabled until this match starts.'
              }
            >
              <ViewActionIcon />
            </Button>
            <Button
              variant="ghost"
              size="small"
              className="icon-compare-btn match-action-icon-btn"
              disabled={
                !canViewPlayerTeam(player) ||
                !isLoggedIn ||
                isViewerRow(player) ||
                !targetIdentity
              }
              onClick={() => onComparePlayer(player)}
              aria-label={`Compare my team with ${getDisplayName(player)}`}
              title={
                !isLoggedIn
                  ? 'Login required to compare teams'
                  : isViewerRow(player)
                    ? 'Cannot compare your team with itself'
                    : canViewPlayerTeam(player)
                      ? `Compare my team with ${getDisplayName(player)}`
                      : 'Player teams are disabled until this match starts.'
              }
            >
              <CompareActionIcon />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <article
      className={`admin-card participants-card ${isFixedRosterContest ? 'fixed-roster' : ''} ${!canViewTeams ? 'prestart' : ''} ${
        hasNoRows ? 'no-rows' : ''
      }`.trim()}
    >
      <h3>{`Participants (${participants.length} / ${Number(joinedCount || 0)} joined)`}</h3>
      <p className="team-note participants-subhead">
        <span>For </span>
        <MatchLabel
          home={activeMatch?.home}
          away={activeMatch?.away}
          value={activeMatch?.name || 'Match'}
        />
      </p>
      {hasNotes && (
        <div className="participants-notes">
          {showFixedRosterNote && (
            <p className="team-note participants-subnote">
              Viewing each participant&apos;s fixed tournament roster filtered to this
              match.
            </p>
          )}
          {showPrestartNote && (
            <p className="team-note participants-subnote">
              {
                'Participant teams will be visible to all users once the match is in progress.'
              }
            </p>
          )}
          {showNoRowsNote && (
            <p className="team-note participants-subnote">
              {isFixedRosterContest
                ? 'No participant has owned players in this match.'
                : 'Joined users have not submitted teams for this match yet.'}
            </p>
          )}
          {showLoadingNote && (
            <LoadingNote loading loadingText="Loading participant teams..." />
          )}
        </div>
      )}
      <StickyTable
        columns={columns}
        rows={participants}
        rowKey={(row) => row.id}
        emptyText="No participants found"
        showEmptyRow={false}
        wrapperClassName="participants-table-wrap"
        tableClassName="participants-table"
      />
    </article>
  )
}

export default ParticipantsCard
