import { expect, test } from '@playwright/test'

test('mobile landing header keeps API status on second row under auth actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const getStarted = page.getByRole('link', { name: 'Get Started' })
  const apiLabel = page.locator('.topbar-api-status-label').first()

  await expect(getStarted).toBeVisible()
  await expect(apiLabel).toBeVisible()

  const getStartedBox = await getStarted.boundingBox()
  const apiLabelBox = await apiLabel.boundingBox()

  expect(getStartedBox).not.toBeNull()
  expect(apiLabelBox).not.toBeNull()
  expect(apiLabelBox.y).toBeGreaterThan(getStartedBox.y + 8)
})
