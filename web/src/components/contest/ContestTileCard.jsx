import { Link } from 'react-router-dom'
import { getStatusClassName } from '../ui/status.js'
import LastScoreMeta from '../ui/LastScoreMeta.jsx'

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
    ...(extraNotes || []).filter(Boolean).slice(0, 1),
  ].slice(0, 1)
  const showLastScoreMeta = Boolean(showLastScore)
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

      {showLastScoreMeta ? (
        <LastScoreMeta
          className="team-note"
          lastScoreUpdatedAt={contest?.lastUpdatedAt || contest?.lastScoreUpdatedAt}
          lastScoreUpdatedBy={contest?.lastUpdatedBy || contest?.lastScoreUpdatedBy}
          lastUpdatedContext={contest?.lastUpdatedContext || ''}
          compact
        />
      ) : null}
      {supplementalLines.map((line) => (
        <p className="team-note" key={`${contest.id}-${line}`}>
          {line}
        </p>
      ))}

      {showStatsRow ? (
        <div className="contest-card-stats" aria-label="contest-stats-row">
          <span className="contest-card-stat contest-card-stat-points">
            {statsLeftText || ''}
          </span>
          <span className="contest-card-stat contest-card-stat-rank">
            {statsRightText || ''}
          </span>
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
