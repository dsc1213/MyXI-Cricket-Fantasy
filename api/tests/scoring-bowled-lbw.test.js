import { describe, expect, it } from 'vitest'

import {
  buildPlayerIdentityIndex,
  calculateFantasyPointBreakdown,
  calculateFantasyPoints,
  normalizePlayerStatRows,
  resolvePlayerStatPlayer,
} from '../src/scoring.js'

describe('bowled/LBW bowling bonus scoring', () => {
  it('adds configured bonus for wickets taken by bowled or LBW', () => {
    const ruleSet = {
      run: 1,
      four: 1,
      six: 2,
      thirty: 0,
      fifty: 0,
      seventyFive: 0,
      century: 0,
      oneFifty: 0,
      twoHundred: 0,
      duck: 0,
      strikeRate150: 0,
      strikeRate200: 0,
      strikeRate250: 0,
      strikeRateBelow80: 0,
      wicket: 20,
      maiden: 0,
      threew: 0,
      fourw: 0,
      fivew: 0,
      bowledLbw: 5,
      wide: 0,
      economyBelow3: 0,
      economyBelow5: 0,
      economyBelow6: 0,
      economyAbove10: 0,
      economyAbove12: 0,
      hatTrick: 0,
      catch: 10,
      threeCatch: 0,
      stumping: 0,
      twoStumping: 0,
      runoutDirect: 0,
      runoutIndirect: 0,
    }

    const stats = { wickets: 2, bowledLbw: 1 }

    expect(calculateFantasyPoints(stats, ruleSet)).toBe(45)
    expect(calculateFantasyPointBreakdown(stats, ruleSet)).toEqual(
      expect.arrayContaining([
        {
          label: 'Bowled / LBW bonus',
          count: 1,
          valuePerUnit: 5,
          points: 5,
        },
      ]),
    )
  })

  it('resolves reversed provider names to the selected local player', () => {
    const players = [
      {
        id: 10486,
        name: 'Vyshak Vijaykumar',
        team: 'PBKS',
      },
    ]
    const identityIndex = buildPlayerIdentityIndex(players)

    expect(
      resolvePlayerStatPlayer(
        { playerName: 'Vijaykumar Vyshak', wickets: 2 },
        identityIndex,
      ),
    ).toEqual(players[0])

    expect(
      normalizePlayerStatRows(
        [
          { playerName: 'Vijaykumar Vyshak', wickets: 2 },
          { playerName: 'Vyshak Vijaykumar', catches: 1 },
        ],
        players,
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: 10486,
          playerName: 'Vyshak Vijaykumar',
          wickets: 2,
        }),
        expect.objectContaining({
          playerId: 10486,
          playerName: 'Vyshak Vijaykumar',
          catches: 1,
        }),
      ]),
    )
  })
})
