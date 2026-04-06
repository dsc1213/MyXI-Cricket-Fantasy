export const roleCounts = (players) =>
  players.reduce(
    (acc, player) => {
      if (!player) return acc
      acc[player.role] = (acc[player.role] || 0) + 1
      return acc
    },
    { WK: 0, BAT: 0, BOWL: 0, AR: 0 },
  )
