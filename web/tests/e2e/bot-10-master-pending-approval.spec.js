import { expect, request as playwrightRequest, test } from '@playwright/test'
import {
  apiCall,
  deleteUserIfPresent,
  findUserByGameName,
  getMasterActorUserId,
  loginUi,
  PASSWORD,
} from './helpers/mock-e2e.js'

const MASTER_LOGIN = process.env.PW_E2E_MASTER_LOGIN || process.env.PW_DB_MASTER_LOGIN || 'master'

test.describe('10) Master pending approval flow', () => {
  test.setTimeout(120000)

  test('master reviews pending user details and approves from dashboard', async ({
    page,
    request,
  }) => {
    const tag = `pending-${Date.now()}`
    const pendingUser = {
      name: 'Pending Bot',
      gameName: `mocke2ebot-pending-${tag}`,
      email: `mocke2ebot-pending-${tag}@myxi.local`,
      phone: '+1-555-9911',
      location: 'Austin, USA',
      password: PASSWORD,
      securityAnswers: ['pending-school', 'pending-cricketer', 'pending-city'],
    }

    try {
      await deleteUserIfPresent(request, pendingUser.gameName)

      await apiCall(request, 'POST', '/auth/register', pendingUser, 201)

      const blockedLogin = await request.fetch('http://127.0.0.1:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { userId: pendingUser.gameName, password: pendingUser.password },
      })
      expect(blockedLogin.status()).toBe(403)

      await loginUi(page, 'sreecharan')
      await page.goto('/home')
      await page.getByRole('button', { name: 'User Manager' }).click()

      const pendingTable = page.locator('.pending-approvals-table')
      await expect(pendingTable).toBeVisible()
      const row = pendingTable.locator('tbody tr', { hasText: pendingUser.gameName }).first()
      await expect(row).toBeVisible()
      await expect(row).toContainText(pendingUser.email)
      await expect(row).toContainText(pendingUser.phone)
      await expect(row).toContainText(pendingUser.location)

      await row.getByRole('button', { name: 'Approve' }).click()
      await expect(page.getByText('User approved')).toBeVisible()
      await expect(
        pendingTable.locator('tbody tr', { hasText: pendingUser.gameName }),
      ).toHaveCount(0)

      const approvedLogin = await request.fetch('http://127.0.0.1:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { userId: pendingUser.gameName, password: pendingUser.password },
      })
      expect(approvedLogin.status()).toBe(200)
    } finally {
      await deleteUserIfPresent(request, pendingUser.gameName)
    }
  })

  test('pending user refresh status redirects to login after approval', async ({ page, request }) => {
    const tag = `pending-refresh-${Date.now()}`
    const pendingUser = {
      name: 'Pending Refresh Bot',
      gameName: `mocke2ebot-pending-refresh-${tag}`,
      email: `mocke2ebot-pending-refresh-${tag}@myxi.local`,
      phone: '+1-555-9922',
      location: 'Austin, USA',
      password: PASSWORD,
      securityAnswers: ['refresh-school', 'refresh-cricketer', 'refresh-city'],
    }

    let authedRequest = null

    try {
      const authState = await apiCall(
        request,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: PASSWORD },
        200,
      )
      authedRequest = await playwrightRequest.newContext({
        baseURL: 'http://127.0.0.1:4000',
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      await deleteUserIfPresent(authedRequest, pendingUser.gameName)
      await apiCall(request, 'POST', '/auth/register', pendingUser, 201)

      await page.goto('/login')
      await page.getByLabel('User ID or Email').fill(pendingUser.gameName)
      await page.getByLabel('Password').fill(pendingUser.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL(/\/pending/, { timeout: 15000 })

      const actorUserId = await getMasterActorUserId(authedRequest)
      const created = await findUserByGameName(authedRequest, pendingUser.gameName)
      await apiCall(
        authedRequest,
        'PATCH',
        `/admin/users/${created.id}`,
        { actorUserId, status: 'active' },
        200,
      )

      await page.getByRole('button', { name: 'Refresh status' }).click()
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    } finally {
      if (authedRequest) {
        await deleteUserIfPresent(authedRequest, pendingUser.gameName)
        await authedRequest.dispose()
      }
    }
  })

  test('pending page refresh sends approved users back to login', async ({ page }) => {
    await page.route('**/auth/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'pending-refresh-test',
          gameName: 'pending-refresh-test',
          email: 'pending-refresh-test@myxi.local',
          status: 'active',
        }),
      })
    })

    await page.goto('/pending')
    await page.evaluate(() => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          userId: 'pending-refresh-test',
          gameName: 'pending-refresh-test',
          email: 'pending-refresh-test@myxi.local',
          status: 'pending',
          role: 'user',
        }),
      )
    })

    await page.getByRole('button', { name: 'Refresh status' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})
