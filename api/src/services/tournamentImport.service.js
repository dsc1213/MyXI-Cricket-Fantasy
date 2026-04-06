const normalizeTournamentId = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeTeamCode = (value = '') =>
  value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const normalizeMatchStatus = (value = '') => {
  const normalized = (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (!normalized) return 'notstarted'
  if (['scheduled', 'upcoming', 'open', 'notstarted'].includes(normalized))
    return 'notstarted'
  if (['live', 'inprogress', 'started'].includes(normalized)) return 'inprogress'
  if (['done', 'complete', 'completed', 'closed', 'finished'].includes(normalized))
    return 'completed'
  return 'notstarted'
}

const normalizeImportedStartAt = (startAt = '', timezone = 'UTC') => {
  const raw = (startAt || '').toString().trim()
  if (!raw) return ''
  if (raw.endsWith('Z') || /[+-]\d\d:\d\d$/.test(raw)) {
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
  }
  if ((timezone || '').toString().trim() === 'Asia/Kolkata') {
    const parsed = new Date(`${raw}:00+05:30`)
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
  }
  const parsed = new Date(`${raw}:00Z`)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

const deriveMatchStatus = ({ startAt = '', date = '', explicitStatus = '' } = {}) => {
  const normalizedExplicit = normalizeMatchStatus(explicitStatus)
  const hasExplicitStatus = Boolean((explicitStatus || '').toString().trim())

  const normalizedStart = normalizeImportedStartAt(startAt)
  if (normalizedStart) {
    const parsed = new Date(normalizedStart)
    if (!Number.isNaN(parsed.getTime())) {
      const hasStarted = parsed.getTime() <= Date.now()
      if (hasExplicitStatus) {
        if (normalizedExplicit === 'completed') return 'completed'
        if (normalizedExplicit === 'notstarted' && hasStarted) return 'inprogress'
        if (normalizedExplicit === 'inprogress' && !hasStarted) return 'notstarted'
        return normalizedExplicit
      }
      return hasStarted ? 'inprogress' : 'notstarted'
    }
  }

  if (hasExplicitStatus) return normalizedExplicit

  const fallbackDate = (date || '').toString().trim()
  if (!fallbackDate) return 'notstarted'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const matchDate = new Date(fallbackDate)
  matchDate.setHours(0, 0, 0, 0)
  if (matchDate < today) return 'completed'
  if (matchDate.getTime() === today.getTime()) return 'inprogress'
  return 'notstarted'
}

const normalizeImportedSquadEntry = (entry) => {
  if (typeof entry === 'string') return entry.toString().trim()
  if (!entry || typeof entry !== 'object') return ''
  return {
    ...entry,
    id: (entry.id || '').toString().trim(),
    name: (entry.name || entry.playerName || entry.fullName || entry.displayName || '')
      .toString()
      .trim(),
    role: (entry.role || '').toString().trim().toUpperCase(),
    team: (entry.team || entry.teamCode || '').toString().trim(),
    teamName: (entry.teamName || '').toString().trim(),
    country: (entry.country || entry.nationality || '').toString().trim(),
    imageUrl: (entry.imageUrl || '').toString().trim(),
    battingStyle: (entry.battingStyle || '').toString().trim(),
    bowlingStyle: (entry.bowlingStyle || '').toString().trim(),
    active: entry.active !== false,
  }
}

const buildImportedTournamentPayload = ({
  payload = {},
  fallbackSeason = '2026',
  fallbackSource = 'manual',
  requestedTournamentId = '',
  getFallbackSquad = () => null,
} = {}) => {
  const payloadName = (payload.name || '').toString().trim()
  const payloadSeason = (payload.season || fallbackSeason || '2026').toString().trim()
  const rawMatches = Array.isArray(payload.matches) ? payload.matches : []

  if (!payloadName) {
    throw new Error('Tournament name is required')
  }
  if (!rawMatches.length) {
    throw new Error('At least one match is required')
  }

  const normalizedTournamentId = normalizeTournamentId(
    requestedTournamentId || payload.tournamentId || `${payloadName}-${payloadSeason}`,
  )

  const normalizedMatches = rawMatches
    .map((row, index) => {
      const matchNo = Number(row?.matchNo || index + 1)
      const home = normalizeTeamCode(row?.home || row?.homeTeam || '')
      const away = normalizeTeamCode(row?.away || row?.awayTeam || '')
      if (!home || !away) return null
      if (home === away) return null
      const date = (row?.date || '').toString().trim()
      const startAtRaw = (row?.startAt || row?.startDateTime || '').toString().trim()
      const timezone = (row?.timezone || 'UTC').toString().trim()
      const startAt = startAtRaw
        ? normalizeImportedStartAt(startAtRaw, timezone)
        : `${date || '2099-01-01'}T00:00:00.000Z`
      const status = deriveMatchStatus({
        startAt,
        date,
        explicitStatus: row?.status || '',
      })
      const fallbackSquadA = getFallbackSquad(home)?.squad || []
      const fallbackSquadB = getFallbackSquad(away)?.squad || []
      return {
        id: (row?.id || `m${matchNo}`).toString(),
        matchNo,
        home,
        away,
        teamA: home,
        teamB: away,
        teamAKey: home,
        teamBKey: away,
        name: row?.name || `Match ${matchNo}: ${home} vs ${away}`,
        date: date || startAt.slice(0, 10),
        startAt,
        timezone,
        status,
        venue: (row?.venue || '').toString().trim(),
        location: (row?.location || '').toString().trim(),
        stage: (row?.stage || 'league').toString().trim() || 'league',
        stageLabel: (row?.stageLabel || 'League').toString().trim() || 'League',
        squadA: Array.isArray(row?.squadA)
          ? row.squadA.map((item) => normalizeImportedSquadEntry(item)).filter(Boolean)
          : [...fallbackSquadA],
        squadB: Array.isArray(row?.squadB)
          ? row.squadB.map((item) => normalizeImportedSquadEntry(item)).filter(Boolean)
          : [...fallbackSquadB],
        playingXiA: Array.isArray(row?.playingXiA)
          ? row.playingXiA.map((item) => item.toString())
          : [],
        playingXiB: Array.isArray(row?.playingXiB)
          ? row.playingXiB.map((item) => item.toString())
          : [],
        locked: status !== 'notstarted',
        hasTeam: false,
        sourceKey: (row?.sourceKey || row?.id || `m${matchNo}`).toString(),
      }
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.matchNo || 0) - Number(b.matchNo || 0))

  if (!normalizedMatches.length) {
    throw new Error('Matches must include valid teams')
  }
  if (normalizedMatches.length !== rawMatches.length) {
    throw new Error(
      'Each match must include distinct valid home/away team codes and a valid startAt/date',
    )
  }

  return {
    tournament: {
      id: normalizedTournamentId || `tournament-${Date.now()}`,
      name: payloadName,
      season: payloadSeason,
      source:
        (payload.source || fallbackSource).toString().trim().toLowerCase() || 'manual',
      tournamentType: (payload.tournamentType || 'international')
        .toString()
        .trim()
        .toLowerCase(),
      country: (payload.country || '').toString().trim().toLowerCase(),
      league: (payload.league || '').toString().trim(),
      selectedTeams: Array.isArray(payload.selectedTeams)
        ? payload.selectedTeams.map((item) => normalizeTeamCode(item)).filter(Boolean)
        : [],
    },
    matches: normalizedMatches,
  }
}

const getDerivedMatchStatus = (match) =>
  deriveMatchStatus({
    startAt: match?.startAt || match?.startTime || '',
    date: match?.date || '',
    explicitStatus: match?.status || '',
  })

const mapMatchWithDerivedStatus = (match) => {
  const status = getDerivedMatchStatus(match)
  return {
    ...match,
    status,
    locked: status !== 'notstarted',
  }
}

export {
  buildImportedTournamentPayload,
  deriveMatchStatus,
  getDerivedMatchStatus,
  mapMatchWithDerivedStatus,
  normalizeImportedStartAt,
  normalizeMatchStatus,
  normalizeTeamCode,
  normalizeTournamentId,
}
