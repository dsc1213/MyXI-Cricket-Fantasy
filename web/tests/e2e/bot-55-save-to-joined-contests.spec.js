import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

const buildPlayer = (id, name, role, team, totalPoints = 0) => ({
  id: String(id),
  name,
  role,
  team,
  totalPoints,
  imageUrl: '',
})

test.describe('55) Save to joined contests', () => {
  test('saving to joined contests should save current and other joined contest for the same match', async ({
    page,
  }) => {
    const saveBodies = []

    const poolPayload = {
      contest: {
        id: '101',
        tournamentId: '2',
        name: 'Current Contest',
      },
      activeMatch: {
        id: '55',
        home: 'RCB',
        away: 'GT',
        startAt: '2026-04-25T14:00:00.000Z',
        status: 'notstarted',
      },
      selection: null,
      teams: {
        teamA: {
          name: 'RCB',
          players: [
            buildPlayer(1, 'RCB Keeper', 'WK', 'RCB', 100),
            buildPlayer(2, 'RCB Batter 1', 'BAT', 'RCB', 90),
            buildPlayer(3, 'RCB Batter 2', 'BAT', 'RCB', 80),
            buildPlayer(4, 'RCB All Rounder 1', 'AR', 'RCB', 70),
            buildPlayer(5, 'RCB All Rounder 2', 'AR', 'RCB', 60),
            buildPlayer(6, 'RCB Bowler 1', 'BOWL', 'RCB', 50),
          ],
        },
        teamB: {
          name: 'GT',
          players: [
            buildPlayer(7, 'GT Keeper', 'WK', 'GT', 100),
            buildPlayer(8, 'GT Batter 1', 'BAT', 'GT', 90),
            buildPlayer(9, 'GT Batter 2', 'BAT', 'GT', 80),
            buildPlayer(10, 'GT All Rounder 1', 'AR', 'GT', 70),
            buildPlayer(11, 'GT Bowler 1', 'BOWL', 'GT', 60),
          ],
        },
      },
    }

    await loginUi(page, 'player')

    await page.route('**/team-pool**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(poolPayload),
      })
    })

    await page.route('**/contests**', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('joined') !== 'true') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: '101',
            name: 'Current Contest',
            matchIds: ['55'],
          },
          {
            id: '202',
            name: 'Weekly Side Contest',
            matchIds: ['55'],
          },
          {
            id: '303',
            name: 'Different Match Contest',
            matchIds: ['99'],
          },
        ]),
      })
    })

    await page.route('**/team-selection/save', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}')
      saveBodies.push(body)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          saved: true,
          selection: {
            ...body,
          },
        }),
      })
    })

    await page.goto('/fantasy/select?contest=101&match=55&mode=add', {
      waitUntil: 'domcontentloaded',
    })

    const addButtons = page.locator('.player-tile .tile-btn:not(.backup)')
    await expect(addButtons).toHaveCount(11)
    for (let index = 0; index < 11; index += 1) {
      await addButtons.nth(index).click()
    }

    await expect(page.getByRole('button', { name: 'Save to joined contests' })).toBeVisible()

    await page.getByRole('button', { name: /Preview & Save \(11\/11\)/ }).click()
    await page.locator('.team-preview-modal .captain-btn').nth(0).click()
    await page.locator('.team-preview-modal .vice-captain-btn').nth(1).click()

    await page
      .locator('.team-preview-modal')
      .getByRole('button', { name: 'Save to joined contests' })
      .click()
    await expect(page.getByText('Weekly Side Contest')).toBeVisible()
    await expect(page.getByText('Current Contest')).toBeVisible()

    await page.getByRole('button', { name: 'Save to 2 contests' }).click()

    await expect.poll(() => saveBodies.length).toBe(2)
    expect(saveBodies.map((entry) => String(entry.contestId)).sort()).toEqual(['101', '202'])
    expect(saveBodies.every((entry) => String(entry.matchId) === '55')).toBe(true)
    expect(saveBodies.every((entry) => Array.isArray(entry.playingXi) && entry.playingXi.length === 11)).toBe(
      true,
    )
  })
})
