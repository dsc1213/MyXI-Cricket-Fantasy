const findRuleRowValue = (rows, id, fallback = 0) => {
  if (!Array.isArray(rows)) return fallback
  const row = rows.find((item) => item?.id === id)
  return typeof row?.value === 'number' ? row.value : fallback
}

const getRuleSetForTournament = ({ tournamentId, scoringRules, dashboardRuleTemplate }) => {
  const fromStore = scoringRules.find((item) => item.tournamentId === tournamentId)?.rules
  const rules = fromStore || dashboardRuleTemplate || {}

  if (rules && typeof rules === 'object' && 'batting' in rules) {
    return {
      run: findRuleRowValue(rules.batting, 'run', 1),
      four: findRuleRowValue(rules.batting, 'four', 1),
      six: findRuleRowValue(rules.batting, 'six', 2),
      thirty: findRuleRowValue(rules.batting, 'thirty', 0),
      fifty: findRuleRowValue(rules.batting, 'fifty', 0),
      century: findRuleRowValue(rules.batting, 'century', 0),
      duck: findRuleRowValue(rules.batting, 'duck', 0),
      wicket: findRuleRowValue(rules.bowling, 'wicket', 20),
      maiden: findRuleRowValue(rules.bowling, 'maiden', 0),
      threew: findRuleRowValue(rules.bowling, 'threew', 0),
      fourw: findRuleRowValue(rules.bowling, 'fourw', 0),
      fivew: findRuleRowValue(rules.bowling, 'fivew', 0),
      wide: findRuleRowValue(rules.bowling, 'wide', 0),
      catch: findRuleRowValue(rules.fielding, 'catch', 10),
      stumping: findRuleRowValue(rules.fielding, 'stumping', 0),
      runoutDirect: findRuleRowValue(rules.fielding, 'runout-direct', 0),
      runoutIndirect: findRuleRowValue(rules.fielding, 'runout-indirect', 0),
    }
  }

  return {
    run: Number(rules.run ?? 1),
    four: Number(rules.four ?? 1),
    six: Number(rules.six ?? 2),
    thirty: Number(rules.thirty ?? 0),
    fifty: Number(rules.fifty ?? 0),
    century: Number(rules.century ?? 0),
    duck: Number(rules.duck ?? 0),
    wicket: Number(rules.wicket ?? 20),
    maiden: Number(rules.maiden ?? 0),
    threew: Number(rules.threew ?? 0),
    fourw: Number(rules.fourw ?? 0),
    fivew: Number(rules.fivew ?? 0),
    wide: Number(rules.wide ?? 0),
    catch: Number(rules.catch ?? 10),
    stumping: Number(rules.stumping ?? 0),
    runoutDirect: Number(rules.runoutDirect ?? 0),
    runoutIndirect: Number(rules.runoutIndirect ?? 0),
  }
}

const calculateFantasyPoints = (stats, ruleSet) => {
  const runs = Number(stats?.runs || 0)
  const wickets = Number(stats?.wickets || 0)
  const catches = Number(stats?.catches || 0)
  const fours = Number(stats?.fours || 0)
  const sixes = Number(stats?.sixes || 0)
  const maidens = Number(stats?.maidens || 0)
  const wides = Number(stats?.wides || 0)
  const noBalls = Number(stats?.noBalls || 0)
  const stumpings = Number(stats?.stumpings || 0)
  const runoutDirect = Number(stats?.runoutDirect || 0)
  const runoutIndirect = Number(stats?.runoutIndirect || 0)

  let total = 0
  total += runs * ruleSet.run
  total += wickets * ruleSet.wicket
  total += catches * ruleSet.catch
  total += fours * ruleSet.four
  total += sixes * ruleSet.six
  total += maidens * ruleSet.maiden
  total += (wides + noBalls) * ruleSet.wide
  total += stumpings * ruleSet.stumping
  total += runoutDirect * ruleSet.runoutDirect
  total += runoutIndirect * ruleSet.runoutIndirect

  if (runs >= 100) total += ruleSet.century
  else if (runs >= 50) total += ruleSet.fifty
  else if (runs >= 30) total += ruleSet.thirty

  if (runs === 0 && stats?.dismissed === true) {
    total += ruleSet.duck
  }

  if (wickets >= 5) total += ruleSet.fivew
  else if (wickets >= 4) total += ruleSet.fourw
  else if (wickets >= 3) total += ruleSet.threew

  return total
}

