import { describe, expect, it } from 'vitest'
import {
  LiveScoreProviderService,
  getTeamAliases,
  isProviderActiveScorecard,
  isProviderCompletedStatus,
  isProviderDiscoverableMatchStatus,
  isProviderLiveStatus,
  playingXiToMatchLineups,
  scorecardToPlayerStats,
} from '../src/live-score/provider.service.js'
import {
  canonicalizeLineupNamesWithSquad,
  canonicalizePlayerStatsWithSquad,
  resolvePlayerNameFromSquad,
} from '../src/live-score/player-name-match.js'

describe('live score provider', () => {
  it('converts Cricbuzz scorecard rows into match player stats', () => {
    const rows = scorecardToPlayerStats({
      innings: [
        {
          totalScore: '20/1 (3 Ov)',
          batting: [
            {
              name: 'A Batter',
              dismissal: 'c Keeper b Bowler',
              runs: '42',
              balls: '27',
              fours: '5',
              sixes: '1',
            },
          ],
          bowling: [
            {
              name: 'A Batter',
              overs: '2.0',
              maidens: '1',
              runs: '8',
              wickets: '2',
              wides: '2',
              noBalls: '1',
              hatTrick: true,
            },
          ],
        },
      ],
    })

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerName: 'A Batter',
          runs: 42,
          ballsFaced: 27,
          battingOrder: 1,
          inningsRuns: 20,
          inningsWickets: 1,
          inningsBalls: 18,
          fours: 5,
          sixes: 1,
          overs: 2,
          maidens: 1,
          runsConceded: 8,
          wickets: 2,
          wides: 2,
          noBalls: 1,
          hatTrick: 1,
          dismissed: true,
        }),
        expect.objectContaining({
          playerName: 'Keeper',
          catches: 1,
        }),
      ]),
    )
  })

  it('converts dismissal text into fielding stats', () => {
    const rows = scorecardToPlayerStats({
      innings: [
        {
          batting: [
            { name: 'Caught Batter', dismissal: 'c Riyan Parag b Yash Raj Punja' },
            { name: 'Stumped Batter', dismissal: 'st Dhruv Jurel b Ravindra Jadeja' },
            { name: 'Direct Runout Batter', dismissal: 'run out (Marcus Stoinis)' },
            {
              name: 'Indirect Runout Batter',
              dismissal: 'run out (Riyan Parag/Dhruv Jurel)',
            },
            { name: 'Bowler Catch Batter', dismissal: 'c & b Marco Jansen' },
            { name: 'Bowler Catch Batter 2', dismissal: 'c and b Mitchell Starc' },
          ],
          bowling: [],
        },
      ],
    })

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerName: 'Riyan Parag', catches: 1 }),
        expect.objectContaining({
          playerName: 'Dhruv Jurel',
          stumpings: 1,
          runoutIndirect: 1,
        }),
        expect.objectContaining({ playerName: 'Marcus Stoinis', runoutDirect: 1 }),
        expect.objectContaining({ playerName: 'Marco Jansen', catches: 1 }),
        expect.objectContaining({ playerName: 'Mitchell Starc', catches: 1 }),
      ]),
    )
  })

  it('uses structured scorecard fielding only when dismissal fielding is unavailable', () => {
    const rows = scorecardToPlayerStats({
      innings: [
        {
          batting: [{ name: 'A Batter', runs: '12', isDismissed: true }],
          bowling: [],
          fielding: [
            { name: 'and', catches: '1', stumpings: '0', runoutDirect: '0', runoutIndirect: '0' },
            {
              name: 'Safe Fielder',
              catches: '2',
              stumpings: '1',
              runoutDirect: '1',
              runoutIndirect: '0',
            },
          ],
        },
      ],
    })

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerName: 'A Batter',
          dismissed: true,
        }),
        expect.objectContaining({
          playerName: 'Safe Fielder',
          catches: 2,
          stumpings: 1,
          runoutDirect: 1,
        }),
      ]),
    )
    expect(rows.some((row) => row.playerName === 'and')).toBe(false)
  })

  it('captures fielding from Cricbuzz IPL-style scorecard dismissals', () => {
    const rows = scorecardToPlayerStats({
      innings: [
        {
          batting: [
            {
              name: 'Prabhsimran Singh',
              dismissal: 'c Riyan Parag b Yash Raj Punja',
              runs: '59',
            },
            {
              name: 'Priyansh Arya',
              dismissal: 'c Nandre Burger b Jofra Archer',
              runs: '29',
            },
            {
              name: 'Cooper Connolly',
              dismissal: 'c Donovan Ferreira b Yash Raj Punja',
              runs: '30',
            },
            {
              name: 'Shreyas Iyer',
              dismissal: 'c Dhruv Jurel b Nandre Burger',
              runs: '30',
            },
          ],
          bowling: [
            { name: 'Yash Raj Punja', wickets: '2' },
            { name: 'Jofra Archer', wickets: '1' },
            { name: 'Nandre Burger', wickets: '1' },
          ],
        },
      ],
    })

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerName: 'Riyan Parag', catches: 1 }),
        expect.objectContaining({ playerName: 'Nandre Burger', catches: 1, wickets: 1 }),
        expect.objectContaining({ playerName: 'Donovan Ferreira', catches: 1 }),
        expect.objectContaining({ playerName: 'Dhruv Jurel', catches: 1 }),
        expect.objectContaining({ playerName: 'Yash Raj Punja', wickets: 2 }),
      ]),
    )
  })

  it('fetches scorecards through the configured base URL', async () => {
    const fetchCalls = []
    const provider = new LiveScoreProviderService({
      baseUrl: 'https://example.test/api/',
      fetchImpl: async (url) => {
        fetchCalls.push(url)
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              title: 'Sample match',
              innings: [],
            },
          }),
        }
      },
    })

    const payload = await provider.getPlayerStats('12345')

    expect(fetchCalls).toEqual(['https://example.test/api/scorecard/12345'])
    expect(payload.scorecard.title).toBe('Sample match')
    expect(payload.playerStats).toEqual([])
  })

  it('fetches playing XI through the configured base URL', async () => {
    const fetchCalls = []
    const provider = new LiveScoreProviderService({
      baseUrl: 'https://example.test/api/',
      fetchImpl: async (url) => {
        fetchCalls.push(url)
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              teams: [
                { teamShortName: 'MI', playingXI: ['A', 'B'] },
                { teamShortName: 'SRH', playingXI: ['C', 'D'] },
              ],
            },
          }),
        }
      },
    })

    const payload = await provider.getPlayingXi('151924')

    expect(fetchCalls).toEqual(['https://example.test/api/playing-xi/151924'])
    expect(payload.teams[0].teamShortName).toBe('MI')
  })

  it('requires an env-provided base URL when no URL is injected', async () => {
    const previousUrl = process.env.LIVE_SCORE_API_URL
    delete process.env.LIVE_SCORE_API_URL
    const provider = new LiveScoreProviderService({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      }),
    })

    await expect(provider.getScorecard('12345')).rejects.toThrow(
      'LIVE_SCORE_API_URL is required',
    )

    if (previousUrl == null) delete process.env.LIVE_SCORE_API_URL
    else process.env.LIVE_SCORE_API_URL = previousUrl
  })

  it('normalizes provider statuses and whole-word completed results', () => {
    expect(isProviderLiveStatus('Live')).toBe(true)
    expect(isProviderLiveStatus('In Progress')).toBe(false)
    expect(isProviderDiscoverableMatchStatus('Toss')).toBe(true)
    expect(isProviderDiscoverableMatchStatus('Mumbai Indians opt to bat')).toBe(true)
    expect(isProviderDiscoverableMatchStatus('Preview')).toBe(false)
    expect(isProviderDiscoverableMatchStatus('CSK Won')).toBe(false)
    expect(isProviderCompletedStatus('Complete')).toBe(true)
    expect(isProviderCompletedStatus('SRH Won')).toBe(true)
    expect(isProviderCompletedStatus('WonXI')).toBe(false)
    expect(isProviderCompletedStatus('WonXI Won')).toBe(true)
  })

  it('treats live scorecard chase text as active without requiring literal Live', () => {
    expect(
      isProviderActiveScorecard({
        status: 'Rajasthan Royals need 179 runs',
        innings: [
          {
            totalScore: '44/0 (3 Ov)',
            batting: [{ name: 'Vaibhav Sooryavanshi', runs: '37', balls: '14' }],
            bowling: [{ name: 'Arshdeep Singh', overs: '1' }],
          },
        ],
      }),
    ).toBe(true)
    expect(isProviderActiveScorecard({ status: 'Preview', innings: [] })).toBe(false)
  })

  it('treats innings-break scorecards as active when first innings has a total', () => {
    expect(
      isProviderActiveScorecard({
        status: 'Innings Break',
        innings: [
          {
            inningsTitle: 'Mumbai Indians Innings',
            totalScore: '159/7 (20 Ov)',
            batting: [],
            bowling: [],
          },
        ],
      }),
    ).toBe(true)
  })

  it('expands abbreviated team aliases for discovery', () => {
    expect(getTeamAliases('KKR')).toContain('kolkata knight riders')
    expect(getTeamAliases('LSG')).toContain('lucknow super giants')
  })

  it('discovers a unique toss/live provider match using team aliases and short title', async () => {
    const provider = new LiveScoreProviderService({
      baseUrl: 'https://example.test/api',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              matchId: '151923',
              title: 'Mumbai Indians vs Sunrisers Hyderabad, 41st Match',
              shortTitle: 'MI vs SRH',
              status: 'Preview',
              startTime: '',
            },
            {
              matchId: '151924',
              title: 'Mumbai Indians vs Sunrisers Hyderabad, 41st Match',
              shortTitle: 'MI vs SRH',
              status: 'Toss',
              startTime: '',
            },
          ],
        }),
      }),
    })

    const result = await provider.discoverMatch({
      teamAKey: 'MI',
      teamBKey: 'SRH',
      startTime: '',
    })

    expect(result.ok).toBe(true)
    expect(result.providerMatchId).toBe('151924')
  })

  it('maps provider playing XI rows to local match team keys', () => {
    const lineups = playingXiToMatchLineups(
      {
        teams: [
          {
            teamName: 'Mumbai Indians',
            playingXI: Array.from({ length: 11 }, (_, index) => ({
              name: `MI Player ${index + 1}`,
              isCaptain: index === 2,
            })),
          },
          {
            teamName: 'Sunrisers Hyderabad',
            playingXI: Array.from({ length: 11 }, (_, index) => `SRH Player ${index + 1}`),
          },
        ],
      },
      {
        teamAKey: 'MI',
        teamBKey: 'SRH',
      },
    )

    expect(lineups.MI.playingXI).toHaveLength(11)
    expect(lineups.MI.captain).toBeUndefined()
    expect(lineups.SRH.playingXI).toHaveLength(11)
  })

  it('maps misleading scraper spellings to existing squad names before save', () => {
    const squad = [
      {
        id: 'rr-1',
        displayName: 'Vaibhav Suryavanshi',
        teamKey: 'RR',
      },
    ]
    const lineup = {
      playingXI: ['Vaibhav Sooryavanshi'],
      impactPlayers: [],
      bench: [],
      providerPlayers: [{ name: 'Vaibhav Sooryavanshi', playerId: '51791' }],
    }

    const resolved = resolvePlayerNameFromSquad('Vaibhav Sooryavanshi', squad)
    expect(resolved?.name).toBe('Vaibhav Suryavanshi')

    canonicalizeLineupNamesWithSquad(lineup, squad)
    expect(lineup.playingXI).toEqual(['Vaibhav Suryavanshi'])
    expect(lineup.providerPlayers[0].name).toBe('Vaibhav Suryavanshi')
  })

  it('maps misleading scraper scorecard names before score validation', () => {
    const rows = canonicalizePlayerStatsWithSquad(
      [{ playerName: 'Vaibhav Sooryavanshi', runs: 34 }],
      [{ id: 'rr-1', displayName: 'Vaibhav Suryavanshi', teamKey: 'RR' }],
    )

    expect(rows).toEqual([
      expect.objectContaining({
        playerName: 'Vaibhav Suryavanshi',
        runs: 34,
      }),
    ])
  })
})
