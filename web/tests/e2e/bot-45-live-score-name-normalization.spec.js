import { expect, test } from '@playwright/test'
import { canonicalizeLineupNamesWithSquad } from '../../../api/src/live-score/player-name-match.js'

test('force-sync normalizes an abbreviated MLC lineup name to the tournament squad', () => {
  const lineup = {
    playingXI: ['Gannon'],
    bench: [],
    impactPlayers: [],
  }

  canonicalizeLineupNamesWithSquad(lineup, [
    { id: '899', displayName: 'Cameron Gannon', teamKey: 'SEA' },
  ])

  expect(lineup.playingXI).toEqual(['Cameron Gannon'])
})
