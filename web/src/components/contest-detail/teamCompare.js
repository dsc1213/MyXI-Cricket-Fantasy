const getComparePlayerKey = (player = {}) =>
  (
    player?.id ||
    player?.playerId ||
    player?.sourcePlayerId ||
    player?.name ||
    player?.playerName ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase()

const getComparePlayerName = (player = {}, fallback = 'Player') =>
  (player?.name || player?.playerName || player?.displayName || fallback).toString()

const normalizeRoleTag = (roleTag = '') => {
  const normalized = roleTag.toString().trim().toUpperCase()
  if (normalized === 'V') return 'VC'
  return normalized
}

export const normalizeCompareTeam = (selection = {}) => {
  const players = Array.isArray(selection?.picksDetailed)
    ? selection.picksDetailed
    : Array.isArray(selection?.picks)
      ? selection.picks
      : []
  const captainId = selection?.captainId || selection?.captain_id || ''
  const viceCaptainId = selection?.viceCaptainId || selection?.vice_captain_id || ''
  return players
    .map((player, index) => {
      if (typeof player === 'string') {
        return {
          key: player.toString().trim().toLowerCase(),
          name: player,
          team: '',
          role: '',
          roleTag: '',
          points: 0,
          order: index,
        }
      }
      const key = getComparePlayerKey(player)
      const playerId = (player?.id || player?.playerId || '').toString()
      const roleTag = normalizeRoleTag(
        player?.roleTag ||
          (captainId && String(captainId) === playerId
            ? 'C'
            : viceCaptainId && String(viceCaptainId) === playerId
              ? 'VC'
              : ''),
      )
      return {
        ...player,
        key,
        name: getComparePlayerName(player, `Player ${index + 1}`),
        team: (player?.team || player?.teamCode || '').toString().toUpperCase(),
        role: (player?.role || '').toString().toUpperCase(),
        roleTag,
        points: Number(player?.points || player?.fantasyPoints || 0),
        order: index,
      }
    })
    .filter((player) => player.key)
}

export const buildTeamComparison = (mine = [], theirs = []) => {
  const myMap = new Map(mine.map((player) => [player.key, player]))
  const theirMap = new Map(theirs.map((player) => [player.key, player]))
  const common = []
  const roleDiffMine = []
  const roleDiffTheirs = []

  mine.forEach((player) => {
    const opponentPlayer = theirMap.get(player.key)
    if (!opponentPlayer) return
    if ((player.roleTag || '') === (opponentPlayer.roleTag || '')) {
      common.push({ mine: player, theirs: opponentPlayer })
      return
    }
    roleDiffMine.push(player)
    roleDiffTheirs.push(opponentPlayer)
  })

  const onlyMine = [
    ...mine.filter((player) => !theirMap.has(player.key)),
    ...roleDiffMine,
  ]
  const onlyTheirs = [
    ...theirs.filter((player) => !myMap.has(player.key)),
    ...roleDiffTheirs,
  ]
  return { common, onlyMine, onlyTheirs }
}
