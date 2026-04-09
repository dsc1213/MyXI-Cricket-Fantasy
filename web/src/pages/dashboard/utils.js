// Utility functions extracted from Dashboard.jsx

export const normalizeManualPlayerKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

export const normalizeLooseKey = (value) =>
  normalizeManualPlayerKey(value).replace(/[^a-z0-9]/g, '')

const normalizeNameTokens = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

const hasCompatibleTrailingTokens = (leftTokens = [], rightTokens = []) => {
  if (!leftTokens.length || !rightTokens.length) return false
  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens
  const longer = leftTokens.length > rightTokens.length ? leftTokens : rightTokens
  const offset = longer.length - shorter.length
  for (let index = shorter.length - 1; index >= 0; index -= 1) {
    if (shorter[index] !== longer[index + offset]) return false
  }
  for (let index = 0; index < offset; index += 1) {
    if (longer[index].length > 1) return false
  }
  return true
}

const buildSortedTokenKey = (tokens = []) => [...tokens].sort().join(' ')

/*
TODO: Review this note later and remove it if fuzzy suggestions remain unnecessary.

We intentionally disabled the previous edit-distance helper because JSON player validation is now
strict. The app should only accept names that match known DB players after normalizing case,
spacing, and punctuation. That makes Playing XI and scorecard imports predictable and avoids
accidental auto-mapping.

If we ever need smarter "did you mean?" suggestions again, restore an edit-distance helper here
and use it only for suggestions, never for accepting a player as a valid match.
*/

export const buildNameSuggestions = (needle, knownNames = []) => {
  const compactNeedle = normalizeLooseKey(needle)
  if (!compactNeedle) return []
  return (knownNames || [])
    .map((name) => ({ name, compact: normalizeLooseKey(name) }))
    .filter(
      (item) =>
        item.compact.includes(compactNeedle) || compactNeedle.includes(item.compact),
    )
    .slice(0, 5)
    .map((item) => item.name)
}

export const resolveKnownPlayerByName = (players = [], inputName = '') => {
  const raw = String(inputName || '').trim()
  if (!raw) return null
  const exactKey = normalizeManualPlayerKey(raw)
  const looseKey = normalizeLooseKey(raw)
  const byExact = new Map(
    (players || []).map((player) => [normalizeManualPlayerKey(player?.name), player]),
  )
  const byLoose = new Map(
    (players || []).map((player) => [normalizeLooseKey(player?.name), player]),
  )
  if (byExact.has(exactKey)) return byExact.get(exactKey)
  if (byLoose.has(looseKey)) return byLoose.get(looseKey)
  const inputTokens = normalizeNameTokens(raw)
  if (!inputTokens.length) return null
  const inputSortedTokenKey = buildSortedTokenKey(inputTokens)
  const reorderedMatch = (players || []).find(
    (player) =>
      buildSortedTokenKey(normalizeNameTokens(player?.name)) === inputSortedTokenKey,
  )
  if (reorderedMatch) return reorderedMatch
  const aliasMatches = (players || []).filter((player) =>
    hasCompatibleTrailingTokens(normalizeNameTokens(player?.name), inputTokens),
  )
  if (aliasMatches.length === 1) return aliasMatches[0]
  return null
}

export const normalizeLineupTeamPayload = (
  teamPayload = {},
  knownPlayers = [],
  teamName = '',
) => {
  const knownNames = (knownPlayers || [])
    .map((player) => String(player?.name || '').trim())
    .filter(Boolean)
  const unmatched = []
  const normalizeList = (list = [], field = '') => {
    const next = []
    ;(Array.isArray(list) ? list : []).forEach((name) => {
      const resolved = resolveKnownPlayerByName(knownPlayers, name)
      if (!resolved?.name) {
        const raw = String(name || '').trim()
        if (raw) {
          unmatched.push({
            team: teamName,
            field,
            input: raw,
            suggestions: buildNameSuggestions(raw, knownNames),
          })
        }
        return
      }
      next.push(resolved.name)
    })
    return next
  }

  const captainResolved = resolveKnownPlayerByName(knownPlayers, teamPayload?.captain)
  const viceCaptainResolved = resolveKnownPlayerByName(
    knownPlayers,
    teamPayload?.viceCaptain,
  )
  if (teamPayload?.captain && !captainResolved?.name) {
    const raw = String(teamPayload.captain || '').trim()
    unmatched.push({
      team: teamName,
      field: 'captain',
      input: raw,
      suggestions: buildNameSuggestions(raw, knownNames),
    })
  }
  if (teamPayload?.viceCaptain && !viceCaptainResolved?.name) {
    const raw = String(teamPayload.viceCaptain || '').trim()
    unmatched.push({
      team: teamName,
      field: 'viceCaptain',
      input: raw,
      suggestions: buildNameSuggestions(raw, knownNames),
    })
  }

  return {
    normalized: {
      ...(teamPayload || {}),
      squad: normalizeList(teamPayload?.squad || [], 'squad'),
      playingXI: normalizeList(teamPayload?.playingXI || [], 'playingXI'),
      bench: normalizeList(teamPayload?.bench || [], 'bench'),
      captain: captainResolved?.name,
      viceCaptain: viceCaptainResolved?.name,
    },
    unmatched,
  }
}
