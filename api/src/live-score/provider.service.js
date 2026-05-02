import { getLiveScoreTeamAliases } from './constants.js'
import { recordLiveScoreLog } from './logger.js'

const toNumber = (value) => {
  const normalized = (value ?? '').toString().replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const oversTextToBalls = (value) => {
  const raw = (value ?? '').toString().trim()
  if (!raw) return 0
  const [whole, partial = '0'] = raw.split('.')
  const completedOvers = Number(whole || 0)
  const extraBalls = Number(partial.slice(0, 1) || 0)
  if (!Number.isFinite(completedOvers) || !Number.isFinite(extraBalls)) return 0
  return completedOvers * 6 + Math.min(extraBalls, 5)
}

const parseTotalScore = (value = '') => {
  const raw = (value || '').toString().trim()
  const scoreMatch = raw.match(/(\d+)\s*\/\s*(\d+)/)
  if (!scoreMatch) return null
  const oversMatch = raw.match(/\(([\d.]+)\s*Ov\)/i)
  return {
    inningsRuns: toNumber(scoreMatch[1]),
    inningsWickets: toNumber(scoreMatch[2]),
    inningsBalls: oversTextToBalls(oversMatch?.[1] || ''),
  }
}

const isDismissed = (dismissal = '') => {
  const value = dismissal.toString().trim().toLowerCase()
  if (!value) return false
  return !['not out', 'retired hurt', 'retired out'].includes(value)
}

const cleanFielderName = (value = '') =>
  value
    .toString()
    .replace(/[†*]/g, '')
    .replace(/\bsubstitute\b/gi, '')
    .replace(/\bsub\b/gi, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const splitFielderNames = (value = '') =>
  value
    .toString()
    .split(/\s*[/,&]\s*|\s+and\s+/i)
    .map(cleanFielderName)
    .filter(Boolean)

const dismissalToFieldingStats = (dismissal = '') => {
  const value = dismissal.toString().replace(/\s+/g, ' ').trim()
  if (!value) return []

  const caughtAndBowled = value.match(/^c\s*(?:&|and)\s*b\s+(.+)$/i)
  if (caughtAndBowled) {
    const playerName = cleanFielderName(caughtAndBowled[1])
    return playerName ? [{ playerName, catches: 1 }] : []
  }

  const caught = value.match(/^c\s+(.+?)\s+b\s+.+$/i)
  if (caught) {
    return splitFielderNames(caught[1]).map((playerName) => ({
      playerName,
      catches: 1,
    }))
  }

  const stumped = value.match(/^st\s+(.+?)\s+b\s+.+$/i)
  if (stumped) {
    const playerName = cleanFielderName(stumped[1])
    return playerName ? [{ playerName, stumpings: 1 }] : []
  }

  const runOut = value.match(/run\s*out\s*\(([^)]+)\)/i)
  if (runOut) {
    const fielders = splitFielderNames(runOut[1])
    if (fielders.length === 1) {
      return [{ playerName: fielders[0], runoutDirect: 1 }]
    }
    return fielders.map((playerName) => ({ playerName, runoutIndirect: 1 }))
  }

  return []
}

const normalizeBaseUrl = (value) =>
  (value || '').toString().trim().replace(/\/+$/, '')

const stringifyForLog = (value) => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const summarizeScraperPayload = (payload) => {
  const data = payload?.data ?? payload
  if (Array.isArray(data)) {
    return {
      success: payload?.success,
      message: payload?.message || '',
      count: data.length,
      statuses: data.slice(0, 8).map((item) => ({
        matchId: item?.matchId || '',
        title: item?.shortTitle || item?.title || '',
        status: item?.status || '',
      })),
    }
  }
  if (data && typeof data === 'object') {
    return {
      success: payload?.success,
      message: payload?.message || '',
      matchId: data.matchId || '',
      title: data.shortTitle || data.matchTitle || data.title || '',
      status: data.status || '',
      state: data.state || '',
      innings: Array.isArray(data.innings) ? data.innings.length : undefined,
      teams: Array.isArray(data.teams)
        ? data.teams.map((team) => ({
            team: team.teamShortName || team.teamName || '',
            playingXI: Array.isArray(team.playingXI) ? team.playingXI.length : 0,
            impactPlayers: Array.isArray(team.impactPlayers)
              ? team.impactPlayers.length
              : 0,
          }))
        : undefined,
    }
  }
  return {
    success: payload?.success,
    message: payload?.message || '',
    value: data == null ? null : String(data).slice(0, 200),
  }
}

const recordScraperCall = (context = {}, call = {}) => {
  if (!Array.isArray(context.scraperCalls)) return
  context.scraperCalls.push({
    route: call.route || '',
    method: call.method || 'GET',
    status: call.status || '',
    httpStatus: call.httpStatus || null,
    durationMs: call.durationMs || 0,
    matchId: context.matchId || null,
    providerMatchId: context.providerMatchId || null,
    error: call.error || '',
    response: call.response || null,
  })
}

const normalizeText = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeProviderStatus = (value = '') => normalizeText(value)

const hasWholeWordWon = (status = '') => /\bwon\b/i.test(status.toString())

const isProviderLiveStatus = (status = '') =>
  normalizeProviderStatus(status) === normalizeProviderStatus(
    process.env.LIVE_SCORE_PROVIDER_LIVE_STATUS || 'Live',
  )

const isProviderCompletedStatus = (status = '') => {
  const normalized = normalizeProviderStatus(status)
  return (
    normalized === 'complete' ||
    normalized === 'completed' ||
    hasWholeWordWon(status)
  )
}

const isProviderDiscoverableMatchStatus = (status = '') => {
  const normalized = normalizeProviderStatus(status)
  if (isProviderLiveStatus(status)) return true
  if (isProviderCompletedStatus(status)) return false
  if (!normalized || ['preview', 'upcoming', 'upcoming match'].includes(normalized)) {
    return false
  }
  if (normalized === 'toss') return true
  if (/\bopt(?:ed|s)?\s+to\s+(bat|bowl|field)\b/i.test(status)) return true
  if (/\bin\s+progress\b/i.test(status)) return true
  if (/\bneed\s+\d+\s+runs?\b/i.test(status)) return true
  if (/\brequire\s+\d+\s+runs?\b/i.test(status)) return true
  return false
}

const isProviderActiveScorecard = (scorecard = {}) => {
  const status = (scorecard?.status || '').toString().trim()
  const normalized = normalizeProviderStatus(status)
  if (isProviderLiveStatus(status) || isProviderCompletedStatus(status)) return true
  if (!normalized || ['preview', 'upcoming', 'upcoming match'].includes(normalized)) {
    return false
  }
  if (/\bneed\s+\d+\s+runs?\b/i.test(status)) return true
  if (/\brequire\s+\d+\s+runs?\b/i.test(status)) return true
  if (/\btrail(?:s|ing)?\s+by\b/i.test(status)) return true
  if (/\blead(?:s|ing)?\s+by\b/i.test(status)) return true

  return (scorecard.innings || []).some(
    (innings) =>
      (innings?.totalScore || '').toString().trim() ||
      (innings?.batting || []).some((row) => toNumber(row?.runs) > 0 || toNumber(row?.balls) > 0) ||
      (innings?.bowling || []).some((row) => toNumber(row?.overs) > 0),
  )
}

const getTeamAliases = (...values) => {
  const aliases = new Set()
  const aliasSource = getLiveScoreTeamAliases()
  for (const value of values) {
    const raw = (value || '').toString().trim()
    if (!raw) continue
    aliases.add(normalizeText(raw))
    const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    for (const alias of aliasSource[compact] || aliasSource[raw] || []) {
      aliases.add(normalizeText(alias))
    }
  }
  return [...aliases].filter(Boolean)
}

const titleContainsTeam = (title, aliases = []) => {
  const normalizedTitle = normalizeText(title)
  return aliases.some((alias) => normalizedTitle.includes(alias))
}

const getProviderTitleText = (match = {}) =>
  [match.title, match.shortTitle, match.short_title, match.shortName]
    .filter(Boolean)
    .join(' ')

const isWithinHours = (candidateTime, targetTime, hours) => {
  if (!candidateTime || !targetTime) return true
  const candidate = new Date(candidateTime)
  const target = new Date(targetTime)
  if (Number.isNaN(candidate.getTime()) || Number.isNaN(target.getTime())) return true
  return Math.abs(candidate.getTime() - target.getTime()) <= hours * 60 * 60 * 1000
}

const mergePlayerStat = (statsByName, row) => {
  const name = (row?.playerName || '').toString().trim()
  if (!name) return
  const key = name.toLowerCase()
  const current =
    statsByName.get(key) ||
    {
      playerName: name,
      runs: 0,
      ballsFaced: 0,
      wickets: 0,
      catches: 0,
      fours: 0,
      sixes: 0,
      maidens: 0,
      noBalls: 0,
      wides: 0,
      stumpings: 0,
      runoutDirect: 0,
      runoutIndirect: 0,
      hatTrick: 0,
      overs: 0,
      runsConceded: 0,
      dismissed: false,
      battingOrder: null,
      inningsRuns: null,
      inningsWickets: null,
      inningsBalls: null,
    }

  const incomingBattingOrder =
    row.battingOrder == null || row.battingOrder === ''
      ? null
      : toNumber(row.battingOrder)
  const currentBattingOrder =
    current.battingOrder == null || current.battingOrder === ''
      ? null
      : toNumber(current.battingOrder)

  statsByName.set(key, {
    ...current,
    runs: current.runs + toNumber(row.runs),
    ballsFaced: current.ballsFaced + toNumber(row.ballsFaced),
    wickets: current.wickets + toNumber(row.wickets),
    catches: current.catches + toNumber(row.catches),
    fours: current.fours + toNumber(row.fours),
    sixes: current.sixes + toNumber(row.sixes),
    maidens: current.maidens + toNumber(row.maidens),
    noBalls: current.noBalls + toNumber(row.noBalls),
    wides: current.wides + toNumber(row.wides),
    stumpings: current.stumpings + toNumber(row.stumpings),
    runoutDirect: current.runoutDirect + toNumber(row.runoutDirect),
    runoutIndirect: current.runoutIndirect + toNumber(row.runoutIndirect),
    hatTrick:
      current.hatTrick + (row.hatTrick === true ? 1 : toNumber(row.hatTrick)),
    overs: current.overs + toNumber(row.overs),
    runsConceded: current.runsConceded + toNumber(row.runsConceded),
    dismissed: current.dismissed || row.dismissed === true,
    battingOrder:
      incomingBattingOrder == null
        ? current.battingOrder
        : currentBattingOrder == null
          ? incomingBattingOrder
          : Math.min(currentBattingOrder, incomingBattingOrder),
    inningsRuns:
      row.inningsRuns == null || row.inningsRuns === ''
        ? current.inningsRuns
        : toNumber(row.inningsRuns),
    inningsWickets:
      row.inningsWickets == null || row.inningsWickets === ''
        ? current.inningsWickets
        : toNumber(row.inningsWickets),
    inningsBalls:
      row.inningsBalls == null || row.inningsBalls === ''
        ? current.inningsBalls
        : toNumber(row.inningsBalls),
  })
}

const scorecardToPlayerStats = (scorecard = {}) => {
  const statsByName = new Map()
  for (const [inningsIndex, innings] of (scorecard.innings || []).entries()) {
    const inningsTotal = parseTotalScore(innings?.totalScore)
    let parsedFieldingRows = 0
    for (const batter of innings.batting || []) {
      mergePlayerStat(statsByName, {
        playerName: batter.name,
        battingOrder: inningsIndex + 1,
        ...(inningsTotal || {}),
        runs: batter.runs,
        ballsFaced: batter.balls,
        fours: batter.fours,
        sixes: batter.sixes,
        dismissed:
          typeof batter.isDismissed === 'boolean'
            ? batter.isDismissed
            : isDismissed(batter.dismissal),
      })
      for (const fieldingRow of dismissalToFieldingStats(batter.dismissal)) {
        mergePlayerStat(statsByName, fieldingRow)
        parsedFieldingRows += 1
      }
    }
    if (!parsedFieldingRows) {
      for (const fieldingRow of innings.fielding || []) {
        const playerName = cleanFielderName(fieldingRow?.name)
        if (!playerName || playerName.toLowerCase() === 'and') continue
        mergePlayerStat(statsByName, {
          playerName,
          catches: fieldingRow.catches,
          stumpings: fieldingRow.stumpings,
          runoutDirect: fieldingRow.runoutDirect,
          runoutIndirect: fieldingRow.runoutIndirect,
        })
      }
    }
    for (const bowler of innings.bowling || []) {
      mergePlayerStat(statsByName, {
        playerName: bowler.name,
        overs: bowler.overs,
        maidens: bowler.maidens,
        runsConceded: bowler.runs,
        wickets: bowler.wickets,
        wides: bowler.wides,
        noBalls: bowler.noBalls,
        hatTrick: bowler.hatTrick,
      })
    }
  }
  return [...statsByName.values()]
}

const getPlayerName = (player) => {
  if (typeof player === 'string') return player.trim()
  if (!player || typeof player !== 'object') return ''
  return (
    player.name ||
    player.playerName ||
    player.fullName ||
    player.displayName ||
    ''
  )
    .toString()
    .trim()
}

const getPlayerDetails = (player) => {
  const name = getPlayerName(player)
  if (!name) return null
  if (typeof player === 'string') {
    return { name, role: '', playerId: '' }
  }
  return {
    name,
    role: (player.role || '').toString().trim(),
    playerId: (player.playerId || player.id || player.sourceKey || '').toString().trim(),
  }
}

const toPlayerNames = (players) =>
  (Array.isArray(players) ? players : [])
    .map(getPlayerName)
    .filter(Boolean)

const toPlayerDetails = (players) =>
  (Array.isArray(players) ? players : [])
    .map(getPlayerDetails)
    .filter(Boolean)

const normalizePlayingXiTeam = (team = {}) => {
  if (!team || typeof team !== 'object') return null
  const playingXiSource =
    team.playingXI ||
    team.playingXi ||
    team.playing11 ||
    team.players ||
    team.xi ||
    []
  const impactSource = team.impactPlayers || team.impact || []
  const playingXI = toPlayerNames(
    playingXiSource,
  )
  return {
    teamName: (team.teamName || team.name || team.team || '').toString().trim(),
    teamShortName: (
      team.teamShortName ||
      team.shortName ||
      team.short ||
      team.code ||
      ''
    )
      .toString()
      .trim(),
    playingXI,
    bench: toPlayerNames(team.bench || team.substitutes || []),
    impactPlayers: toPlayerNames(impactSource),
    providerPlayers: [...toPlayerDetails(playingXiSource), ...toPlayerDetails(impactSource)],
  }
}

const normalizePlayingXiTeams = (payload = {}) => {
  const source =
    payload?.teams ||
    payload?.lineups ||
    payload?.playingXI ||
    payload?.playingXi ||
    payload
  if (Array.isArray(source)) {
    return source.map(normalizePlayingXiTeam).filter((team) => team?.playingXI?.length)
  }
  if (source && typeof source === 'object') {
    return Object.entries(source)
      .map(([key, value]) =>
        normalizePlayingXiTeam({
          teamShortName: key,
          ...(value && typeof value === 'object' ? value : { playingXI: value }),
        }),
      )
      .filter((team) => team?.playingXI?.length)
  }
  return []
}

const teamMatchesProviderLineup = (team, aliases = []) => {
  const text = normalizeText([team.teamName, team.teamShortName].filter(Boolean).join(' '))
  return aliases.some((alias) => text === alias || text.includes(alias))
}

const playingXiToMatchLineups = (payload = {}, match = {}) => {
  const teams = normalizePlayingXiTeams(payload)
  const teamAKey = match.teamAKey || match.teamA
  const teamBKey = match.teamBKey || match.teamB
  const teamAAliases = getTeamAliases(match.teamA, match.teamAKey, match.teamAName)
  const teamBAliases = getTeamAliases(match.teamB, match.teamBKey, match.teamBName)
  const usedIndexes = new Set()

  const findTeam = (aliases, fallbackIndex) => {
    const matchedIndex = teams.findIndex(
      (team, index) => !usedIndexes.has(index) && teamMatchesProviderLineup(team, aliases),
    )
    const index = matchedIndex >= 0 ? matchedIndex : fallbackIndex
    if (!teams[index] || usedIndexes.has(index)) return null
    usedIndexes.add(index)
    return teams[index]
  }

  const teamA = findTeam(teamAAliases, 0)
  const teamB = findTeam(teamBAliases, 1)
  const lineups = {}
  if (teamAKey && teamA) {
    lineups[teamAKey] = {
      playingXI: teamA.playingXI,
      bench: teamA.bench,
      impactPlayers: teamA.impactPlayers,
      providerPlayers: teamA.providerPlayers,
    }
  }
  if (teamBKey && teamB) {
    lineups[teamBKey] = {
      playingXI: teamB.playingXI,
      bench: teamB.bench,
      impactPlayers: teamB.impactPlayers,
      providerPlayers: teamB.providerPlayers,
    }
  }
  return lineups
}

class LiveScoreProviderService {
  constructor({ fetchImpl = globalThis.fetch, baseUrl = null } = {}) {
    this.fetchImpl = fetchImpl
    this.baseUrl = baseUrl == null ? null : normalizeBaseUrl(baseUrl)
  }

  getBaseUrl() {
    return this.baseUrl || normalizeBaseUrl(process.env.LIVE_SCORE_API_URL)
  }

  async request(path, context = {}) {
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('Fetch API is not available in this runtime')
    }
    const baseUrl = this.getBaseUrl()
    if (!baseUrl) {
      throw new Error('LIVE_SCORE_API_URL is required for live score sync')
    }
    const startedAt = Date.now()
    const requestUrl = `${baseUrl}${path}`
    await recordLiveScoreLog(context, {
      step: 'scraper-request',
      status: 'started',
      message: `Calling scraper ${path}`,
      matchId: context.matchId,
      tournamentId: context.tournamentId,
      providerMatchId: context.providerMatchId,
      details: {
        fn: 'LiveScoreProviderService.request',
        method: 'GET',
        url: requestUrl,
        route: path,
        path,
        params: {
          matchId: context.providerMatchId || null,
        },
      },
    })
    try {
      const response = await this.fetchImpl(requestUrl)
      const payload = await response.json().catch(() => null)
      const durationMs = Date.now() - startedAt
      if (!response.ok || payload?.success === false) {
        recordScraperCall(context, {
          route: path,
          status: 'failed',
          httpStatus: response.status,
          durationMs,
          error: payload?.error || payload?.message || 'Live score API request failed',
          response: summarizeScraperPayload(payload),
        })
        await recordLiveScoreLog(context, {
          level: 'warn',
          step: 'scraper-request',
          status: 'failed',
          matchId: context.matchId,
          tournamentId: context.tournamentId,
          providerMatchId: context.providerMatchId,
          message: payload?.error || payload?.message || 'Live score API request failed',
          details: {
            fn: 'LiveScoreProviderService.request',
            method: 'GET',
            url: requestUrl,
            route: path,
            path,
            params: {
              matchId: context.providerMatchId || null,
            },
            httpStatus: response.status,
            durationMs,
            responseBody: stringifyForLog(payload),
          },
        })
        throw new Error(payload?.error || payload?.message || 'Live score API request failed')
      }
      recordScraperCall(context, {
        route: path,
        status: 'success',
        httpStatus: response.status,
        durationMs,
        response: summarizeScraperPayload(payload),
      })
      await recordLiveScoreLog(context, {
        step: 'scraper-request',
        status: 'success',
        matchId: context.matchId,
        tournamentId: context.tournamentId,
        providerMatchId: context.providerMatchId,
        message: `Scraper ${path} returned data`,
        details: {
          fn: 'LiveScoreProviderService.request',
          method: 'GET',
          url: requestUrl,
          route: path,
          path,
          params: {
            matchId: context.providerMatchId || null,
          },
          httpStatus: response.status,
          durationMs,
          responseBody: stringifyForLog(payload),
        },
      })
      return payload?.data ?? payload
    } catch (error) {
      if (!error?.message?.includes('Live score API request failed')) {
        recordScraperCall(context, {
          route: path,
          status: 'failed',
          durationMs: Date.now() - startedAt,
          error: error?.message || String(error),
        })
        await recordLiveScoreLog(context, {
          level: 'error',
          step: 'scraper-request',
          status: 'failed',
          matchId: context.matchId,
          tournamentId: context.tournamentId,
          providerMatchId: context.providerMatchId,
          message: error?.message || String(error),
          details: {
            fn: 'LiveScoreProviderService.request',
            method: 'GET',
            url: requestUrl,
            route: path,
            path,
            params: {
              matchId: context.providerMatchId || null,
            },
            durationMs: Date.now() - startedAt,
            responseBody: '',
          },
        })
      }
      throw error
    }
  }

  async getLiveMatches(context = {}) {
    return this.request('/matches/live', context)
  }

  async discoverMatch(
    { teamA, teamB, teamAKey, teamBKey, teamAName, teamBName, startTime },
    context = {},
  ) {
    const matches = await this.getLiveMatches(context)
    const teamAAliases = getTeamAliases(teamA, teamAKey, teamAName)
    const teamBAliases = getTeamAliases(teamB, teamBKey, teamBName)
    const candidates = (Array.isArray(matches) ? matches : []).filter((match) => {
      const status = (match?.status || '').toString().trim()
      const titleText = getProviderTitleText(match)
      return (
        match?.matchId &&
        isProviderDiscoverableMatchStatus(status) &&
        titleContainsTeam(titleText, teamAAliases) &&
        titleContainsTeam(titleText, teamBAliases) &&
        isWithinHours(match.startTime, startTime, 12)
      )
    })

    if (candidates.length === 1) {
      return {
        ok: true,
        match: candidates[0],
        providerMatchId: String(candidates[0].matchId),
      }
    }

    return {
      ok: false,
      reason: candidates.length
        ? 'multiple provider matches matched this fixture'
        : 'no high-confidence provider match found',
      candidates,
    }
  }

  async getScorecard(matchId, context = {}) {
    const externalMatchId = (matchId || '').toString().trim()
    if (!externalMatchId) throw new Error('External matchId is required')
    return this.request(`/scorecard/${encodeURIComponent(externalMatchId)}`, {
      ...context,
      providerMatchId: externalMatchId,
    })
  }

  async getPlayingXi(matchId, context = {}) {
    const externalMatchId = (matchId || '').toString().trim()
    if (!externalMatchId) throw new Error('External matchId is required')
    return this.request(`/playing-xi/${encodeURIComponent(externalMatchId)}`, {
      ...context,
      providerMatchId: externalMatchId,
    })
  }

  async getPlayerStats(matchId, context = {}) {
    const scorecard = await this.getScorecard(matchId, context)
    return {
      scorecard,
      playerStats: scorecardToPlayerStats(scorecard),
    }
  }
}

export {
  LiveScoreProviderService,
  getTeamAliases,
  isProviderCompletedStatus,
  isProviderActiveScorecard,
  isProviderDiscoverableMatchStatus,
  isProviderLiveStatus,
  playingXiToMatchLineups,
  scorecardToPlayerStats,
}
export default new LiveScoreProviderService()
