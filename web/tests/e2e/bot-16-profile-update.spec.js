import { expect, test } from '@playwright/test'

test.describe('16) Profile update flow', () => {
  test('save profile updates name and sends one PATCH request', async ({ page }) => {
    const loginResponse = await page.request.fetch('http://127.0.0.1:4000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { userId: 'master', password: 'demo123' },
    })
    expect(loginResponse.status()).toBe(200)
    const session = await loginResponse.json()

    await page.goto('/login')
    await page.evaluate((sessionData) => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          ...sessionData,
          token: undefined,
        }),
      )
    }, session)
    await page.goto('/home')
    await page.goto('/profile')

    const currentUser = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('myxi-user')
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    })
    expect(Number(currentUser?.id || 0)).toBeGreaterThan(0)

    const updatedName = `Master Admin ${Date.now()}`
    let profilePatchCount = 0
    page.on('request', (request) => {
      if (request.method() !== 'PATCH') return
      const url = request.url()
      if (!url.match(/\/users\/\d+$/)) return
      profilePatchCount += 1
    })

    const patchResponsePromise = page.waitForResponse((response) => {
      if (response.request().method() !== 'PATCH') return false
      const url = response.url()
      if (!url.match(/\/users\/\d+$/)) return false
      return true
    })

    await page.getByLabel('Full name').fill(updatedName)
    await page.getByRole('button', { name: 'Save profile' }).click()

    const patchResponse = await patchResponsePromise
    expect(patchResponse.status()).toBe(200)
    await expect(page.getByText('Profile updated')).toBeVisible()
    await expect(page.getByLabel('Full name')).toHaveValue(updatedName)
    expect(profilePatchCount).toBe(1)
  })
})