const normalizePlayerStatRows = (rows, players) => {
  const byId = new Map(players.map((p) => [p.id, p]))
  const byName = new Map(players.map((p) => [p.name.toLowerCase(), p]))

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const incomingId = (row.playerId || '').toString()
      const incomingName = (row.playerName || row.name || '').toString()
      const foundById = incomingId ? byId.get(incomingId) : null
      const foundByName = incomingName ? byName.get(incomingName.toLowerCase()) : null
      const player = foundById || foundByName
      if (!player) return null
      return {
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        runs: Number(row.runs || 0),
        ballsFaced: Number(row.ballsFaced || 0),
        wickets: Number(row.wickets || 0),
        catches: Number(row.catches || 0),
        stumpings: Number(row.stumpings || 0),
        runoutDirect: Number(row.runoutDirect || 0),
        runoutIndirect: Number(row.runoutIndirect || 0),
        fours: Number(row.fours || 0),
        sixes: Number(row.sixes || 0),
        overs: Number(row.overs || 0),
        runsConceded: Number(row.runsConceded || 0),
        maidens: Number(row.maidens || 0),
        noBalls: Number(row.noBalls || 0),
        wides: Number(row.wides || 0),
        dismissed: row.dismissed === true,
      }
    })
    .filter(Boolean)
}

const buildPlayerPointsIndex = ({
  tournamentId,
  matchScores,
  scoringRules,
  dashboardRuleTemplate,
  players,
}) => {
  const ruleSet = getRuleSetForTournament({
    tournamentId,
    scoringRules,
    dashboardRuleTemplate,
  })
  const index = {}

  matchScores
    .filter((score) => {
      if (!score?.active) return false
      if (!tournamentId) return true
      return score.tournamentId === tournamentId
    })
    .forEach((score) => {
      const rows = normalizePlayerStatRows(score.playerStats || [], players)
      rows.forEach((row) => {
        const points = calculateFantasyPoints(row, ruleSet)
        if (!index[row.playerId]) {
          index[row.playerId] = {
            playerId: row.playerId,
            playerName: row.playerName,
            team: row.team,
            totalPoints: 0,
            matches: 0,
          }
        }
        index[row.playerId].totalPoints += points
        index[row.playerId].matches += 1
      })
    })

  return index
}

const buildContestLeaderboardRows = ({
  contest,
  sampleUserPicks,
  players,
  playerPointsIndex,
}) => {
  const byName = new Map(players.map((player) => [player.name, player.id]))
  return Object.entries(sampleUserPicks)
    .map(([userId, picks]) => {
      const points = (picks || []).reduce((sum, name) => {
        const playerId = byName.get(name)
        if (!playerId) return sum
        return sum + Number(playerPointsIndex[playerId]?.totalPoints || 0)
      }, 0)
      return {
        id: `${userId}-${contest.id}`,
        userId,
        name: userId.replace(/-/g, ' '),
        points,
      }
    })
    .sort((a, b) => b.points - a.points)
}

const resolveEffectiveSelection = ({
  playingXi = [],
  backups = [],
  activePlayerIds = [],
  captainId = null,
  viceCaptainId = null,
}) => {
  const normalizeId = (value) => (value == null ? '' : value.toString())
  const normalizedPlayingXi = Array.isArray(playingXi)
    ? playingXi.filter((value) => value != null && value !== '')
    : []
  const normalizedBackups = Array.isArray(backups)
    ? backups.filter((value) => value != null && value !== '')
    : []
  const activeSet = new Set(
    (Array.isArray(activePlayerIds) ? activePlayerIds : [])
      .filter((value) => value != null && value !== '')
      .map(normalizeId),
  )
  if (!activeSet.size) {
    return {
      effectivePlayerIds: normalizedPlayingXi,
      captainApplies: normalizedPlayingXi.map(normalizeId).includes(normalizeId(captainId)),
      viceCaptainApplies: normalizedPlayingXi.map(normalizeId).includes(normalizeId(viceCaptainId)),
    }
  }

  const used = new Set()
  const backupQueue = normalizedBackups.filter((playerId) => activeSet.has(normalizeId(playerId)))
  const effectivePlayerIds = []

  const pullReplacement = () => {
    while (backupQueue.length) {
      const candidate = backupQueue.shift()
      if (!used.has(normalizeId(candidate))) return candidate
    }
    return null
  }

  for (const playerId of normalizedPlayingXi) {
    const playerKey = normalizeId(playerId)
    if (activeSet.has(playerKey) && !used.has(playerKey)) {
      effectivePlayerIds.push(playerId)
      used.add(playerKey)
      continue
    }
    const replacement = pullReplacement()
    if (replacement != null) {
      effectivePlayerIds.push(replacement)
      used.add(normalizeId(replacement))
    }
  }

  const effectiveKeys = effectivePlayerIds.map(normalizeId)
  const normalizedCaptainKey = normalizeId(captainId)
  const normalizedViceKey = normalizeId(viceCaptainId)
  return {
    effectivePlayerIds,
    captainApplies:
      !!normalizedCaptainKey &&
      normalizedPlayingXi.map(normalizeId).includes(normalizedCaptainKey) &&
      effectiveKeys.includes(normalizedCaptainKey),
    viceCaptainApplies:
      !!normalizedViceKey &&
      normalizedPlayingXi.map(normalizeId).includes(normalizedViceKey) &&
      effectiveKeys.includes(normalizedViceKey),
  }
}

export {
  getRuleSetForTournament,
  calculateFantasyPoints,
  normalizePlayerStatRows,
  buildPlayerPointsIndex,
  buildContestLeaderboardRows,
  resolveEffectiveSelection,
}
