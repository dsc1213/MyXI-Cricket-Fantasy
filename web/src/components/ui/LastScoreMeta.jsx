import { formatLastUpdatedAt, formatLastUpdatedBy } from '../../lib/lastScoreMeta.js'

function LastScoreMeta({
  lastScoreUpdatedAt = '',
  lastScoreUpdatedBy = '',
  lastUpdatedContext = '',
  compact = false,
  className = 'team-note',
}) {
  return (
    <div className={`${className} last-score-meta`.trim()}>
      <span>
        {compact ? 'Last Updated at:' : 'Last Updated at:'}{' '}
        {formatLastUpdatedAt(lastScoreUpdatedAt)}
      </span>
      <span>
        Last Updated by:{' '}
        {formatLastUpdatedBy({ lastUpdatedBy: lastScoreUpdatedBy, lastUpdatedContext })}
      </span>
    </div>
  )
}
export default LastScoreMeta
