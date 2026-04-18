const ROLE_DISPLAY_RANK = {
  BAT: 0,
  WK: 1,
  AR: 2,
  BOWL: 3,
}

const normalizeRoleToken = (role = '') => {
  const value = role.toString().trim().toUpperCase()
  if (!value) return ''
  if (value.includes('WICKET') || value === 'WK') return 'WK'
  if (value.includes('BOWL')) return 'BOWL'
  if (value.includes('ALL') || value === 'AR') return 'AR'
  if (value.includes('BAT')) return 'BAT'
  return value
}

export const getPlayerDisplayRoleRank = (role = '') => {
  const normalizedRole = normalizeRoleToken(role)
  return ROLE_DISPLAY_RANK[normalizedRole] ?? 99
}

export const sortPlayersByDisplayRole = (players = []) =>
  [...players].sort((left, right) => {
    const roleDelta =
      getPlayerDisplayRoleRank(left?.role) - getPlayerDisplayRoleRank(right?.role)
    if (roleDelta !== 0) return roleDelta

    const leftName = (left?.name || left?.playerName || '').toString().trim()
    const rightName = (right?.name || right?.playerName || '').toString().trim()
    return leftName.localeCompare(rightName)
  })

export const sortPlayersByLastPlayedThenDisplayRole = (players = []) =>
  [...players].sort((left, right) => {
    const leftPlayed = Boolean(left?.lastMatch?.played)
    const rightPlayed = Boolean(right?.lastMatch?.played)
    if (leftPlayed !== rightPlayed) return leftPlayed ? -1 : 1

    const roleDelta =
      getPlayerDisplayRoleRank(left?.role) - getPlayerDisplayRoleRank(right?.role)
    if (roleDelta !== 0) return roleDelta

    const leftName = (left?.name || left?.playerName || '').toString().trim()
    const rightName = (right?.name || right?.playerName || '').toString().trim()
    return leftName.localeCompare(rightName)
  })
