const findRuleRowValue = (rows, id, fallback = 0) => {
  if (!Array.isArray(rows)) return fallback
  const row = rows.find((item) => item?.id === id)
  return typeof row?.value === 'number' ? row.value : fallback
}

const getRuleSetForTournament = ({
  tournamentId,
  scoringRules,
  dashboardRuleTemplate,
}) => {
  const fromStore = scoringRules.find((item) => item.tournamentId === tournamentId)?.rules
  const rules = fromStore || dashboardRuleTemplate || {}

  if (rules && typeof rules === 'object' && 'batting' in rules) {
    return {
      run: findRuleRowValue(rules.batting, 'run', 1),
      four: findRuleRowValue(rules.batting, 'four', 1),
      six: findRuleRowValue(rules.batting, 'six', 2),
      thirty: findRuleRowValue(rules.batting, 'thirty', 0),
      fifty: findRuleRowValue(rules.batting, 'fifty', 0),
      seventyFive: findRuleRowValue(rules.batting, 'seventyFive', 0),
      century: findRuleRowValue(rules.batting, 'century', 0),
      oneFifty: findRuleRowValue(rules.batting, 'oneFifty', 0),
      twoHundred: findRuleRowValue(rules.batting, 'twoHundred', 0),
      duck: findRuleRowValue(rules.batting, 'duck', 0),
      strikeRate150: findRuleRowValue(rules.batting, 'strikeRate150', 0),
      strikeRate200: findRuleRowValue(rules.batting, 'strikeRate200', 0),
      strikeRate250: findRuleRowValue(rules.batting, 'strikeRate250', 0),
      strikeRateBelow80: findRuleRowValue(rules.batting, 'strikeRateBelow80', 0),
      wicket: findRuleRowValue(rules.bowling, 'wicket', 20),
      maiden: findRuleRowValue(rules.bowling, 'maiden', 0),
      threew: findRuleRowValue(rules.bowling, 'threew', 0),
      fourw: findRuleRowValue(rules.bowling, 'fourw', 0),
      fivew: findRuleRowValue(rules.bowling, 'fivew', 0),
      wide: findRuleRowValue(rules.bowling, 'wide', 0),
      economyBelow3: findRuleRowValue(rules.bowling, 'economyBelow3', 0),
      economyBelow5: findRuleRowValue(rules.bowling, 'economyBelow5', 0),
      economyBelow6: findRuleRowValue(rules.bowling, 'economyBelow6', 0),
      economyAbove10: findRuleRowValue(rules.bowling, 'economyAbove10', 0),
      economyAbove12: findRuleRowValue(rules.bowling, 'economyAbove12', 0),
      hatTrick: findRuleRowValue(rules.bowling, 'hatTrick', 0),
      catch: findRuleRowValue(rules.fielding, 'catch', 10),
      threeCatch: findRuleRowValue(rules.fielding, 'threeCatch', 0),
      stumping: findRuleRowValue(rules.fielding, 'stumping', 0),
      twoStumping: findRuleRowValue(rules.fielding, 'twoStumping', 0),
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
    seventyFive: Number(rules.seventyFive ?? 0),
    century: Number(rules.century ?? 0),
    oneFifty: Number(rules.oneFifty ?? 0),
    twoHundred: Number(rules.twoHundred ?? 0),
    duck: Number(rules.duck ?? 0),
    strikeRate150: Number(rules.strikeRate150 ?? 0),
    strikeRate200: Number(rules.strikeRate200 ?? 0),
    strikeRate250: Number(rules.strikeRate250 ?? 0),
    strikeRateBelow80: Number(rules.strikeRateBelow80 ?? 0),
    wicket: Number(rules.wicket ?? 20),
    maiden: Number(rules.maiden ?? 0),
    threew: Number(rules.threew ?? 0),
    fourw: Number(rules.fourw ?? 0),
    fivew: Number(rules.fivew ?? 0),
    wide: Number(rules.wide ?? 0),
    economyBelow3: Number(rules.economyBelow3 ?? 0),
    economyBelow5: Number(rules.economyBelow5 ?? 0),
    economyBelow6: Number(rules.economyBelow6 ?? 0),
    economyAbove10: Number(rules.economyAbove10 ?? 0),
    economyAbove12: Number(rules.economyAbove12 ?? 0),
    hatTrick: Number(rules.hatTrick ?? 0),
    catch: Number(rules.catch ?? 10),
    threeCatch: Number(rules.threeCatch ?? 0),
    stumping: Number(rules.stumping ?? 0),
    twoStumping: Number(rules.twoStumping ?? 0),
    runoutDirect: Number(rules.runoutDirect ?? 0),
    runoutIndirect: Number(rules.runoutIndirect ?? 0),
  }
}

const getStrikeRateValue = (runs = 0, ballsFaced = 0) => {
  const numericRuns = Number(runs || 0)
  const numericBalls = Number(ballsFaced || 0)
  if (!numericBalls) return 0
  return (numericRuns / numericBalls) * 100
}

const getEconomyValue = (overs = 0, runsConceded = 0) => {
  const numericOvers = Number(overs || 0)
  const numericRunsConceded = Number(runsConceded || 0)
  if (!numericOvers) return 0
  return numericRunsConceded / numericOvers
}

const calculateFantasyPoints = (stats, ruleSet) => {
  const runs = Number(stats?.runs || 0)
  const wickets = Number(stats?.wickets || 0)
  const catches = Number(stats?.catches || 0)
  const fours = Number(stats?.fours || 0)
  const sixes = Number(stats?.sixes || 0)
  const ballsFaced = Number(stats?.ballsFaced || 0)
  const overs = Number(stats?.overs || stats?.oversBowled || 0)
  const runsConceded = Number(stats?.runsConceded || 0)
  const maidens = Number(stats?.maidens || 0)
  const wides = Number(stats?.wides || 0)
  const noBalls = Number(stats?.noBalls || 0)
  const stumpings = Number(stats?.stumpings || 0)
  const runoutDirect = Number(stats?.runoutDirect || 0)
  const runoutIndirect = Number(stats?.runoutIndirect || 0)
  const hatTrick = Number(stats?.hatTrick || 0)

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
  total += hatTrick * ruleSet.hatTrick

  if (runs >= 200) total += ruleSet.twoHundred
  else if (runs >= 150) total += ruleSet.oneFifty
  else if (runs >= 100) total += ruleSet.century
  else if (runs >= 75) total += ruleSet.seventyFive
  else if (runs >= 50) total += ruleSet.fifty
  else if (runs >= 30) total += ruleSet.thirty

  if (runs === 0 && ballsFaced > 0 && stats?.dismissed === true) {
    total += ruleSet.duck
  }

  if (wickets >= 5) total += ruleSet.fivew
  else if (wickets >= 4) total += ruleSet.fourw
  else if (wickets >= 3) total += ruleSet.threew

  if (catches >= 3) total += ruleSet.threeCatch
  if (stumpings >= 2) total += ruleSet.twoStumping

  if (ballsFaced >= 15) {
    const strikeRate = getStrikeRateValue(runs, ballsFaced)
    if (strikeRate >= 250) total += ruleSet.strikeRate250
    else if (strikeRate >= 200) total += ruleSet.strikeRate200
    else if (strikeRate >= 150) total += ruleSet.strikeRate150
    else if (strikeRate < 80) total += ruleSet.strikeRateBelow80
  }

  if (overs >= 2) {
    const economy = getEconomyValue(overs, runsConceded)
    if (economy <= 3) total += ruleSet.economyBelow3
    else if (economy <= 5) total += ruleSet.economyBelow5
    else if (economy <= 6) total += ruleSet.economyBelow6
    else if (economy >= 12) total += ruleSet.economyAbove12
    else if (economy >= 10) total += ruleSet.economyAbove10
  }

  return total
}

const calculateFantasyPointBreakdown = (stats, ruleSet) => {
  const rows = []
  const push = (label, count, valuePerUnit) => {
    const numericCount = Number(count || 0)
    const numericValue = Number(valuePerUnit || 0)
    if (!numericCount || !numericValue) return
    rows.push({
      label,
      count: numericCount,
      valuePerUnit: numericValue,
      points: numericCount * numericValue,
    })
  }

  const runs = Number(stats?.runs || 0)
  const wickets = Number(stats?.wickets || 0)
  const catches = Number(stats?.catches || 0)
  const fours = Number(stats?.fours || 0)
  const sixes = Number(stats?.sixes || 0)
  const ballsFaced = Number(stats?.ballsFaced || 0)
  const overs = Number(stats?.overs || stats?.oversBowled || 0)
  const runsConceded = Number(stats?.runsConceded || 0)
  const maidens = Number(stats?.maidens || 0)
  const wides = Number(stats?.wides || 0)
  const noBalls = Number(stats?.noBalls || 0)
  const stumpings = Number(stats?.stumpings || 0)
  const runoutDirect = Number(stats?.runoutDirect || 0)
  const runoutIndirect = Number(stats?.runoutIndirect || 0)
  const hatTrick = Number(stats?.hatTrick || 0)

  push('Runs', runs, ruleSet.run)
  push('Fours', fours, ruleSet.four)
  push('Sixes', sixes, ruleSet.six)
  push('Wickets', wickets, ruleSet.wicket)
  push('Maidens', maidens, ruleSet.maiden)
  push('Wides + no balls', wides + noBalls, ruleSet.wide)
  push('Catches', catches, ruleSet.catch)
  push('Stumpings', stumpings, ruleSet.stumping)
  push('Run-out direct', runoutDirect, ruleSet.runoutDirect)
  push('Run-out assist', runoutIndirect, ruleSet.runoutIndirect)
  push('Hat-trick', hatTrick, ruleSet.hatTrick)

  if (runs >= 200 && Number(ruleSet.twoHundred || 0)) {
    rows.push({
      label: '200+ bonus',
      count: 1,
      valuePerUnit: ruleSet.twoHundred,
      points: Number(ruleSet.twoHundred || 0),
    })
  } else if (runs >= 150 && Number(ruleSet.oneFifty || 0)) {
    rows.push({
      label: '150 bonus',
      count: 1,
      valuePerUnit: ruleSet.oneFifty,
      points: Number(ruleSet.oneFifty || 0),
    })
  } else if (runs >= 100 && Number(ruleSet.century || 0)) {
    rows.push({
      label: 'Century bonus',
      count: 1,
      valuePerUnit: ruleSet.century,
      points: Number(ruleSet.century || 0),
    })
  } else if (runs >= 75 && Number(ruleSet.seventyFive || 0)) {
    rows.push({
      label: '75 bonus',
      count: 1,
      valuePerUnit: ruleSet.seventyFive,
      points: Number(ruleSet.seventyFive || 0),
    })
  } else if (runs >= 50 && Number(ruleSet.fifty || 0)) {
    rows.push({
      label: 'Fifty bonus',
      count: 1,
      valuePerUnit: ruleSet.fifty,
      points: Number(ruleSet.fifty || 0),
    })
  } else if (runs >= 30 && Number(ruleSet.thirty || 0)) {
    rows.push({
      label: 'Thirty bonus',
      count: 1,
      valuePerUnit: ruleSet.thirty,
      points: Number(ruleSet.thirty || 0),
    })
  }

  if (
    runs === 0 &&
    ballsFaced > 0 &&
    stats?.dismissed === true &&
    Number(ruleSet.duck || 0)
  ) {
    rows.push({
      label: 'Duck',
      count: 1,
      valuePerUnit: ruleSet.duck,
      points: Number(ruleSet.duck || 0),
    })
  }

  if (wickets >= 5 && Number(ruleSet.fivew || 0)) {
    rows.push({
      label: 'Five wicket bonus',
      count: 1,
      valuePerUnit: ruleSet.fivew,
      points: Number(ruleSet.fivew || 0),
    })
  } else if (wickets >= 4 && Number(ruleSet.fourw || 0)) {
    rows.push({
      label: 'Four wicket bonus',
      count: 1,
      valuePerUnit: ruleSet.fourw,
      points: Number(ruleSet.fourw || 0),
    })
  } else if (wickets >= 3 && Number(ruleSet.threew || 0)) {
    rows.push({
      label: 'Three wicket bonus',
      count: 1,
      valuePerUnit: ruleSet.threew,
      points: Number(ruleSet.threew || 0),
    })
  }

  if (catches >= 3 && Number(ruleSet.threeCatch || 0)) {
    rows.push({
      label: '3+ catches bonus',
      count: 1,
      valuePerUnit: ruleSet.threeCatch,
      points: Number(ruleSet.threeCatch || 0),
    })
  }

  if (stumpings >= 2 && Number(ruleSet.twoStumping || 0)) {
    rows.push({
      label: '2+ stumpings bonus',
      count: 1,
      valuePerUnit: ruleSet.twoStumping,
      points: Number(ruleSet.twoStumping || 0),
    })
  }

  if (ballsFaced >= 15) {
    const strikeRate = getStrikeRateValue(runs, ballsFaced)
    if (strikeRate >= 250 && Number(ruleSet.strikeRate250 || 0)) {
      rows.push({
        label: 'Strike rate 250+',
        count: 1,
        valuePerUnit: ruleSet.strikeRate250,
        points: Number(ruleSet.strikeRate250 || 0),
      })
    } else if (strikeRate >= 200 && Number(ruleSet.strikeRate200 || 0)) {
      rows.push({
        label: 'Strike rate 200+',
        count: 1,
        valuePerUnit: ruleSet.strikeRate200,
        points: Number(ruleSet.strikeRate200 || 0),
      })
    } else if (strikeRate >= 150 && Number(ruleSet.strikeRate150 || 0)) {
      rows.push({
        label: 'Strike rate 150+',
        count: 1,
        valuePerUnit: ruleSet.strikeRate150,
        points: Number(ruleSet.strikeRate150 || 0),
      })
    } else if (strikeRate < 80 && Number(ruleSet.strikeRateBelow80 || 0)) {
      rows.push({
        label: 'Strike rate below 80',
        count: 1,
        valuePerUnit: ruleSet.strikeRateBelow80,
        points: Number(ruleSet.strikeRateBelow80 || 0),
      })
    }
  }

  if (overs >= 2) {
    const economy = getEconomyValue(overs, runsConceded)
    if (economy <= 3 && Number(ruleSet.economyBelow3 || 0)) {
      rows.push({
        label: 'Economy 3 or less',
        count: 1,
        valuePerUnit: ruleSet.economyBelow3,
        points: Number(ruleSet.economyBelow3 || 0),
      })
    } else if (economy <= 5 && Number(ruleSet.economyBelow5 || 0)) {
      rows.push({
        label: 'Economy 5 or less',
        count: 1,
        valuePerUnit: ruleSet.economyBelow5,
        points: Number(ruleSet.economyBelow5 || 0),
      })
    } else if (economy <= 6 && Number(ruleSet.economyBelow6 || 0)) {
      rows.push({
        label: 'Economy 6 or less',
        count: 1,
        valuePerUnit: ruleSet.economyBelow6,
        points: Number(ruleSet.economyBelow6 || 0),
      })
    } else if (economy >= 12 && Number(ruleSet.economyAbove12 || 0)) {
      rows.push({
        label: 'Economy 12+',
        count: 1,
        valuePerUnit: ruleSet.economyAbove12,
        points: Number(ruleSet.economyAbove12 || 0),
      })
    } else if (economy >= 10 && Number(ruleSet.economyAbove10 || 0)) {
      rows.push({
        label: 'Economy 10+',
        count: 1,
        valuePerUnit: ruleSet.economyAbove10,
        points: Number(ruleSet.economyAbove10 || 0),
      })
    }
  }

  return rows
}

const FIRST_NAME_ALIASES = new Map([
  ['philip', 'phil'],
  ['phillip', 'phil'],
  ['mohammad', 'mohammed'],
  ['mohd', 'mohammed'],
  ['mohammed', 'mohammed'],
])

const normalizeNameKey = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokenizeName = (value) => normalizeNameKey(value).split(' ').filter(Boolean)

const normalizeFirstNameToken = (token) => FIRST_NAME_ALIASES.get(token) || token

const firstNamesCompatible = (left = '', right = '') => {
  if (!left || !right) return false
  if (left === right) return true
  if (left.startsWith(right) || right.startsWith(left)) return true
  return normalizeFirstNameToken(left) === normalizeFirstNameToken(right)
}

const namesLikelyMatch = (incomingName, playerName) => {
  const incomingKey = normalizeNameKey(incomingName)
  const playerKey = normalizeNameKey(playerName)
  if (!incomingKey || !playerKey) return false
  if (incomingKey === playerKey) return true

  const incomingTokens = tokenizeName(incomingName)
  const playerTokens = tokenizeName(playerName)
  if (!incomingTokens.length || !playerTokens.length) return false

  const incomingLast = incomingTokens[incomingTokens.length - 1]
  const playerLast = playerTokens[playerTokens.length - 1]
  if (!incomingLast || incomingLast !== playerLast) return false

  return firstNamesCompatible(incomingTokens[0], playerTokens[0])
}

const buildPlayerIdentityIndex = (players = []) => {
  const byId = new Map()
  const byExactName = new Map()
  const byNameKey = new Map()
  const byLastName = new Map()

  for (const player of players) {
    if (!player) continue
    const idKey = player.id == null ? '' : player.id.toString().trim()
    const nameValue = (player.name || '').toString().trim()
    const exactNameKey = nameValue.toLowerCase()
    const nameKey = normalizeNameKey(nameValue)
    const tokens = tokenizeName(nameValue)
    const lastName = tokens[tokens.length - 1] || ''

    if (idKey) byId.set(idKey, player)
    if (exactNameKey) byExactName.set(exactNameKey, player)
    if (nameKey) {
      const current = byNameKey.get(nameKey) || []
      current.push(player)
      byNameKey.set(nameKey, current)
    }
    if (lastName) {
      const current = byLastName.get(lastName) || []
      current.push(player)
      byLastName.set(lastName, current)
    }
  }

  return { byId, byExactName, byNameKey, byLastName }
}

const resolvePlayerStatPlayer = (row, playersOrIndex) => {
  if (!row || typeof row !== 'object') return null
  const index =
    playersOrIndex && playersOrIndex.byId && playersOrIndex.byExactName
      ? playersOrIndex
      : buildPlayerIdentityIndex(playersOrIndex || [])

  const incomingId = (row.playerId || '').toString().trim()
  if (incomingId) {
    const byIdMatch = index.byId.get(incomingId)
    if (byIdMatch) return byIdMatch
  }

  const incomingName = (row.playerName || row.name || '').toString().trim()
  if (!incomingName) return null

  const exactMatch = index.byExactName.get(incomingName.toLowerCase())
  if (exactMatch) return exactMatch

  const incomingNameKey = normalizeNameKey(incomingName)
  if (incomingNameKey) {
    const normalizedMatches = index.byNameKey.get(incomingNameKey) || []
    if (normalizedMatches.length === 1) return normalizedMatches[0]
    const uniqueLikely = normalizedMatches.filter((candidate) =>
      namesLikelyMatch(incomingName, candidate.name),
    )
    if (uniqueLikely.length === 1) return uniqueLikely[0]
  }

  const incomingTokens = tokenizeName(incomingName)
  const incomingLast = incomingTokens[incomingTokens.length - 1] || ''
  const lastNameCandidates = incomingLast ? index.byLastName.get(incomingLast) || [] : []
  if (
    lastNameCandidates.length === 1 &&
    namesLikelyMatch(incomingName, lastNameCandidates[0].name)
  ) {
    return lastNameCandidates[0]
  }
  const likelyCandidates = lastNameCandidates.filter((candidate) =>
    namesLikelyMatch(incomingName, candidate.name),
  )
  if (likelyCandidates.length === 1) return likelyCandidates[0]

  return null
}

const normalizePlayerStatRows = (rows, players) => {
  const identityIndex = buildPlayerIdentityIndex(players)

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const player = resolvePlayerStatPlayer(row, identityIndex)
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
        hatTrick: Number(row.hatTrick || 0),
        fours: Number(row.fours || 0),
        sixes: Number(row.sixes || 0),
        overs: Number(row.overs || 0),
        runsConceded: Number(row.runsConceded || 0),
        maidens: Number(row.maidens || 0),
        noBalls: Number(row.noBalls || 0),
        wides: Number(row.wides || 0),
        dismissed: row.dismissed === true,
        battingOrder:
          row.battingOrder == null || row.battingOrder === ''
            ? null
            : Number(row.battingOrder || 0),
        inningsRuns:
          row.inningsRuns == null || row.inningsRuns === ''
            ? null
            : Number(row.inningsRuns || 0),
        inningsWickets:
          row.inningsWickets == null || row.inningsWickets === ''
            ? null
            : Number(row.inningsWickets || 0),
        inningsBalls:
          row.inningsBalls == null || row.inningsBalls === ''
            ? null
            : Number(row.inningsBalls || 0),
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
      nextPlayingXi: normalizedPlayingXi,
      nextBackups: normalizedBackups,
      effectivePlayerIds: normalizedPlayingXi,
      promotedBackupIds: [],
      benchedPlayerIds: [],
      captainApplies: normalizedPlayingXi
        .map(normalizeId)
        .includes(normalizeId(captainId)),
      viceCaptainApplies: normalizedPlayingXi
        .map(normalizeId)
        .includes(normalizeId(viceCaptainId)),
    }
  }

  const used = new Set()
  const backupQueue = normalizedBackups.filter((playerId) =>
    activeSet.has(normalizeId(playerId)),
  )
  const remainingBackups = [...normalizedBackups]
  const effectivePlayerIds = []
  const nextPlayingXi = []
  const promotedBackupIds = []
  const benchedPlayerIds = []
  const replacementPairs = []

  const pullReplacement = () => {
    while (backupQueue.length) {
      const candidate = backupQueue.shift()
      const candidateKey = normalizeId(candidate)
      if (used.has(candidateKey)) continue
      const remainingIndex = remainingBackups.findIndex(
        (value) => normalizeId(value) === candidateKey,
      )
      if (remainingIndex >= 0) remainingBackups.splice(remainingIndex, 1)
      return candidate
    }
    return null
  }

  // Initialize resolved C/VC and their normalized keys before swap loop
  let resolvedCaptainId = captainId
  let resolvedViceCaptainId = viceCaptainId

  let normalizedCaptainKey = normalizeId(resolvedCaptainId)
  let normalizedViceKey = normalizeId(resolvedViceCaptainId)

  for (const playerId of normalizedPlayingXi) {
    const playerKey = normalizeId(playerId)
    if (activeSet.has(playerKey) && !used.has(playerKey)) {
      effectivePlayerIds.push(playerId)
      nextPlayingXi.push(playerId)
      used.add(playerKey)
      continue
    }
    const replacement = pullReplacement()
    if (replacement != null) {
      effectivePlayerIds.push(replacement)
      nextPlayingXi.push(replacement)
      used.add(normalizeId(replacement))
      promotedBackupIds.push(replacement)
      benchedPlayerIds.push(playerId)
      replacementPairs.push({
        promotedBackupId: replacement,
        benchedPlayerId: playerId,
      })
      // If benched player was C or VC, assign tag to replacement
      if (normalizeId(playerId) === normalizeId(captainId)) {
        resolvedCaptainId = replacement
        normalizedCaptainKey = normalizeId(replacement)
      }
      if (normalizeId(playerId) === normalizeId(viceCaptainId)) {
        resolvedViceCaptainId = replacement
        normalizedViceKey = normalizeId(replacement)
      }
      continue
    }
    nextPlayingXi.push(playerId)
  }

  for (const benchedPlayerId of benchedPlayerIds) {
    const benchedKey = normalizeId(benchedPlayerId)
    if (!remainingBackups.some((value) => normalizeId(value) === benchedKey)) {
      remainingBackups.push(benchedPlayerId)
    }
  }

  const effectiveKeys = effectivePlayerIds.map(normalizeId)

  // Recalculate normalized keys after possible swap
  normalizedCaptainKey = normalizeId(resolvedCaptainId)
  normalizedViceKey = normalizeId(resolvedViceCaptainId)

  return {
    nextPlayingXi,
    nextBackups: remainingBackups,
    effectivePlayerIds,
    promotedBackupIds,
    benchedPlayerIds,
    replacementPairs,
    captainApplies:
      !!normalizedCaptainKey &&
      nextPlayingXi.map(normalizeId).includes(normalizedCaptainKey) &&
      effectiveKeys.includes(normalizedCaptainKey),
    viceCaptainApplies:
      !!normalizedViceKey &&
      nextPlayingXi.map(normalizeId).includes(normalizedViceKey) &&
      effectiveKeys.includes(normalizedViceKey),
    resolvedCaptainId,
    resolvedViceCaptainId,
  }
}

export {
  getRuleSetForTournament,
  calculateFantasyPoints,
  calculateFantasyPointBreakdown,
  buildPlayerIdentityIndex,
  resolvePlayerStatPlayer,
  normalizePlayerStatRows,
  buildPlayerPointsIndex,
  buildContestLeaderboardRows,
  resolveEffectiveSelection,
}
