const formatLastUpdatedAt = (value = '') => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const formatLastUpdatedBy = ({
  lastUpdatedBy = '',
  lastUpdatedContext = '',
} = {}) => {
  if (!lastUpdatedBy) return '-'
  return lastUpdatedContext
    ? `${lastUpdatedBy} (${lastUpdatedContext})`
    : lastUpdatedBy
}

export { formatLastUpdatedAt, formatLastUpdatedBy }
