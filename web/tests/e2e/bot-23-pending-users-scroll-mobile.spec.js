import { expect, test } from '@playwright/test'

test('pending users table is scrollable on mobile in user manager panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/admin/users', async (route) => {
    const pendingUsers = Array.from({ length: 20 }, (_, index) => ({
      id: `pending-${index + 1}`,
      name: `Pending User ${index + 1}`,
      userId: `pending_user_${index + 1}`,
      email: `pending${index + 1}@example.com`,
      phone: '',
      location: 'NA',
      status: 'pending',
      joinedAt: new Date(Date.now() - index * 86400000).toISOString(),
    }))

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pendingUsers),
    })
  })

  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: '1',
        userId: 'master',
        gameName: 'master',
        name: 'Master Admin',
        role: 'master_admin',
        token: 'e2e-token',
        tokenExpiresAt: now + 60 * 60 * 1000,
      }),
    )
    window.localStorage.setItem('myxi-token', 'e2e-token')
  })

  await page.goto('/home?panel=userManager', { waitUntil: 'domcontentloaded' })

  const pendingWrap = page.locator('.pending-approvals-panel .catalog-table-wrap').first()
  await expect(pendingWrap).toBeVisible()

  const metrics = await pendingWrap.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: window.getComputedStyle(el).overflowY,
  }))

  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
  expect(['auto', 'scroll']).toContain(metrics.overflowY)
})
