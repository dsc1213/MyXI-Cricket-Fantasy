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
})
