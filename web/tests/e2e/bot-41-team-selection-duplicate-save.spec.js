import { expect, test } from '@playwright/test'
import { apiCall } from './helpers/mock-e2e.js'

test('team-selection/save updates existing row instead of duplicate insert conflict', async ({
  request,
}) => {
  const contests = await apiCall(
    request,
    'GET',
    '/contests?game=Fantasy&userId=HunterCherryXI',
    undefined,
    200,
  )
  const contest = (contests || []).find((row) => String(row?.id || '').trim())
  expect(contest).toBeTruthy()

  const contestId = String(contest.id)
  const matches = await apiCall(
    request,
    'GET',
    `/contests/${contestId}/matches?userId=HunterCherryXI`,
    undefined,
    200,
  )
  const match = (matches || []).find((row) => String(row?.id || '').trim())
  expect(match).toBeTruthy()

  const matchId = String(match.id)
  const teamPool = await apiCall(
    request,
    'GET',
    `/team-pool?contestId=${encodeURIComponent(contestId)}&matchId=${encodeURIComponent(matchId)}&userId=HunterCherryXI`,
    undefined,
    200,
  )

  const teamA = teamPool?.teams?.teamA?.players || []
  const teamB = teamPool?.teams?.teamB?.players || []
  const allPlayers = [...teamA, ...teamB]
  expect(allPlayers.length).toBeGreaterThanOrEqual(16)

  const playingXi = allPlayers.slice(0, 11).map((player) => String(player.id))
  const backups = allPlayers.slice(11, 16).map((player) => String(player.id))

  const firstSave = await request.fetch('http://127.0.0.1:4000/team-selection/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      matchId,
      userId: 'HunterCherryXI',
      actorUserId: 'HunterCherryXI',
      playingXi,
      backups,
      captainId: playingXi[0],
      viceCaptainId: playingXi[1],
    },
  })
  expect(firstSave.status()).toBe(200)

  const secondSave = await request.fetch('http://127.0.0.1:4000/team-selection/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      contestId,
      matchId,
      userId: 'HunterCherryXI',
      actorUserId: 'HunterCherryXI',
      playingXi,
      backups,
      captainId: playingXi[0],
      viceCaptainId: playingXi[1],
    },
  })
  const secondBody = await secondSave.json()

  expect(secondSave.status()).toBe(200)
  expect(secondBody?.saved).toBe(true)
  expect(String(secondBody?.selection?.matchId || '')).toBe(matchId)
  expect(String(secondBody?.selection?.userId || '')).toBeTruthy()
})
