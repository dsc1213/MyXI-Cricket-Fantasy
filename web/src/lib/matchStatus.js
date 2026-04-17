export const normalizeMatchStatus = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

export const formatMatchStatus = (value = '') => {
  const normalized = normalizeMatchStatus(value)
  if (normalized === 'completed') return 'Completed'
  if (normalized === 'inprogress') return 'In Progress'
  if (normalized === 'notstarted') return 'Not Started'
  return value || '-'
}

export const isMatchLiveOrComplete = (value = '') => {
  const normalized = normalizeMatchStatus(value)
  return normalized === 'inprogress' || normalized === 'completed'
}
