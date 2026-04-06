import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

test.describe('2) Role-gated navigation', () => {
  test('master/admin/player/contest-manager controls visibility', async ({ page }) => {
    await loginUi(page, 'master')
    await expect(page.getByRole('button', { name: 'User Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tournament Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Contest Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Score Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'All Pages' })).toBeVisible()

    await loginUi(page, 'admin')
    await expect(page.getByRole('button', { name: 'User Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Tournament Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Contest Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Score Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'All Pages' })).toHaveCount(0)

    await loginUi(page, 'contestmgr')
    await expect(page.getByRole('button', { name: 'Score Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'User Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Tournament Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Contest Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toHaveCount(0)

    await loginUi(page, 'player')
    await expect(page.getByRole('button', { name: 'User Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Tournament Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Contest Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Score Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toHaveCount(0)
  })

  test('admin can access tournament delete action in tournament manager table', async ({
    page,
  }) => {
    await loginUi(page, 'admin')
    await page.goto('/home?panel=tournamentManager')

    const tournamentRow = page
      .locator('.catalog-table tbody tr', { hasText: 'T20 World Cup 2026' })
      .first()
    await expect(tournamentRow).toBeVisible()
    await expect(tournamentRow.getByRole('button', { name: 'Delete' })).toBeVisible()
  })
})
