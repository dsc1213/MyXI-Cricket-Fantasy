import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbQueryMock = vi.fn()
const getPlayingXiMock = vi.fn()

vi.mock('../src/db.js', () => ({
  dbQuery: dbQueryMock,
}))

vi.mock('../src/live-score/provider.service.js', () => ({
  default: {
    getPlayingXi: getPlayingXiMock,
  },
  playingXiToMatchLineups: () => ({
    PBKS: {
      playingXI: ['Shreyas Iyer'],
      impactPlayers: ['Vijaykumar Vyshak'],
      bench: [],
      providerPlayers: [{ name: 'Vijaykumar Vyshak', playerId: '10486' }],
    },
    GT: {
      playingXI: ['Jason Holder'],
      impactPlayers: [],
      bench: [],
      providerPlayers: [],
    },
  }),
}))

vi.mock('../src/live-score/logger.js', () => ({
  recordLiveScoreDbWrite: vi.fn(),
  recordLiveScoreLog: vi.fn(),
}))

const { appendScoredPlayersToLineups } = await import(
  '../src/live-score/lineup-impact.service.js'
)

describe('live score impact player sync', () => {
  beforeEach(() => {
    dbQueryMock.mockReset()
    getPlayingXiMock.mockReset()
    getPlayingXiMock.mockResolvedValue({ teams: [] })
  })

  it('appends provider impact scores to the closest local squad player name', async () => {
    const result = await appendScoredPlayersToLineups({
      match: {
        id: '47',
        tournamentId: '2',
        providerMatchId: '152009',
        name: 'GT vs PBKS',
        teamAKey: 'GT',
        teamBKey: 'PBKS',
      },
      lineupContext: {
        lineupRows: [
          { teamCode: 'PBKS', playingXI: JSON.stringify(['Shreyas Iyer']) },
          { teamCode: 'GT', playingXI: JSON.stringify(['Jason Holder']) },
        ],
        playingXiNames: ['Shreyas Iyer', 'Jason Holder'],
      },
      playerStats: [{ playerName: 'Vijaykumar Vyshak', wickets: 2 }],
      tournamentContext: {
        tournamentPlayerRows: [
          { id: 'pbks-1', displayName: 'Shreyas Iyer', teamKey: 'PBKS' },
          { id: 'pbks-2', displayName: 'Vyshak Vijaykumar', teamKey: 'PBKS' },
          { id: 'gt-1', displayName: 'Jason Holder', teamKey: 'GT' },
        ],
      },
      context: {},
    })

    expect(dbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE match_lineups'),
      expect.arrayContaining([
        JSON.stringify(['Shreyas Iyer', 'Vyshak Vijaykumar']),
        expect.any(String),
        '2',
        '47',
        'PBKS',
      ]),
    )
    expect(result).toEqual(
      expect.objectContaining({
        added: 1,
        players: [{ teamCode: 'PBKS', name: 'Vyshak Vijaykumar' }],
      }),
    )
  })
})
