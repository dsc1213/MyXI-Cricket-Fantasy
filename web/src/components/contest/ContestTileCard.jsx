import { Link } from 'react-router-dom'
import { getStatusClassName } from '../ui/status.js'

const formatLastScoreText = (contest = {}) => {
  if (!contest?.lastScoreUpdatedAt) return '-'
  const parsed = new Date(contest.lastScoreUpdatedAt)
  if (Number.isNaN(parsed.getTime())) return '-'
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  const hh = String(parsed.getHours()).padStart(2, '0')
  const min = String(parsed.getMinutes()).padStart(2, '0')
  const stamp = `${mm}/${dd}:${hh}:${min}`
  const updatedBy = contest?.lastScoreUpdatedBy ? ` by ${contest.lastScoreUpdatedBy}` : ''
  return `${stamp}${updatedBy}`
}

function ContestTileCard({
  contest,
  tournamentName = '-',
  tournamentColor = '',
  className = '',
  participantsText = '',
  startText = '',
  countdownText = '',
  extraNotes = [],
  statsLeftText = '',
  statsRightText = '',
  showLastScore = true,
  primaryAction = null,
  openTo,
  openLabel = 'Open contest',
  leaderboardTo = '',
  leaderboardLabel = 'Leaderboard',
}) {
  const statusClass = getStatusClassName(contest?.status)
  const cardStyle = tournamentColor
    ? { '--contest-tournament-color': tournamentColor }
    : undefined
  const detailLines = [participantsText, startText, countdownText]
    .filter(Boolean)
    .slice(0, 2)
  const supplementalLines = [
    ...(showLastScore ? [`Updated ${formatLastScoreText(contest)}`] : []),
    ...(extraNotes || []).filter(Boolean).slice(0, 1),
  ].slice(0, 1)
  const showStatsRow = Boolean(statsLeftText || statsRightText)

  return (
    <article
      className={`compact-contest-card ${className} ${statusClass}`.trim()}
      style={cardStyle}
      key={contest.id}
    >
      <div className="contest-card-top contest-meta-row">
        <small className="contest-tournament-pill">{tournamentName}</small>
        <span className={`contest-status-text ${statusClass}`.trim()}>
          {contest.status}
        </span>
      </div>
      <strong className="contest-name-row">{contest.name}</strong>

      {detailLines.map((line) => (
        <p
          className={`team-note ${line === countdownText ? 'contest-countdown' : ''}`.trim()}
          key={`${contest.id}-${line}`}
        >
          {line}
        </p>
      ))}

      {supplementalLines.map((line) => (
        <p className="team-note" key={`${contest.id}-${line}`}>
          {line}
        </p>
      ))}

      {showStatsRow ? (
        <div className="contest-card-stats" aria-label="contest-stats-row">
          <span>{statsLeftText || ''}</span>
          <span>{statsRightText || ''}</span>
        </div>
      ) : null}

      <div className="contest-card-bottom">
        {primaryAction}
        <Link className="ghost small" to={openTo}>
          {openLabel}
        </Link>
        {leaderboardTo ? (
          <Link className="contest-leaderboard-link" to={leaderboardTo}>
            {leaderboardLabel}
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export default ContestTileCard
