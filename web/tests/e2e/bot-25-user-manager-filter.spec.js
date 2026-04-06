import { expect, test } from '@playwright/test'

test('user manager supports filtering users by search input', async ({ page }) => {
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
          name: 'Dhoni_Sid',
          userId: 'dhoni_sid',
          email: 'dhoni@example.com',
          phone: '',
          location: 'Chennai',
          role: 'user',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'u2',
          name: 'Fighter teddy',
          userId: 'fighter_teddy',
          email: 'fighter@example.com',
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

  await expect(page.getByRole('heading', { name: 'Available users (2)' })).toBeVisible()

  const filterInput = page.getByRole('searchbox', { name: 'Search users' })
  await filterInput.fill('dhoni')

  await expect(
    page.getByRole('heading', { name: 'Available users (1 / 2)' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dhoni_Sid' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Fighter teddy' })).toHaveCount(0)
})
