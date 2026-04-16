import { expect, request as playwrightRequest, test } from '@playwright/test'
import { apiCall, createContest, deleteContestIfPresent } from './helpers/mock-e2e.js'

const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'
const MASTER_LOGIN =
  process.env.PW_DB_MASTER_LOGIN || process.env.PW_E2E_MASTER_LOGIN || 'master'
const MASTER_PASSWORD =
  process.env.PW_DB_MASTER_PASSWORD || process.env.PW_E2E_MASTER_PASSWORD || 'demo123'

const createTournamentViaApi = async ({ request, tournamentId, name, matches }) =>
  apiCall(
    request,
    'POST',
    '/admin/tournaments',
    {
      actorUserId: 'master',
      tournamentId,
      name,
      season: '2026',
      source: 'json',
      matches,
    },
    201,
  )

test('backup players replace non-playing XI picks when playing XI is announced', async ({
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `backup-transition-tour-${tag}`
  let contestId = ''
  let authedRequest = null

  try {
    const auth = await apiCall(
      request,
      'POST',
      '/auth/login',
      { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
      200,
    )

    authedRequest = await playwrightRequest.newContext({
      baseURL: E2E_API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await createTournamentViaApi({
      request: authedRequest,
      tournamentId,
      name: `Backup Transition Tournament ${tag}`,
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'KKR',
          away: 'PBKS',
          date: tomorrow.toISOString().slice(0, 10),
          startAt: tomorrow.toISOString(),
          venue: 'Kolkata',
          status: 'notstarted',
        },
      ],
    })

    const matchOptions = await apiCall(
      authedRequest,
      'GET',
      `/admin/contest-match-options?tournamentId=${tournamentId}`,
      undefined,
      200,
    )
    const matchId = String(matchOptions?.[0]?.id || '')
    expect(matchId).toBeTruthy()

    const contest = await createContest({
      request: authedRequest,
      tournamentId,
      name: `Backup Transition Contest ${tag}`,
      matchIds: [matchId],
    })
    contestId = contest.id

    await apiCall(
      authedRequest,
      'POST',
      `/contests/${contestId}/join`,
      { userId: MASTER_LOGIN },
      200,
    )

    const teamPool = await apiCall(
      authedRequest,
      'GET',
      `/team-pool?contestId=${contestId}&matchId=${matchId}&userId=${encodeURIComponent(MASTER_LOGIN)}`,
      undefined,
      200,
    )

    const teamAName = teamPool?.teams?.teamA?.name
    const teamBName = teamPool?.teams?.teamB?.name
    const teamAPlayers = teamPool?.teams?.teamA?.players || []
    const teamBPlayers = teamPool?.teams?.teamB?.players || []

    expect(teamAPlayers.length).toBeGreaterThanOrEqual(13)
    expect(teamBPlayers.length).toBeGreaterThanOrEqual(11)

    const activeTeamA = teamAPlayers.slice(0, 11)
    const excludedA = teamAPlayers.slice(11, 13)
    const backupsToPromote = activeTeamA.slice(0, 2)

    expect(excludedA.length).toBe(2)

    const initialPlayingXi = [
      excludedA[0].id,
      excludedA[1].id,
      ...teamBPlayers.slice(0, 9).map((player) => player.id),
    ]
    expect(initialPlayingXi.length).toBe(11)

    await apiCall(
      authedRequest,
      'POST',
      '/team-selection/save',
      {
        contestId,
        matchId,
        userId: MASTER_LOGIN,
        playingXi: initialPlayingXi,
        backups: backupsToPromote.map((player) => player.id),
        captainId: excludedA[0].id,
        viceCaptainId: excludedA[1].id,
      },
      200,
    )

    const picksBeforeTransition = await apiCall(
      authedRequest,
      'GET',
      `/users/${encodeURIComponent(MASTER_LOGIN)}/picks?tournamentId=${tournamentId}&contestId=${contestId}&matchId=${matchId}`,
      undefined,
      200,
    )
    expect(picksBeforeTransition?.picks || []).toContain(excludedA[0].name)
    expect(picksBeforeTransition?.picks || []).toContain(excludedA[1].name)
    expect(picksBeforeTransition?.backups || []).toContain(backupsToPromote[0].name)

    await apiCall(
      authedRequest,
      'POST',
      '/admin/match-lineups/upsert',
      {
        actorUserId: 'master',
        tournamentId,
        matchId,
        lineups: {
          [teamAName]: {
            squad: teamAPlayers.map((player) => player.name),
            playingXI: activeTeamA.slice(0, 11).map((player) => player.name),
            bench: excludedA.map((player) => player.name),
          },
          [teamBName]: {
            squad: teamBPlayers.map((player) => player.name),
            playingXI: teamBPlayers.slice(0, 11).map((player) => player.name),
            bench: [],
          },
        },
      },
      200,
    )

    const upsertResult = await apiCall(
      authedRequest,
      'POST',
      '/admin/match-lineups/upsert',
      {
        actorUserId: 'master',
        tournamentId,
        matchId,
        lineups: {
          [teamAName]: {
            squad: teamAPlayers.map((player) => player.name),
            playingXI: activeTeamA.slice(0, 11).map((player) => player.name),
            bench: excludedA.map((player) => player.name),
          },
          [teamBName]: {
            squad: teamBPlayers.map((player) => player.name),
            playingXI: teamBPlayers.slice(0, 11).map((player) => player.name),
            bench: [],
          },
        },
      },
      200,
    )
    expect(Number(upsertResult?.autoReplacement?.updatedSelections || 0)).toBeGreaterThan(
      0,
    )

    const picksAfterTransition = await apiCall(
      authedRequest,
      'GET',
      `/users/${encodeURIComponent(MASTER_LOGIN)}/picks?tournamentId=${tournamentId}&contestId=${contestId}&matchId=${matchId}`,
      undefined,
      200,
    )

    const pickNames = picksAfterTransition?.picks || []
    const backupNames = picksAfterTransition?.backups || []

    expect(pickNames).toContain(backupsToPromote[0].name)
    expect(pickNames).toContain(backupsToPromote[1].name)
    expect(pickNames).not.toContain(excludedA[0].name)
    expect(pickNames).not.toContain(excludedA[1].name)

    expect(backupNames).not.toContain(backupsToPromote[0].name)
    expect(backupNames).not.toContain(backupsToPromote[1].name)

    expect((picksAfterTransition?.picksDetailed || []).length).toBe(11)
    expect((picksAfterTransition?.backupsDetailed || []).length).toBe(2)

    const autoSwappedRows = (picksAfterTransition?.picksDetailed || []).filter(
      (row) => row?.autoSwapped,
    )
    expect(autoSwappedRows).toHaveLength(2)
    expect(autoSwappedRows.map((row) => row.name).sort()).toEqual(
      backupsToPromote.map((player) => player.name).sort(),
    )
    const captainReplacementRow = autoSwappedRows.find((row) => row.roleTag === 'C')
    const viceCaptainReplacementRow = autoSwappedRows.find((row) => row.roleTag === 'VC')
    expect(captainReplacementRow?.name).toBe(backupsToPromote[0].name)
    expect(viceCaptainReplacementRow?.name).toBe(backupsToPromote[1].name)
    const replacementInfoByName = new Map(
      autoSwappedRows.map((row) => [row.name, row.replacementInfo || '']),
    )
    expect(replacementInfoByName.get(backupsToPromote[0].name)).toContain(
      excludedA[0].name,
    )
    expect(replacementInfoByName.get(backupsToPromote[1].name)).toContain(
      excludedA[1].name,
    )
  } finally {
    if (authedRequest) {
      await deleteContestIfPresent(authedRequest, contestId, 'master')
      await authedRequest.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
      await authedRequest.dispose()
    }
  }
})

test('backup replacement runs when force backups is called after playing XI announcement', async ({
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `backup-lineup-after-start-tour-${tag}`
  let contestId = ''
  let authedRequest = null

  try {
    const auth = await apiCall(
      request,
      'POST',
      '/auth/login',
      { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
      200,
    )

    authedRequest = await playwrightRequest.newContext({
      baseURL: E2E_API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    })

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await createTournamentViaApi({
      request: authedRequest,
      tournamentId,
      name: `Backup Lineup After Start Tournament ${tag}`,
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'KKR',
          away: 'PBKS',
          date: tomorrow.toISOString().slice(0, 10),
          startAt: tomorrow.toISOString(),
          venue: 'Kolkata',
          status: 'notstarted',
        },
      ],
    })

    const matchOptions = await apiCall(
      authedRequest,
      'GET',
      `/admin/contest-match-options?tournamentId=${tournamentId}`,
      undefined,
      200,
    )
    const matchId = String(matchOptions?.[0]?.id || '')
    expect(matchId).toBeTruthy()

    const contest = await createContest({
      request: authedRequest,
      tournamentId,
      name: `Backup Lineup After Start Contest ${tag}`,
      matchIds: [matchId],
    })
    contestId = contest.id

    await apiCall(
      authedRequest,
      'POST',
      `/contests/${contestId}/join`,
      { userId: MASTER_LOGIN },
      200,
    )

    const teamPool = await apiCall(
      authedRequest,
      'GET',
      `/team-pool?contestId=${contestId}&matchId=${matchId}&userId=${encodeURIComponent(MASTER_LOGIN)}`,
      undefined,
      200,
    )

    const teamAName = teamPool?.teams?.teamA?.name
    const teamBName = teamPool?.teams?.teamB?.name
    const teamAPlayers = teamPool?.teams?.teamA?.players || []
    const teamBPlayers = teamPool?.teams?.teamB?.players || []

    expect(teamAPlayers.length).toBeGreaterThanOrEqual(13)
    expect(teamBPlayers.length).toBeGreaterThanOrEqual(11)

    const activeTeamA = teamAPlayers.slice(0, 11)
    const excludedA = teamAPlayers.slice(11, 13)
    const backupsToPromote = activeTeamA.slice(0, 2)

    const initialPlayingXi = [
      excludedA[0].id,
      excludedA[1].id,
      ...teamBPlayers.slice(0, 9).map((player) => player.id),
    ]
    expect(initialPlayingXi.length).toBe(11)

    await apiCall(
      authedRequest,
      'POST',
      '/team-selection/save',
      {
        contestId,
        matchId,
        userId: MASTER_LOGIN,
        playingXi: initialPlayingXi,
        backups: backupsToPromote.map((player) => player.id),
        captainId: excludedA[0].id,
        viceCaptainId: excludedA[1].id,
      },
      200,
    )

    await apiCall(
      authedRequest,
      'POST',
      '/admin/match-lineups/upsert',
      {
        actorUserId: 'master',
        tournamentId,
        matchId,
        lineups: {
          [teamAName]: {
            squad: teamAPlayers.map((player) => player.name),
            playingXI: activeTeamA.slice(0, 11).map((player) => player.name),
            bench: excludedA.map((player) => player.name),
          },
          [teamBName]: {
            squad: teamBPlayers.map((player) => player.name),
            playingXI: teamBPlayers.slice(0, 11).map((player) => player.name),
            bench: [],
          },
        },
      },
      200,
    )

    const picksBeforeForce = await apiCall(
      authedRequest,
      'GET',
      `/users/${encodeURIComponent(MASTER_LOGIN)}/picks?tournamentId=${tournamentId}&contestId=${contestId}&matchId=${matchId}`,
      undefined,
      200,
    )
    expect(picksBeforeForce?.picks || []).toContain(excludedA[0].name)
    expect(picksBeforeForce?.picks || []).toContain(excludedA[1].name)

    const forceResult = await apiCall(
      authedRequest,
      'POST',
      `/admin/matches/${matchId}/replace-backups`,
      {},
      200,
    )
    expect(Number(forceResult?.autoReplacement?.updatedSelections || 0)).toBeGreaterThan(
      0,
    )

    const picksAfterUpsert = await apiCall(
      authedRequest,
      'GET',
      `/users/${encodeURIComponent(MASTER_LOGIN)}/picks?tournamentId=${tournamentId}&contestId=${contestId}&matchId=${matchId}`,
      undefined,
      200,
    )

    const pickNames = picksAfterUpsert?.picks || []
    const backupNames = picksAfterUpsert?.backups || []

    expect(pickNames).toContain(backupsToPromote[0].name)
    expect(pickNames).toContain(backupsToPromote[1].name)
    expect(pickNames).not.toContain(excludedA[0].name)
    expect(pickNames).not.toContain(excludedA[1].name)

    expect(backupNames).not.toContain(backupsToPromote[0].name)
    expect(backupNames).not.toContain(backupsToPromote[1].name)
  } finally {
    if (authedRequest) {
      await deleteContestIfPresent(authedRequest, contestId, 'master')
      await authedRequest.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
      await authedRequest.dispose()
    }
  }
})
