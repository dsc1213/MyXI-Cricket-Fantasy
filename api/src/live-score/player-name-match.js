const normalizePlayerNameKey = (value = '') =>
  value
    .toString()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const playerDisplayName = (player = {}) =>
  (
    player.displayName ||
    player.name ||
    [player.firstName, player.lastName].filter(Boolean).join(' ')
  )
    .toString()
    .trim()

const tokenizeName = (value = '') => normalizePlayerNameKey(value).split(' ').filter(Boolean)

const levenshteinDistance = (left = '', right = '') => {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

const tokensLikelyMatch = (left = '', right = '') => {
  if (!left || !right) return false
  if (left === right) return true
  const longer = Math.max(left.length, right.length)
  const distance = levenshteinDistance(left, right)
  if (longer >= 10) return distance <= 3
  if (longer >= 6) return distance <= 2
  return distance <= 1
}

const playerNamesLikelyMatch = (incomingName, existingName) => {
  const incomingKey = normalizePlayerNameKey(incomingName)
  const existingKey = normalizePlayerNameKey(existingName)
  if (!incomingKey || !existingKey) return false
  if (incomingKey === existingKey) return true

  const incomingTokens = tokenizeName(incomingName)
  const existingTokens = tokenizeName(existingName)
  if (incomingTokens.length < 2 || existingTokens.length < 2) return false

  const incomingFirst = incomingTokens[0]
  const existingFirst = existingTokens[0]
  const incomingLast = incomingTokens[incomingTokens.length - 1]
  const existingLast = existingTokens[existingTokens.length - 1]

  return (
    tokensLikelyMatch(incomingFirst, existingFirst) &&
    tokensLikelyMatch(incomingLast, existingLast)
  )
}

const resolvePlayerNameFromSquad = (incomingName, players = []) => {
  const incomingKey = normalizePlayerNameKey(incomingName)
  if (!incomingKey) return null

  const exactMatches = players.filter(
    (player) => normalizePlayerNameKey(playerDisplayName(player)) === incomingKey,
  )
  if (exactMatches.length === 1) {
    return {
      player: exactMatches[0],
      name: playerDisplayName(exactMatches[0]),
      reason: 'exact',
    }
  }

  const likelyMatches = players.filter((player) =>
    playerNamesLikelyMatch(incomingName, playerDisplayName(player)),
  )
  if (likelyMatches.length !== 1) return null

  return {
    player: likelyMatches[0],
    name: playerDisplayName(likelyMatches[0]),
    reason: 'fuzzy',
  }
}

const canonicalizeNames = (names = [], players = [], replacements = []) =>
  (Array.isArray(names) ? names : []).map((name) => {
    const resolved = resolvePlayerNameFromSquad(name, players)
    if (resolved && resolved.name !== name) {
      replacements.push({
        from: name,
        to: resolved.name,
        reason: resolved.reason,
      })
      return resolved.name
    }
    return name
  })

const canonicalizeLineupNamesWithSquad = (lineup = {}, players = []) => {
  const replacements = []
  lineup.playingXI = canonicalizeNames(lineup.playingXI, players, replacements)
  lineup.bench = canonicalizeNames(lineup.bench, players, replacements)
  lineup.impactPlayers = canonicalizeNames(
    lineup.impactPlayers,
    players,
    replacements,
  )
  if (Array.isArray(lineup.providerPlayers)) {
    lineup.providerPlayers = lineup.providerPlayers.map((player) => {
      const resolved = resolvePlayerNameFromSquad(player?.name, players)
      if (!resolved || resolved.name === player?.name) return player
      replacements.push({
        from: player.name,
        to: resolved.name,
        reason: resolved.reason,
      })
      return { ...player, name: resolved.name }
    })
  }
  return replacements
}

const canonicalizePlayerStatsWithSquad = (playerStats = [], players = []) =>
  (Array.isArray(playerStats) ? playerStats : []).map((row) => {
    const incomingName = (row?.playerName || row?.name || '').toString().trim()
    const resolved = resolvePlayerNameFromSquad(incomingName, players)
    if (!resolved) return row
    return {
      ...row,
      playerName: resolved.name,
    }
  })

export {
  canonicalizeLineupNamesWithSquad,
  canonicalizePlayerStatsWithSquad,
  normalizePlayerNameKey,
  playerDisplayName,
  resolvePlayerNameFromSquad,
}
