// buildManualStatsState extracted from Dashboard.jsx
import { buildDefaultManualStatsRow } from './stateBuilders.js'
import { normalizeManualPlayerKey } from './utils.js'

export function buildManualStatsState(players = [], savedRows = []) {
  const next = {}
  const playerIdsByName = new Map(
    (players || []).map((player) => [normalizeManualPlayerKey(player.name), player.id]),
  )

  ;(players || []).forEach((player) => {
    next[player.id] = buildDefaultManualStatsRow()
  })
  ;(savedRows || []).forEach((row) => {
    const targetId =
      (row?.playerId != null && next[row.playerId] ? row.playerId : null) ||
      playerIdsByName.get(normalizeManualPlayerKey(row?.playerName))
    if (!targetId) return
    const normalizedOvers =
      row?.overs != null && row?.overs !== '' ? row.overs : row?.oversBowled
    next[targetId] = {
      ...buildDefaultManualStatsRow(),
      ...next[targetId],
      ...row,
      overs: Number(normalizedOvers || 0),
      dismissed: Boolean(row?.dismissed),
    }
  })

  return next
}
