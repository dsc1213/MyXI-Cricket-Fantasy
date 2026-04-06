import { expect, test } from '@playwright/test'

test('user manager primary and secondary panels use full equal width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1365, height: 768 })

  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'u1',
          name: 'Sample User 1',
          userId: 'sample_user_1',
          email: 'sample1@example.com',
          phone: '',
          location: 'Austin',
          role: 'user',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      ]),
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

  const primary = page.locator('.user-manager-primary').first()
  const secondary = page.locator('.user-manager-secondary').first()

  await expect(primary).toBeVisible()
  await expect(secondary).toBeVisible()

  const sizes = await page.evaluate(() => {
    const p = document.querySelector('.user-manager-primary')
    const s = document.querySelector('.user-manager-secondary')
    if (!p || !s) return null
    const pb = p.getBoundingClientRect()
    const sb = s.getBoundingClientRect()
    return {
      primaryWidth: pb.width,
      secondaryWidth: sb.width,
      widthDelta: Math.abs(pb.width - sb.width),
    }
  })

  expect(sizes).not.toBeNull()
  expect(sizes.primaryWidth).toBeGreaterThan(400)
  expect(sizes.secondaryWidth).toBeGreaterThan(400)
  expect(sizes.widthDelta).toBeLessThanOrEqual(2)

  const pendingHeader = page
    .locator('.pending-approvals-panel.compact .contest-section-head')
    .first()
  await expect(pendingHeader).toBeVisible()

  const headerMetrics = await pendingHeader.evaluate((el) => {
    const heading = el.querySelector('h3')
    const actions = el.querySelector('.top-actions')
    if (!heading || !actions) return null
    const hb = heading.getBoundingClientRect()
    const ab = actions.getBoundingClientRect()
    return {
      headingTop: hb.top,
      actionsTop: ab.top,
      verticalDelta: Math.abs(hb.top - ab.top),
    }
  })

  expect(headerMetrics).not.toBeNull()
  expect(headerMetrics.verticalDelta).toBeLessThanOrEqual(8)
})
