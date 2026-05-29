import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbQueryMock = vi.fn()
const syncPlayingXiMock = vi.fn()
const getScorecardMock = vi.fn()
const buildTournamentScoreContextMock = vi.fn()
const syncLiveMatchScoresMock = vi.fn()
const upsertLiveSyncMock = vi.fn()

vi.mock('../src/db.js', () => ({
  dbQuery: dbQueryMock,
}))

vi.mock('../src/live-score/lineup-sync.service.js', () => ({
  syncPlayingXiForStartedMatch: syncPlayingXiMock,
}))

vi.mock('../src/live-score/provider.service.js', () => ({
  default: {
    getScorecard: getScorecardMock,
    discoverMatch: vi.fn(),
  },
  isProviderActiveScorecard: () => true,
  isProviderCompletedStatus: () => false,
  scorecardToPlayerStats: () => [{ playerName: 'SRH Batter', runs: 10 }],
}))

vi.mock('../src/services/match-score.service.js', () => ({
  default: {
    buildTournamentScoreContext: buildTournamentScoreContextMock,
    syncLiveMatchScores: syncLiveMatchScoresMock,
  },
}))

vi.mock('../src/live-score/lineup-impact.service.js', () => ({
  appendScoredPlayersToLineups: vi.fn(async () => ({ added: 0, players: [] })),
  parseJsonArray: (value) => (typeof value === 'string' ? JSON.parse(value) : value),
}))

vi.mock('../src/live-score/repository.js', () => ({
  default: {
    upsert: upsertLiveSyncMock,
    updateError: vi.fn(),
  },
}))

vi.mock('../src/live-score/activity.service.js', () => ({
  logAutoSyncActivity: vi.fn(),
}))

vi.mock('../src/live-score/logger.js', () => ({
  recordLiveScoreDbWrite: vi.fn(),
  recordLiveScoreLog: vi.fn(),
}))

const { forceSyncScoreForMatch } = await import('../src/live-score/score-sync.service.js')

describe('force score sync lineup hydration', () => {
  beforeEach(() => {
    dbQueryMock.mockReset()
    syncPlayingXiMock.mockReset()
    getScorecardMock.mockReset()
    buildTournamentScoreContextMock.mockReset()
    syncLiveMatchScoresMock.mockReset()
    upsertLiveSyncMock.mockReset()

    syncPlayingXiMock.mockResolvedValue({ synced: true })
    getScorecardMock.mockResolvedValue({ status: 'Live', innings: [] })
    buildTournamentScoreContextMock.mockResolvedValue({ tournamentPlayerRows: [] })
    syncLiveMatchScoresMock.mockResolvedValue({ savedPlayers: 1, fetchedPlayers: 1 })
    upsertLiveSyncMock.mockResolvedValue({})
  })

  it('fetches Playing XI before scorecard when admin force sync has no saved lineups', async () => {
    dbQueryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: '108',
            tournamentId: '2',
            name: 'SRH vs RR',
            teamA: 'SRH',
            teamB: 'RR',
            teamAKey: 'SRH',
            teamBKey: 'RR',
            status: 'completed',
            startTime: '2026-05-27T14:00:00.000Z',
            providerMatchId: '155387',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { teamCode: 'SRH', playingXI: JSON.stringify(['SRH Batter']) },
          { teamCode: 'RR', playingXI: JSON.stringify(['RR Bowler']) },
        ],
      })

    const result = await forceSyncScoreForMatch({
      matchId: '108',
      actorUserId: '1',
      context: {
        scraperCalls: [],
        dbWrites: [],
        liveStatus: {
          matchId: { status: 'pending' },
          pxi: { status: 'pending' },
          latestMatchScores: { status: 'pending' },
        },
      },
    })

    expect(syncPlayingXiMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: '108', tournamentId: '2' }),
      '155387',
      null,
      expect.any(Object),
    )
    expect(getScorecardMock).toHaveBeenCalledWith(
      '155387',
      expect.objectContaining({ matchId: '108', tournamentId: '2' }),
    )
    expect(syncLiveMatchScoresMock).toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })
})
