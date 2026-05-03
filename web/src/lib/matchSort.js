import { normalizeMatchStatus } from './matchStatus.js'

const getMatchStartTime = (match) => {
  const raw = (match?.startAt || match?.startTime || match?.date || '').toString().trim()
  if (!raw) return Number.POSITIVE_INFINITY
  const parsed = new Date(raw)
  const time = parsed.getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

const getLocalDayStart = (timestamp) => {
  const day = new Date(timestamp)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

const getMatchSortBucket = (match, todayStart) => {
  const startTime = getMatchStartTime(match)
  if (!Number.isFinite(startTime)) return 4
  const matchDayStart = getLocalDayStart(startTime)
  const isCompleted = normalizeMatchStatus(match?.status) === 'completed'

  if (isCompleted) return 4
  if (matchDayStart === todayStart && !isCompleted) return 0
  if (matchDayStart > todayStart) return 1
  return 2
}

const getMatchSortTieBreaker = (match) =>
  String(match?.matchNo || match?.id || match?.label || match?.name || '')

const sortMatchesForSelection = (rows = [], now = Date.now()) => {
  const todayStart = getLocalDayStart(now)
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const leftBucket = getMatchSortBucket(left, todayStart)
    const rightBucket = getMatchSortBucket(right, todayStart)
    if (leftBucket !== rightBucket) return leftBucket - rightBucket

    const leftStart = getMatchStartTime(left)
    const rightStart = getMatchStartTime(right)
    const timeDiff = leftStart - rightStart
    if (timeDiff !== 0) return timeDiff

    return getMatchSortTieBreaker(left).localeCompare(getMatchSortTieBreaker(right))
  })
}

export { sortMatchesForSelection }
