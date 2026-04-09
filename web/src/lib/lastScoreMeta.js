const formatLastScoreMeta = ({
  lastScoreUpdatedAt = '',
  lastScoreUpdatedBy = '',
  compact = false,
} = {}) => {
  if (!lastScoreUpdatedAt) return compact ? 'Last score update: -' : 'Updated -'
  const parsed = new Date(lastScoreUpdatedAt)
  if (Number.isNaN(parsed.getTime())) return compact ? 'Last score update: -' : 'Updated -'

  if (compact) {
    return `Last score update: ${parsed.toLocaleString()}${
      lastScoreUpdatedBy ? ` by ${lastScoreUpdatedBy}` : ''
    }`
  }

  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  const hh = String(parsed.getHours()).padStart(2, '0')
  const min = String(parsed.getMinutes()).padStart(2, '0')
  return `Updated ${mm}/${dd}:${hh}:${min}${
    lastScoreUpdatedBy ? ` by ${lastScoreUpdatedBy}` : ''
  }`
}

export { formatLastScoreMeta }
