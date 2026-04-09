import { getCountryFlag } from '../components/ui/countryFlagUtils.js'

export const formatCompactMatchLabel = (item = {}) => {
  const rawLabel = String(item?.label || item?.name || '').trim()
  const normalized = rawLabel.includes(':')
    ? rawLabel.split(':').slice(1).join(':').trim()
    : rawLabel
  const split = normalized.split(/\s+vs\s+/i)
  const shortDate = (() => {
    const rawDate = item?.startAt || item?.startTime || item?.date || ''
    if (!rawDate) return ''
    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  })()
  const matchNumber = item?.matchNo ? `M${item.matchNo}` : ''

  if (split.length !== 2) {
    return [matchNumber, shortDate, rawLabel].filter(Boolean).join(' • ')
  }

  const left = split[0].trim()
  const right = split[1].trim()
  const leftFlag = getCountryFlag(left)
  const rightFlag = getCountryFlag(right)
  const matchup = `${left}${leftFlag ? ` ${leftFlag}` : ''} vs ${right}${rightFlag ? ` ${rightFlag}` : ''}`
  return [matchNumber, shortDate, matchup].filter(Boolean).join(' • ')
}
