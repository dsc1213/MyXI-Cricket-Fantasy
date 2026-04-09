import { formatLastScoreMeta } from '../../lib/lastScoreMeta.js'

function LastScoreMeta({
  lastScoreUpdatedAt = '',
  lastScoreUpdatedBy = '',
  compact = false,
  className = 'team-note',
}) {
  return (
    <p className={className}>
      {formatLastScoreMeta({ lastScoreUpdatedAt, lastScoreUpdatedBy, compact })}
    </p>
  )
}
export default LastScoreMeta
